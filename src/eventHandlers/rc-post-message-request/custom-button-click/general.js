import adminCore from '../../../core/admin';
import userCore from '../../../core/user';
import { showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const settingDataKeys = Object.keys(data.body.button.formData);
    if (!adminSettings.userSettings) {
        adminSettings.userSettings = {};
    }
    for (const k of settingDataKeys) {
        adminSettings.userSettings[k] = data.body.button.formData[k];
    }
    await chrome.storage.local.set({ adminSettings });
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    await userCore.refreshUserSettings({});
    showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
}

exports.onEvent = onEvent;