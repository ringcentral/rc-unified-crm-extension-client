import { getPluginsSettingPageRender } from '../../../../components/admin/managedSettings/pluginsSettingPage';
import { getPluginList } from '../../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const pluginList = await getPluginList();
    const {adminSettings} = await chrome.storage.local.get('adminSettings');
    const adminUserSettings = adminSettings?.userSettings;
    const installedPluginList = [];
    for (const settingsKey in (adminUserSettings.plugins ?? {})) {
        if (settingsKey.startsWith('plugin_')) {
            const targetPlugin = pluginList.find(plugin => plugin.id === settingsKey.split('plugin_')[1]);
            installedPluginList.push(targetPlugin);
        }
    }
    const pluginsSettingPageRender = getPluginsSettingPageRender({ adminUserSettings: adminSettings?.userSettings, installedPluginList });
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