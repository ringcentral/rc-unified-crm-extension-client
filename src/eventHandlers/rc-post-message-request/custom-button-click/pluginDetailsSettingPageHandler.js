import { getPluginSetting } from '../../../core/user';
import { uploadAdminSettings } from '../../../core/admin';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const formData = data.body.button.formData;
    const pluginId = formData.pluginId;
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const pluginSetting = getPluginSetting(adminSettings.userSettings, pluginId);
    for (const k in formData) {
        if (k === 'pluginId') continue;
        pluginSetting.config[k] = {
            value: formData[k].value,
            customizable: formData[k].customizable
        };
    }
    await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    // go back
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack'
    }, '*');
}

exports.onEvent = onEvent;
