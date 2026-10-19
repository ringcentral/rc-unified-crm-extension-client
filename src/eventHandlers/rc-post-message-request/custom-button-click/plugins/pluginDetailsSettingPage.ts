import { getPluginSetting } from '../../../../core/user';
import { uploadAdminSettings } from '../../../../core/admin';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const formData = data.body.button.formData;
  const pluginId = formData.pluginId;
  const hiddenConfigFields = Array.isArray(formData.hiddenConfigFields) ? formData.hiddenConfigFields : [];
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  const pluginSetting = getPluginSetting(adminSettings.userSettings, pluginId) as UnknownRecord;
  for (const k in formData) {
    if (k === 'pluginId' || k === 'hiddenConfigFields') continue;
    pluginSetting.config[k] = {
      value: formData[k].value,
      customizable: hiddenConfigFields.includes(k) ? false : formData[k].customizable,
    };
  }
  await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  // go back
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
}

export default {
  onEvent,
};
