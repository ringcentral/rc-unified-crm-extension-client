import { getInstalledPluginListPageRender } from '../../../../components/installedPluginListPage';
import { getPluginList } from '../../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    for (const settingsKey in (adminSettings.userSettings.plugins ?? {})) {
        if (settingsKey.startsWith('plugin_')) {
            const targetPlugin = pluginList.find(plugin => plugin.id === settingsKey.split('plugin_')[1]);
            pluginListToRender.push(targetPlugin);
        }
    }
    const installedPluginListPageRender = getInstalledPluginListPageRender({ pluginList: pluginListToRender, isFromAdmin: true });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: installedPluginListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${installedPluginListPageRender.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;