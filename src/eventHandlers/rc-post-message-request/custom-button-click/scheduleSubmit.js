import contactCore from '../../../core/contact';
import { showNotification, cacheCalldownContact } from '../../../lib/util';
import axios from 'axios';
import calldownPage from '../../../components/calldownPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const btn = data.body.button || {};
    const { phone, callbackDateTime, note, contact, newContactName } = btn.formData || {};
    if (!callbackDateTime || !phone) {
        return;
    }
    // show spinner while scheduling
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    let contactIdToUse = contact;
    if (contact === 'newContact' && newContactName && newContactName.trim() !== '') {
        const ct = manifest.platforms[platformName]?.contactTypes || [];
        const selectedType = (btn.formData && btn.formData.newContactType) || (ct[0]?.value || '');
        const created = await contactCore.createContact({ serverUrl: manifest.serverUrl, phoneNumber: phone, newContactName, newContactType: selectedType, additionalSubmission: {} });
        console.log({ message: 'created', created });
        if (created?.contactInfo?.id) {
            contactIdToUse = created.contactInfo.id;
            showNotification({ level: 'success', message: 'Contact created', ttl: 3000 });
            await axios.post(`${manifest.serverUrl}/calldown?jwtToken=${rcUnifiedCrmExtJwt}&rcAccountId=${rcAccountId}`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: contactIdToUse, note });

            // Cache contact information for call-down list display
            await cacheCalldownContact({
                contactId: contactIdToUse,
                contactName: newContactName,
                phoneNumber: phone,
                contactType: selectedType
            });

            showNotification({ level: 'success', message: 'Added to call-down list', ttl: 3000 });
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
                type: 'rc-adapter-trigger-contact-match',
                phoneNumbers: [phone]
            }, '*');
        } else {
            showNotification({ level: 'warning', message: 'Contact creation failed', ttl: 3000 });
        }
    }
    else {
        await axios.post(`${manifest.serverUrl}/calldown?jwtToken=${rcUnifiedCrmExtJwt}&rcAccountId=${rcAccountId}`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: contactIdToUse, note });

        // Cache contact information for existing contact
        // Get contact info from CRM since page data is not available in submit handler
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
                const selectedContact = contactInfo.find(c => c.id === contactIdToUse);
                if (selectedContact) {
                    await cacheCalldownContact({
                        contactId: contactIdToUse,
                        contactName: selectedContact.name,
                        phoneNumber: phone,
                        contactType: selectedContact.type || 'Contact'
                    });
                }
            }

            // Notify user on success
            showNotification({ level: 'success', message: 'Added to call-down list', ttl: 3000 });
        }
        const { userSettings } = await chrome.storage.local.get('userSettings');
        const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, jwtToken: rcUnifiedCrmExtJwt, filterStatus: 'All', userSettings });
        document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-register-customized-page', page: calldownPageRender }, '*');
        document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({ type: 'rc-adapter-navigate-to', path: 'goBack' }, '*');
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}
exports.onEvent = onEvent;