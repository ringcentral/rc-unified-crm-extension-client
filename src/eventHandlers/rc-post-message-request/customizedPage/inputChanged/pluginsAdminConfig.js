import { getPluginsSettingPageRender } from '../../../../components/admin/managedSettings/pluginsSettingPage';
import { getPluginList } from '../../../../service/manifestService';
import { getAllPluginSettings } from '../../../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const pluginList = await getPluginList();
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const adminUserSettings = adminSettings?.userSettings;
    const installedPluginList = [];
    for (const pluginId in getAllPluginSettings(adminUserSettings)) {
        const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
        if (targetPlugin) {
            installedPluginList.push(targetPlugin);
        }
    }
    const pluginsSettingPageRender = getPluginsSettingPageRender({ installedPluginList });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: pluginsSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${pluginsSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;