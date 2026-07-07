// @ts-nocheck
import contactCore from '../../../core/contact';
import { showNotification, responseMessage } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    console.log(`start contact matching for ${data.body.phoneNumbers.length} numbers...`);
    const { userSettings } = await chrome.storage.local.get('userSettings');
    let matchedContacts = {};
    // Case: this is a follow-up contact match event triggered by other functions so to register the matched contacts
    const tempContactMatchTask = (await chrome.storage.local.get(`tempContactMatchTask-${data.body.phoneNumbers[0]}`))[`tempContactMatchTask-${data.body.phoneNumbers[0]}`];
    if (data.body.phoneNumbers.length === 1 && tempContactMatchTask?.length > 0) {
        const cachedMatching = document.querySelector("#rc-widget-adapter-frame").contentWindow.phone.contactMatcher.data[tempContactMatchTask.phone];
        const platformContactMatching = cachedMatching ? cachedMatching[platformName]?.data : [];
        const formattedMactchContacts = tempContactMatchTask.map(c => ({
            id: c.id,
            type: platformName,
            name: c.name,
            phoneNumbers: [
                {
                    phoneNumber: c.phone,
                    phoneType: 'direct'
                }
            ],
            entityType: platformName,
            contactType: c.type,
            createdDate: c.createdDate,
            mostRecentActivityDate: c.mostRecentActivityDate,
            additionalInfo: c.additionalInfo
        }));
        const cachedSearchContactKey = `rc-crm-search-contact-${data.body.phoneNumbers[0]}`;
        const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
        const cachedContacts = storageObj[cachedSearchContactKey] || [];
        for (const cachedContact of cachedContacts) {
            if (!formattedMactchContacts.some(c => c.id === cachedContact.id)) {
                formattedMactchContacts.unshift({
                    id: cachedContact.id,
                    type: platformName,
                    name: cachedContact.name,
                    phoneNumbers: [
                        {
                            phoneNumber: cachedContact.phone,
                            phoneType: 'direct'
                        }
                    ],
                    entityType: platformName,
                    contactType: cachedContact.type,
                    createdDate: cachedContact.createdDate,
                    mostRecentActivityDate: cachedContact.mostRecentActivityDate,
                    additionalInfo: cachedContact.additionalInfo
                });
            }
        }
        matchedContacts[data.body.phoneNumbers[0]] = [
            ...platformContactMatching,
            ...formattedMactchContacts
        ];
        await chrome.storage.local.remove(`tempContactMatchTask-${data.body.phoneNumbers[0]}`);
        console.log('contact match task done.')
    }
    // Case: this is a contact match event triggered as contact match event itself
    else {
        // Segment an array of phone numbers into one at a time. 
        // This is to prevent fetching too many contacts at once and causing timeout.
        const contactPhoneNumber = data.body.phoneNumbers[0];
        const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
        // If it's direct number (starting with +), go ahead
        // If not a direct number, but allow extension number logging, go ahead as well
        if (contactPhoneNumber.startsWith('+') || allowExtensionNumberLogging) {
            // query on 3rd party API to get the matched contact info and return
            const { matched: contactMatched, returnMessage: contactMatchReturnMessage, contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isFromManual: data.body.triggerFrom === 'manual', isExtensionNumber: !contactPhoneNumber.startsWith('+'), isForceRefresh: true, isToTriggerContactMatch: false });
            if (contactMatched) {
                if (!matchedContacts[contactPhoneNumber]) {
                    matchedContacts[contactPhoneNumber] = [];
                }
                if (contactInfo.some(c => !c.isNewContact)) {
                    for (const contactInfoItem of contactInfo) {
                        if (contactInfoItem.isNewContact) {
                            continue;
                        }
                        matchedContacts[contactPhoneNumber].push({
                            id: contactInfoItem.id,
                            type: platformName,
                            name: contactInfoItem.name,
                            phoneNumbers: [
                                {
                                    phoneNumber: contactPhoneNumber,
                                    phoneType: 'direct'
                                }
                            ],
                            entityType: platformName,
                            contactType: contactInfoItem.type,
                            createdDate: contactInfoItem.createdDate,
                            additionalInfo: contactInfoItem.additionalInfo,
                            mostRecentActivityDate: contactInfoItem.mostRecentActivityDate
                        });
                    }
                }
                if (matchedContacts[contactPhoneNumber].length > 0) {
                    console.log(`contact matched for ${contactPhoneNumber}`);
                }
                else {
                    if (data.body.triggerFrom === 'manual') {
                        showNotification({ level: contactMatchReturnMessage?.messageType, message: contactMatchReturnMessage?.message, ttl: contactMatchReturnMessage?.ttl, details: contactMatchReturnMessage?.details });
                    }
                    console.log(`contact not matched for ${contactPhoneNumber}`);
                }
            }
            else {
                if (data.body.triggerFrom === 'manual') {
                    showNotification({ level: contactMatchReturnMessage?.messageType, message: contactMatchReturnMessage?.message, ttl: contactMatchReturnMessage?.ttl, details: contactMatchReturnMessage?.details });
                }
                console.log(`contact not matched for ${contactPhoneNumber}`);
            }
        }
        // After match task done above, re-organize the request so to make it ready for next round
        if (data.body.phoneNumbers.length > 1) {
            const remainingPhoneNumbers = data.body.phoneNumbers.slice(1);
            // Do another contact match with remaining phone numbers
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-trigger-contact-match',
                phoneNumbers: remainingPhoneNumbers,
            }, '*');
        }
    }
    // return matched contact object with phone number as key
    responseMessage(
        data.requestId,
        {
            data: matchedContacts
        }
    );
}

export { onEvent };
export default {
    onEvent,
};
