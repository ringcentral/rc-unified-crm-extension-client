import { getPluginDetails } from '../../../../../service/manifestService';
import { getPluginDetailsSettingPageRender } from '../../../../../components/admin/managedSettings/pluginsSetting/pluginDetailsSettingPage';
import { getPluginSetting } from '../../../../../core/user';

async function onEvent({ data, manifest, platformInfo, platformName, platform, pluginId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const selectedPlugin = getPluginSetting(adminSettings.userSettings, pluginId);
    const pluginDetails = await getPluginDetails({ pluginId, selectedPlugin });
    const pluginSetting = getPluginSetting(adminSettings.userSettings, pluginId);
    const pluginDetailsSettingPageRender = getPluginDetailsSettingPageRender({ pluginId, plugin: selectedPlugin, pluginDetails, pluginSetting });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: pluginDetailsSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${pluginDetailsSettingPageRender.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;