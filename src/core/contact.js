import axios from 'axios';
import analytics from '../lib/analytics';
import { showNotification } from '../lib/util';
import multiContactPopPromptPage from '../components/multiContactPopPromptPage';

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
    if (!!!contactUnderCRM) {
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

async function getContact({ serverUrl, phoneNumber, platformName, isExtensionNumber = false, isForceRefresh = false, isForContactMatchEvent = false }) {
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
    const { userSettings } = await chrome.storage.local.get('userSettings');
    if (!!userSettings?.overridingPhoneNumberFormat?.value) {
        overridingFormats.push(userSettings.overridingPhoneNumberFormat.value);
    }
    if (!!userSettings?.overridingPhoneNumberFormat2?.value) {
        overridingFormats.push(userSettings.overridingPhoneNumberFormat2.value);
    }
    if (!!userSettings?.overridingPhoneNumberFormat3?.value) {
        overridingFormats.push(userSettings.overridingPhoneNumberFormat3.value);
    }

    if (!!rcUnifiedCrmExtJwt) {
        const contactRes = await axios.get(`${serverUrl}/contact?jwtToken=${rcUnifiedCrmExtJwt}&phoneNumber=${phoneNumber}&overridingFormat=${overridingFormats.toString()}&isExtension=${isExtensionNumber}`);
        if (!isForContactMatchEvent) {
            let tempContactMatchTask = {};
            tempContactMatchTask[`tempContactMatchTask-${phoneNumber}`] = [...contactRes.data.contact.filter(c => !c.isNewContact)];
            await chrome.storage.local.set({ ...tempContactMatchTask });
            // force trigger contact matcher
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-trigger-contact-match',
                phoneNumbers: [phoneNumber],
            }, '*');
        }
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
        let tempContactMatchTask = {};
        tempContactMatchTask[`tempContactMatchTask-${phoneNumber}`] = [
            {
                id: contactRes.data.contact.id,
                phone: phoneNumber,
                name: newContactName,
                type: newContactType,
                additionalInfo: contactRes.data.contact.additionalInfo ?? null
            }];
        await chrome.storage.local.set({ ...tempContactMatchTask });
        // force trigger contact matcher
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-trigger-contact-match',
            phoneNumbers: [phoneNumber],
        }, '*');
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

async function openContactPage({ manifest, platformName, phoneNumber, contactId, contactType, multiContactMatchBehavior, fromCallPop = false }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    let platformInfo = await chrome.storage.local.get('platform-info');
    if (platformInfo['platform-info'].hostname === 'temp') {
        const hostnameRes = await axios.get(`${manifest.serverUrl}/hostname?jwtToken=${rcUnifiedCrmExtJwt}`);
        platformInfo['platform-info'].hostname = hostnameRes.data;
        await chrome.storage.local.set(platformInfo);
    }
    const hostname = platformInfo['platform-info'].hostname;
    const isKnownContact = !!contactId;
    let cachedContacts = [];
    if (!!!contactId) {
        cachedContacts = getLocalCachedContact({ phoneNumber, platformName });
        if (cachedContacts.length > 0) {
            contactId = cachedContacts[0].id;
            contactType = cachedContacts[0].type;
        }
    }
    // case: single contact with id
    if (isKnownContact || (cachedContacts.length == 1 && !!contactId)) {
        showNotification({ level: 'success', message: 'Trying to find and open contact page...', ttl: 5000 });
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
            let targetUrlTemplate = manifest.platforms[platformName].contactPageUrl;
            if (fromCallPop && !!manifest.platforms[platformName].callPopUrl) {
                targetUrlTemplate = manifest.platforms[platformName].callPopUrl;
            }
            const contactPageUrl = targetUrlTemplate
                .replace('{hostname}', hostname)
                .replaceAll('{contactId}', contactId)
                .replaceAll('{contactType}', contactType);
            window.open(contactPageUrl);
            return;
        }
    }
    // case: multi contacts
    else {
        const { matched: contactMatched, contactInfo } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber });
        if (!contactMatched) {
            return;
        }
        const isMultipleContact = contactInfo.filter(c => !c.isNewContact).length > 1;
        if (isMultipleContact) {
            if (!!!multiContactMatchBehavior) {
                return;
            }
            switch (multiContactMatchBehavior) {
                case 'disabled':
                    // do nothing
                    return;
                case 'openAllMatches':
                    // proceed and open all matches
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
                    }
                    else {
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
                    break;
                case 'promptToSelect':
                    // open prompt page
                    const multiContactPopPromptPageRender = multiContactPopPromptPage.getMultiContactPopPromptPageRender({ contactInfo: contactInfo.filter(c => !c.isNewContact) });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: multiContactPopPromptPageRender
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-navigate-to',
                        path: `/customized/${multiContactPopPromptPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
                    }, '*');
                    // minimize inbound call modal if in Ringing state if exist
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-control-call',
                        callAction: 'toggleRingingDialog',
                    }, '*');
                    break;
            }
        }
        showNotification({ level: 'success', message: 'Trying to find and open contact page...', ttl: 5000 });
    }
}

function refreshContactPromptPage({ contactInfo, searchWord }) {
    // refresh prompt page
    const multiContactPopPromptPageRender = multiContactPopPromptPage.getMultiContactPopPromptPageRender({ contactInfo, searchWord });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: multiContactPopPromptPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${multiContactPopPromptPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
    }, '*');
}

exports.getContact = getContact;
exports.createContact = createContact;
exports.openContactPage = openContactPage;
exports.refreshContactPromptPage = refreshContactPromptPage;