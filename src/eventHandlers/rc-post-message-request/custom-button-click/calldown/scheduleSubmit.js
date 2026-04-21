import contactCore from '../../../../core/contact';
import { showNotification, cacheCalldownContact } from '../../../../lib/util';
import axios from 'axios';
import calldownPage from '../../../../components/calldownPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const btn = data.body.button || {};
    const { phone, callbackDateTime, note, contact, newContactName, editingRecordId } = btn.formData || {};
    if (!callbackDateTime || !phone) {
        return;
    }

    const isEditMode = !!editingRecordId;
    // show spinner while scheduling
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    let contactIdToUse = contact;
    if (contact === 'newContact' && newContactName && newContactName.trim() !== '') {
        const ct = manifest.platforms[platformName]?.contactTypes || [];
        const selectedType = (btn.formData && btn.formData.newContactType) || (ct[0]?.value || '');
        const created = await contactCore.createContact({ serverUrl: manifest.serverUrl, phoneNumber: phone, newContactName, newContactType: selectedType, additionalSubmission: {} });
        console.log({ message: 'created', created });
        if (created?.contactInfo?.id) {
            contactIdToUse = created.contactInfo.id;
            showNotification({ level: 'success', message: 'Contact created', ttl: 3000 });

            if (isEditMode) {
                await axios.patch(`${manifest.serverUrl}/calldown/${editingRecordId}`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: contactIdToUse, contactType: selectedType, note });
            } else {
                await axios.post(`${manifest.serverUrl}/calldown`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: contactIdToUse, contactType: selectedType, note });
            }

            // Cache contact information for call back list display
            await cacheCalldownContact({
                contactId: contactIdToUse,
                contactName: newContactName,
                phoneNumber: phone,
                contactType: selectedType
            });

            showNotification({ level: 'success', message: isEditMode ? 'Schedule updated successfully' : 'Added to Call Back list', ttl: 3000 });
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
                type: 'rc-adapter-trigger-contact-match',
                phoneNumbers: [phone]
            }, '*');

            const { userSettings } = await chrome.storage.local.get('userSettings');
            const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: calldownPageRender }, '*');
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-navigate-to', path: 'goBack' }, '*');
        } else {
            showNotification({ level: 'warning', message: 'Contact creation failed', ttl: 3000 });
        }
    }
    else {
        // Get contact info from CRM to get contactType
        let contactType = 'Contact'; // default
        let selectedContact = null;
        if (contactIdToUse && contactIdToUse !== 'newContact') {
            const { matched, contactInfo } = await contactCore.getContact({
                serverUrl: manifest.serverUrl,
                phoneNumber: phone,
                platformName,
                isForceRefresh: false,
                isToTriggerContactMatch: false
            });

            if (matched && contactInfo && contactInfo.length > 0) {
                // Find the specific contact by ID
                selectedContact = contactInfo.find(c => c.id === contactIdToUse);
                if (selectedContact) {
                    contactType = selectedContact.type || 'Contact';
                }
            }
        }

        if (isEditMode) {
            await axios.patch(`${manifest.serverUrl}/calldown/${editingRecordId}`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: contactIdToUse, contactType, note });
        } else {
            await axios.post(`${manifest.serverUrl}/calldown`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: contactIdToUse, contactType, note });
        }

        // Cache contact information for existing contact
        if (contactIdToUse && contactIdToUse !== 'newContact') {
            await cacheCalldownContact({
                contactId: contactIdToUse,
                contactName: selectedContact?.name || '',
                phoneNumber: phone,
                contactType
            });

            // Notify user on success
            showNotification({ level: 'success', message: isEditMode ? 'Schedule updated successfully' : 'Added to Call Back list', ttl: 3000 });
        }
        const { userSettings } = await chrome.storage.local.get('userSettings');
        const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
        document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: calldownPageRender }, '*');
        document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-navigate-to', path: 'goBack' }, '*');
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}
exports.onEvent = onEvent;
