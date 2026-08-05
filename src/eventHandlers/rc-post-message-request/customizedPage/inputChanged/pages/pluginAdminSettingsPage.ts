import { getPluginDetails } from '../../../../../service/manifestService';
import { getPluginDetailsSettingPageRender } from '../../../../../components/admin/managedSettings/pluginsSetting/pluginDetailsSettingPage';
import { getPluginSetting } from '../../../../../core/user';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
  pluginId: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, pluginId }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };
  const selectedPlugin = getPluginSetting(adminSettings!.userSettings, pluginId);
  const pluginDetails = await getPluginDetails({ pluginId, selectedPlugin });
  const pluginSetting = getPluginSetting(adminSettings!.userSettings, pluginId);
  const pluginDetailsSettingPageRender = getPluginDetailsSettingPageRender({ pluginId, plugin: selectedPlugin, pluginDetails, pluginSetting });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: pluginDetailsSettingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${pluginDetailsSettingPageRender.id}`, // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
