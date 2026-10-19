import { getPluginList } from '../../../../service/manifestService';
import { getInstalledPluginListPageRender } from '../../../../components/installedPluginListPage';
import { getAllPluginSettings, getUserSettingsOnline } from '../../../../core/user';
import pluginService from '../../../../service/pluginService';

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
  void data;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
  const pluginList = await getPluginList() as UnknownRecord[];
  const pluginListToRender: UnknownRecord[] = [];
  const installedPlugins = getAllPluginSettings(userSettings);
  for (const pluginId in installedPlugins) {
    const targetPlugin = pluginList.find(plugin => plugin.id === pluginId) as UnknownRecord;
    targetPlugin.requireLicense = installedPlugins[pluginId]?.requireLicense ?? false;
    if (targetPlugin) {
      pluginListToRender.push(targetPlugin);
    }
  }
  // fetch license status for all plugins as a batch
  const licenseStatuses = await Promise.all(pluginListToRender.map(plugin => pluginService.getPluginLicenseStatus({ pluginId: plugin.id, plugin })));
  for (const plugin of pluginListToRender) {
    const licenseStatus = licenseStatuses.find(status => status.id === plugin.id) as UnknownRecord;
    plugin.licenseStatus = licenseStatus.licenseStatus;
    plugin.licenseStatusDescription = licenseStatus.licenseStatusDescription;
    plugin.errorMessage = licenseStatus.errorMessage;
  }
  const installedPluginListPageRender = getInstalledPluginListPageRender({ pluginList: pluginListToRender, isFromAdmin: false });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: installedPluginListPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${installedPluginListPageRender.id}`,
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
