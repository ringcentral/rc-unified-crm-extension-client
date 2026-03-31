import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest }) {
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
    showNotification({ level: 'success', message: 'Organization shared authentication updated.', ttl: 3000 });
}

exports.onEvent = onEvent;
