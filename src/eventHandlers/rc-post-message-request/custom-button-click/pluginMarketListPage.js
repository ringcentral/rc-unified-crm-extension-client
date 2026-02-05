import { getPluginMarketListPageRender } from '../../../components/pluginMarketListPage';
import { getPluginList } from '../../../service/manifestService';
import { getUserSettingsOnline } from '../../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform, viewType }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    for (const plugin of pluginList) {
        if (Object.keys(userSettings.plugins ?? {}).includes(`plugin_${plugin.id}`)) {
            continue;
        }
        pluginListToRender.push(plugin);
    }
    const pluginMarketListPageRender = getPluginMarketListPageRender({ viewType, pluginList: pluginListToRender });
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

