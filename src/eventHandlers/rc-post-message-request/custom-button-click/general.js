import adminCore from '../../../core/admin';
import userCore from '../../../core/user';
import { showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform, responseMessage }) {
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
    try {
        await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
        await userCore.refreshUserSettings({});
    } catch (error) {
        console.error('Error uploading admin settings:', error);
        showNotification({ level: 'error', message: 'Failed to save settings. Please try again.', ttl: 3000 });
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
    }
    const serverSideLoggingEnabled = adminSettings?.userSettings?.serverSideLogging?.enable ?? false;
    if (data.body.button.id === 'callLogDetailsSettingPage' && serverSideLoggingEnabled) {
        // Response to widget to avoid timeout error
        responseMessage(data.requestId, { data: 'ok' });
        let serverSideLoggingSubscribed = false;
        let serverSideLogging;
        try {
            serverSideLogging = await adminCore.getServerSideLogging({ platform });
            serverSideLoggingSubscribed = serverSideLogging?.subscribed ?? false;
        } catch (error) {
            console.error('Error getting server side logging:', error);
        }
        // if server side logging is subscribed, refresh subscription level
        if (serverSideLoggingSubscribed) {
            const useAdminAssignedUserToken = platform.serverSideLogging?.useAdminAssignedUserToken
            await adminCore.enableServerSideLogging({
                serverUrl: manifest.serverUrl,
                platform,
                subscriptionLevel: serverSideLogging.subscriptionLevel,
                loggingByAdmin: useAdminAssignedUserToken ? !serverSideLogging.loggingWithUserAssigned : serverSideLogging.loggingByAdmin,
                sources: serverSideLogging.sources,
                silence: true,
            });
        }
    }
    showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
}

exports.onEvent = onEvent;