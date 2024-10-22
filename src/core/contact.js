import axios from 'axios';
import analytics from '../lib/analytics';
import { isObjectEmpty } from '../lib/util';
import { showNotification } from '../lib/util';

function getLocalCachedContact({ phoneNumber, platformName }) {
    const allCachedContacts = document.querySelector("#rc-widget-adapter-frame").contentWindow.phone.contactMatcher.data;
    let result = [];
    if (!allCachedContacts) {
        return result;
    }
    const contact = allCachedContacts[phoneNumber];
    if (!!!contact) {
        return result;
    }
    const contactUnderCRM = contact[platformName]?.data;
    if(!!!contactUnderCRM)
    {
        return result;
    }
    for (const c of contactUnderCRM) {
        result.push({
            id: c.id,
            name: c.name,
            type: c.contactType,
            phone: phoneNumber,
            isNewContact: c.isNewContact,
            additionalInfo: c.additionalInfo
        });
    }
    return result;
}

async function getContact({ serverUrl, phoneNumber, platformName, isForceRefresh = false }) {
    if (!isForceRefresh) {
        const cachedContact = getLocalCachedContact({ phoneNumber, platformName });
        if (cachedContact.length > 0) {
            return {
                matched: true,
                returnMessage: null,
                contactInfo: cachedContact
            };
        }
    }
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const overridingFormats = [];
    const { extensionUserSettings } = await chrome.storage.local.get('extensionUserSettings');
    if (!!extensionUserSettings && !isObjectEmpty(extensionUserSettings)) {
        const overridingPhoneNumberFormat = extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat')?.value ?? null;
        const overridingPhoneNumberFormat2 = extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat2')?.value ?? null;
        const overridingPhoneNumberFormat3 = extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat3')?.value ?? null;
        if (overridingPhoneNumberFormat) { overridingFormats.push('+1**********'); overridingFormats.push(overridingPhoneNumberFormat); }
        if (overridingPhoneNumberFormat2) overridingFormats.push(overridingPhoneNumberFormat2);
        if (overridingPhoneNumberFormat3) overridingFormats.push(overridingPhoneNumberFormat3);
    }
    if (!!rcUnifiedCrmExtJwt) {
        const contactRes = await axios.get(`${serverUrl}/contact?jwtToken=${rcUnifiedCrmExtJwt}&phoneNumber=${phoneNumber}&overridingFormat=${overridingFormats.toString()}`);
        return {
            matched: contactRes.data.successful,
            returnMessage: contactRes.data.returnMessage,
            contactInfo: contactRes.data.contact
        };
    }
    else {
        return {
            matched: false,
            returnMessage:
            {
                message: 'Please go to Settings and connect to CRM platform',
                messageType: 'warning',
                ttl: 3000
            },
            contactInfo: null
        };
    }
}

async function createContact({ serverUrl, phoneNumber, newContactName, newContactType }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (!!rcUnifiedCrmExtJwt) {
        const contactRes = await axios.post(
            `${serverUrl}/contact?jwtToken=${rcUnifiedCrmExtJwt}`,
            {
                phoneNumber,
                newContactName,
                newContactType
            }
        );
        // force trigger contact matcher
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-trigger-contact-match',
            phoneNumbers: [phoneNumber],
        }, '*');
        await chrome.storage.local.set({ tempContactMatchTask: { contactId: contactRes.data.contact.id, phoneNumber, contactName: newContactName, contactType: newContactType } });
        analytics.createNewContact();
        return {
            matched: contactRes.data.successful,
            contactInfo: contactRes.data.contact,
            returnMessage: contactRes.data.returnMessage
        };
    }
    else {
        return {
            matched: false,
            returnMessage: {
                message: 'Please go to Settings and connect to CRM platform',
                messageType: 'warning',
                ttl: 3000
            },
            contactInfo: null
        };
    }
}

async function openContactPage({ manifest, platformName, phoneNumber, contactId, contactType }) {
    showNotification({ level: 'success', message: 'Trying to find and open contact page...', ttl: 5000 });
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    let platformInfo = await chrome.storage.local.get('platform-info');
    if (platformInfo['platform-info'].hostname === 'temp') {
        const hostnameRes = await axios.get(`${manifest.serverUrl}/hostname?jwtToken=${rcUnifiedCrmExtJwt}`);
        platformInfo['platform-info'].hostname = hostnameRes.data;
        await chrome.storage.local.set(platformInfo);
    }
    const hostname = platformInfo['platform-info'].hostname;
    if (!!contactId) {
        // Unique: Bullhorn 
        if (platformName === 'bullhorn') {
            const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
            if (crm_extension_bullhorn_user_urls?.atsUrl) {
                const newTab = window.open(`${crm_extension_bullhorn_user_urls.atsUrl}/BullhornStaffing/OpenWindow.cfm?Entity=${contactType}&id=${contactId}&view=Overview`, '_blank', 'popup');
                newTab.blur();
                window.focus();
            }
            return;
        }
        else {
            const contactPageUrl = manifest.platforms[platformName].contactPageUrl
                .replace('{hostname}', hostname)
                .replaceAll('{contactId}', contactId)
                .replaceAll('{contactType}', contactType);
            window.open(contactPageUrl);
        }
    }
    else {
        const { matched: contactMatched, contactInfo } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber });
        if (!contactMatched) {
            return;
        }
        // Unique: Bullhorn
        if (platformName === 'bullhorn') {
            const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
            if (crm_extension_bullhorn_user_urls?.atsUrl) {
                for (const c of contactInfo) {
                    if (c.isNewContact) {
                        continue;
                    }
                    const newTab = window.open(`${crm_extension_bullhorn_user_urls.atsUrl}/BullhornStaffing/OpenWindow.cfm?Entity=${c.type}&id=${c.id}&view=Overview`, '_blank', 'popup');
                    newTab.blur();
                    window.focus();
                }
            }
            return;
        }
        for (const c of contactInfo) {
            if (c.isNewContact) {
                continue;
            }
            const hostname = platformInfo['platform-info'].hostname;
            const contactPageUrl = manifest.platforms[platformName].contactPageUrl
                .replace('{hostname}', hostname)
                .replaceAll('{contactId}', c.id)
                .replaceAll('{contactType}', c.type);
            window.open(contactPageUrl);
        }
    }
}

exports.getContact = getContact;
exports.createContact = createContact;
exports.openContactPage = openContactPage;