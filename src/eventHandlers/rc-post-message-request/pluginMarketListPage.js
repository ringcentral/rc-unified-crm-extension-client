import { getPluginMarketListPageRender } from '../../components/pluginMarketListPage';
import { getPluginList } from '../../service/manifestService';
import { getAllPluginSettings, getUserSettingsOnline } from '../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    const installedPlugins = getAllPluginSettings(userSettings);
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
        filter: pluginSearch.filter ?? null
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: pluginMarketListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${pluginMarketListPageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

