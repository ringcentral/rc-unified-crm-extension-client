import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null });
        const values = {};
        const fieldsToRemove = [];
        (managedAuthSettings?.orgFields ?? []).forEach(field => {
            const submittedValue = data.body.button.formData[field.const];
            if (submittedValue !== undefined && submittedValue !== '') {
                values[field.const] = submittedValue;
                return;
            }
            if (managedAuthSettings?.orgValues?.[field.const]?.hasValue) {
                fieldsToRemove.push(field.const);
            }
        });
        await adminCore.saveManagedAuthSettings({
            serverUrl: manifest.serverUrl,
            scope: 'org',
            values,
            fieldsToRemove
        });
    }
    catch (error) {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        showNotification({ level: 'error', message: 'Failed to update organization managed authentication. Please try again.', ttl: 3000 });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: 'goBack',
        }, '*');
        return;
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: 'Organization managed authentication updated.', ttl: 3000 });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
}

exports.onEvent = onEvent;
