import contactCore from '../../../../core/contact';
import { getSchedulePageRender } from '../../../../components/schedulePage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    
    const btn = data.body.button || {};
    const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] });
    const rowId =  listButtonItemId ?? '';
    const item = (calldownListCache || []).find(i => i.id === rowId);
    
    if (!item) {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
    }

    const phoneNumber = item.phoneNumber;
    const scheduledAt = item.scheduledAt;
    const existingContactId = item.contactId;
    const existingContactType = item.contactType;

    // Resolve contacts for the phone number
    const res = await contactCore.getContact({ 
        serverUrl: manifest.serverUrl, 
        phoneNumber, 
        platformName, 
        isForceRefresh: true, 
        isToTriggerContactMatch: true 
    });
    
    const contacts = (res?.contactInfo || []).filter(c => !c.isNewContact);
    const contactOptions = contacts.map(c => ({ const: c.id, title: c.name }));
    const newContactOption = { const: 'newContact', title: 'Create new contact' };
    const listOneOf = [...contactOptions, newContactOption];
    
    // Pre-select existing contact if it exists in the contacts list
    let preselect = 'newContact';
    if (existingContactId) {
        const existingContact = contacts.find(c => c.id === existingContactId);
        if (existingContact) {
            preselect = existingContactId;
        }
    } else if (contacts.length > 0) {
        preselect = contacts[0].const;
    }
    
    const isDefaultNew = preselect === 'newContact';
    
    const schedulePage = getSchedulePageRender({
        phoneNumber,
        listOneOf,
        isDefaultNew,
        preselect,
        contactTypes: manifest.platforms[platformName]?.contactTypes || []
    });
    
    // Update title for edit mode
    schedulePage.title = 'Edit scheduled call';
    
    // Update submit button text
    schedulePage.schema.properties.scheduleSubmit.title = 'Update Schedule';
    
    // Pre-fill the scheduled datetime if it exists
    if (scheduledAt) {
        schedulePage.formData.callbackDateTime = new Date(scheduledAt).toISOString().slice(0, 16);
    }
    
    // Pre-fill contact name if editing existing contact
    if (item.contactName && isDefaultNew) {
        schedulePage.formData.newContactName = item.contactName;
    }
    
    // Store the original record ID so we can update it instead of creating new
    schedulePage.formData.editingRecordId = rowId;
    
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: schedulePage
    }, '*');
    
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${schedulePage.id}`
    }, '*');
    
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;
