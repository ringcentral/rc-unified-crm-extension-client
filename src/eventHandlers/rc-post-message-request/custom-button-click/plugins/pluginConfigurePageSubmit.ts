import { refreshUserSettings } from '../../../../core/user';
import { getRcInfo, showNotification } from '../../../../lib/util';
import { getMergedPluginConfigFromFormData } from '../../../../components/pluginConfigurePage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const rcInfo = await getRcInfo();
  const rcAccountId = rcInfo.value.cachedData.extensionInfo.account.id;
  const form = data.body.button.formData;
  const config = getMergedPluginConfigFromFormData(form);
  const changedSettings = {
    [`plugin_${form.pluginId}`]: {
      value: {
        name: form.plugin.name,
        version: form.plugin.version,
        isAsync: form.isAsync,
        phase: form.phase,
        access: form.access,
        supportedLogTypes: form.supportedLogTypes,
        rcAccountId,
        config,
      },
      isCustomizable: true,
    },
  };
  const userSettings = await refreshUserSettings({ changedSettings });
  void userSettings;
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  showNotification({ level: 'success', message: 'Configuration is updated.', ttl: 3000 });
}

export default {
  onEvent,
};
