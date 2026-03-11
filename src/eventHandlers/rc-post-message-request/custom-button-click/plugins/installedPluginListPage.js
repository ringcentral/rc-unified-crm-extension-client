import { getPluginList } from '../../../../service/manifestService';
import { getInstalledPluginListPageRender } from '../../../../components/installedPluginListPage';
import { getAllPluginSettings, getUserSettingsOnline } from '../../../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    const installedPlugins = getAllPluginSettings(userSettings);
    for (const pluginId in installedPlugins) {
        const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
        if (targetPlugin) {
            pluginListToRender.push(targetPlugin);
        }
    }
    const installedPluginListPageRender = getInstalledPluginListPageRender({ pluginList: pluginListToRender, isFromAdmin: false });
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

