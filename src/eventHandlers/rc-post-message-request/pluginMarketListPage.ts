import { getPluginMarketListPageRender } from '../../components/pluginMarketListPage';
import { getPluginList } from '../../service/manifestService';
import { getAllPluginSettings, getUserSettingsOnline } from '../../core/user';

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
  const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
  const pluginList = await getPluginList() as UnknownRecord[];
  const pluginListToRender: UnknownRecord[] = [];
  const installedPlugins = getAllPluginSettings(userSettings) as UnknownRecord;
  for (const plugin of pluginList) {
    if (installedPlugins[plugin.id]) {
      continue;
    }
    pluginListToRender.push(plugin);
  }
  const pluginSearch = data.body?.formData?.pluginSearch ?? {};
  const pluginMarketListPageRender = getPluginMarketListPageRender({
    pluginList: pluginListToRender,
    searchWord: pluginSearch.search ?? '',
    filter: pluginSearch.filter ?? null,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: pluginMarketListPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${pluginMarketListPageRender.id}`,
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
