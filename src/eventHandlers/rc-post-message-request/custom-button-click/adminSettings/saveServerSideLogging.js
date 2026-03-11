import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import embeddableServices from '../../../../service/embeddableServices';

async function onEvent({ data, manifest, platformInfo, platformName, platform, responseMessage }) {
    responseMessage(data.requestId, { data: 'ok' }); // Response to widget to avoid timeout error
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    adminSettings.userSettings.serverSideLogging =
    {
        enable: data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable',
        loggingLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging
    };
    const { userSettings } = await userCore.refreshUserSettings({
        changedSettings: {
            serverSideLogging:
            {
                enable: data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable',
                loggingLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging
            }
        }
    });
    await chrome.storage.local.set({ adminSettings });
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    if (data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable') {
        await adminCore.enableServerSideLogging({
            serverUrl: manifest.serverUrl,
            platform,
            subscriptionLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging,
            loggingByAdmin: data.body.button.formData.serverSideLoggingHolder.activityRecordOwner === 'admin',
            sources: data.body.button.formData.serverSideLoggingHolder.sources
        });
    }
    else {
        await adminCore.disableServerSideLogging({ platform });
        showNotification({ level: 'success', message: 'Server side logging turned OFF.', ttl: 5000 });
    }
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await embeddableServices.getServiceManifest())
    }, '*');
    const updateSSCLFieldsResponse = await adminCore.uploadServerSideLoggingAdditionalFieldValues({ platform, formData: data.body.button.formData });
    if (updateSSCLFieldsResponse) {
        if (updateSSCLFieldsResponse.successful) {
            showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: 'goBack',
            }, '*');
        }
        else {
            showNotification({ level: updateSSCLFieldsResponse.returnMessage.messageType, message: updateSSCLFieldsResponse.returnMessage.message, ttl: updateSSCLFieldsResponse.returnMessage.ttl });
        }
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;