import { getPluginsSettingPageRender } from '../../../../../components/admin/managedSettings/pluginsSettingPage';
import { getPluginList } from '../../../../../service/manifestService';
import { getAllPluginSettings } from '../../../../../core/user';

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
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const pluginList = await getPluginList() as UnknownRecord[];
    const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };
    const adminUserSettings = adminSettings?.userSettings;
    const installedPluginList: UnknownRecord[] = [];
    for (const pluginId in getAllPluginSettings(adminUserSettings)) {
      const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
      if (targetPlugin) {
        installedPluginList.push(targetPlugin);
      }
    }
    const pluginsSettingPageRender = getPluginsSettingPageRender({ installedPluginList });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: pluginsSettingPageRender,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${pluginsSettingPageRender.id}`, // page id
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
