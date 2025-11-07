import adminCore from '../../../core/admin';
import userCore from '../../../core/user';
import { showNotification } from '../../../lib/util';
import embeddableServices from '../../../service/embeddableServices';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    adminSettings.userSettings.serverSideLogging.doNotLogNumbers = data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? "";
    const { userSettings } = await userCore.refreshUserSettings({
        changedSettings: {
            serverSideLogging:
            {
                doNotLogNumbers: data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? ""
            }
        }
    });
    await chrome.storage.local.set({ adminSettings });
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await embeddableServices.getServiceManifest())
    }, '*');
    await adminCore.updateServerSideDoNotLogNumbers({ platform, doNotLogNumbers: data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? "" });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
}

exports.onEvent = onEvent;