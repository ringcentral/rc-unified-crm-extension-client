import adminCore from '../../../../core/admin';
import { getRcContactInfo, showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest }) {
    const { sharedAuthSettings } = await chrome.storage.local.get({ sharedAuthSettings: null });
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const selectedRcExtensionId = data.body.button.formData.rcExtensionId;
    const selectedRcUser = rcExtensions.find(extension => extension.id === selectedRcExtensionId);
    const selectedStoredEntry = (sharedAuthSettings?.userValues ?? []).find(user => user.rcExtensionId === selectedRcExtensionId);
    const values = {};
    const fieldsToRemove = [];
    (sharedAuthSettings?.userFields ?? []).forEach(field => {
        const submittedValue = data.body.button.formData[field.const];
        if (submittedValue !== undefined && submittedValue !== '') {
            values[field.const] = submittedValue;
            return;
        }
        if (selectedStoredEntry?.fields?.[field.const]?.hasValue) {
            fieldsToRemove.push(field.const);
        }
    });
    await adminCore.saveSharedAuthSettings({
        serverUrl: manifest.serverUrl,
        scope: 'user',
        rcExtensionId: selectedRcExtensionId,
        rcUserName: selectedRcUser?.name || `${selectedRcUser?.firstName ?? ''} ${selectedRcUser?.lastName ?? ''}`.trim(),
        values,
        fieldsToRemove
    });
    showNotification({ level: 'success', message: 'User shared authentication updated.', ttl: 3000 });
}

exports.onEvent = onEvent;
