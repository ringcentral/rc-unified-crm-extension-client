import { getPluginList } from '../../../service/manifestService';
import { getInstalledPluginListPageRender } from '../../../components/installedPluginListPage';
import { getUserSettingsOnline } from '../../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    for (const settingsKey in (userSettings.plugins ?? {})) {
        if (settingsKey.startsWith('plugin_')) {
            const targetPlugin = pluginList.find(plugin => plugin.id === settingsKey.split('plugin_')[1]);
            pluginListToRender.push(targetPlugin);
        }
    }
    const installedPluginListPageRender = getInstalledPluginListPageRender({ viewType: 'installed', pluginList: pluginListToRender });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: installedPluginListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${installedPluginListPageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

