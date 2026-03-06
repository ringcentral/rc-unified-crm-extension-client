import { getPluginDetails } from '../../../../service/manifestService';
import { getPluginDetailsSettingPageRender } from '../../../../components/admin/managedSettings/pluginsSetting/pluginDetailsSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, pluginId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const selectedPlugin = adminSettings?.userSettings?.plugins?.[`plugin_${pluginId}`]?.value;
    selectedPlugin.id = pluginId;
    const pluginDetails = await getPluginDetails({ selectedPlugin });
    const pluginDetailsSettingPageRender = getPluginDetailsSettingPageRender({ pluginId, pluginDetails });
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