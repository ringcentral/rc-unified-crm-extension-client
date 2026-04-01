import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const { sharedAuthSettings } = await chrome.storage.local.get({ sharedAuthSettings: null });
        const values = {};
        const fieldsToRemove = [];
        (sharedAuthSettings?.orgFields ?? []).forEach(field => {
            const submittedValue = data.body.button.formData[field.const];
            if (submittedValue !== undefined && submittedValue !== '') {
                values[field.const] = submittedValue;
                return;
            }
            if (sharedAuthSettings?.orgValues?.[field.const]?.hasValue) {
                fieldsToRemove.push(field.const);
            }
        });
        await adminCore.saveSharedAuthSettings({
            serverUrl: manifest.serverUrl,
            scope: 'org',
            values,
            fieldsToRemove
        });
    }
    catch (error) {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        showNotification({ level: 'error', message: 'Failed to update organization shared authentication. Please try again.', ttl: 3000 });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: 'goBack',
        }, '*');
        return;
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: 'Organization shared authentication updated.', ttl: 3000 });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
}

exports.onEvent = onEvent;
