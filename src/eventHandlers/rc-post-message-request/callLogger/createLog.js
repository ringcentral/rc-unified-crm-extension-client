import contactCore from '../../../core/contact';
import { showNotification, responseMessage, isObjectEmpty } from '../../../lib/util';
import logCore from '../../../core/log';
import userCore from '../../../core/user';
import moment from 'moment';
import logPage from '../../../components/logPage';
import dispositionCore from '../../../core/disposition';
import { getLogConflictInfo, logPageFormDataDefaulting, cacheLogPageData, getExistingContacts, resolveEarliestCreatedContact } from '../../../lib/logUtil';
import { CONSTANTS } from '../../../misc/constant';
import { t } from '../../../i18n';

async function onEvent({ data, triggerTypeInUse, manifest, platformInfo, platformName, platform, contactPhoneNumber, userSettings, existingCalls, isAutoLog, isCallAutoPopup, isExtensionNumber }) {
    const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
    const cachedSearchContactKey = `rc-crm-search-contact-${contactPhoneNumber}`;
    const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
    const cachedContacts = storageObj[cachedSearchContactKey] || [];
    if (!callContactMatched) {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        // Unique: Google Sheets
        if (platformName === 'googleSheets') {
            showNotification({ level: callLogContactMatchMessage?.messageType, message: callLogContactMatchMessage?.message, ttl: callLogContactMatchMessage?.ttl, details: callLogContactMatchMessage?.details });
        }
        responseMessage(data.requestId, { data: 'ok' });
        return;
    }
    for (const cachedContact of cachedContacts) {
        if (!callMatchedContact.some(c => c.id === cachedContact.id)) {
            callMatchedContact.unshift(cachedContact);
        }
    }
    let defaultingContact = callMatchedContact?.length > 0 ? callMatchedContact[0] : null;
    if (data.body.call.toNumberEntity) {
        if (callMatchedContact.some(c => c.id == data.body.call.toNumberEntity)) {
            const toNumberEntityContact = callMatchedContact.find(c => c.id == data.body.call.toNumberEntity);
            toNumberEntityContact.toNumberEntity = true;
            defaultingContact = toNumberEntityContact;
        }
    }
    let logInfo = {
        note: '',
        subject: ''
    }
    if (existingCalls && existingCalls.find(l => l.sessionId == data.body.call.sessionId)?.logData) {
        logInfo = existingCalls.find(l => l.sessionId == data.body.call.sessionId).logData;
    }
    else {
        logInfo.note = await logCore.getCachedNote({ sessionId: data.body.call.sessionId }) ?? "";
    }
    let { hasConflict, autoSelectAdditionalSubmission, requireManualDisposition, conflictType } = await getLogConflictInfo({
        platform,
        isAutoLog,
        contactInfo: callMatchedContact,
        logType: 'callLog',
        direction: data.body.call.direction,
        isVoicemail: false
    });

    if (isAutoLog && !isCallAutoPopup) {
        let autoLogConflictWarningMessage = null;
        // Case: auto log but encountering multiple selection that needs user input, so shown as conflicts
        if (hasConflict) {
            // Sub-case: Unknown contact
            if (conflictType === CONSTANTS.UNKNOWN_CONTACT_CONFLICT_TYPE) {
                if (userCore.getUnknownContactPreferenceSetting(userSettings).value === 'createNewPlaceholderContact') {
                    const callerId = data.body.call.direction === 'Inbound' ? data.body.call.from.name : data.body.call.to.name;
                    let newContactName = (callerId ? callerId : '') + ' ' + (data.body.call.direction === 'Inbound' ? data.body.call.from.phoneNumber : data.body.call.to.phoneNumber);
                    newContactName = userCore.getNewContactNamePrefixSetting(userSettings).value + newContactName;
                    const newContactType = userCore.getNewContactTypeSetting(userSettings, platform.contactTypes).value;
                    let additionalSubmission = {};
                    if (platform.page?.newContact?.additionalFields) {
                        const newContactUnderType = callMatchedContact[0].additionalInfo[newContactType];
                        for (const fieldKey of Object.keys(newContactUnderType)) {
                            additionalSubmission[fieldKey] = Array.isArray(newContactUnderType[fieldKey]) ? newContactUnderType[fieldKey][0].const : newContactUnderType[fieldKey];
                        }
                    }
                    const newContactInfo = await contactCore.createContact({
                        serverUrl: manifest.serverUrl,
                        phoneNumber: contactPhoneNumber,
                        newContactName,
                        newContactType,
                        additionalSubmission
                    });
                    defaultingContact = newContactInfo.contactInfo;
                    hasConflict = false;
                }
            }
            else if (conflictType === CONSTANTS.MULTIPLE_CONTACTS_CONFLICT_TYPE) {
                const multipleContactPreference = userCore.getMultipleContactsPreferenceSetting(userSettings).value;
                const existingMatchedContacts = getExistingContacts(callMatchedContact);
                switch (multipleContactPreference) {
                    case 'skipLogging':
                        break;
                    case 'firstAlphabetical':
                        defaultingContact = [...existingMatchedContacts].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))[0];
                        hasConflict = false;
                        break;
                    case 'mostRecentActivity':
                        defaultingContact = [...existingMatchedContacts].sort((a, b) => new Date(b.mostRecentActivityDate) - new Date(a.mostRecentActivityDate))[0];
                        hasConflict = false;
                        break;
                    case 'earliestCreated':
                        {
                            const { contact, missingCreatedDate } = resolveEarliestCreatedContact(callMatchedContact);
                            if (missingCreatedDate) {
                                autoLogConflictWarningMessage = t('notifications.warning.earliestCreatedResolverMissingField');
                                break;
                            }
                            defaultingContact = contact;
                            hasConflict = !defaultingContact;
                        }
                        break;
                }
            }
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            if (hasConflict) {
                if (autoLogConflictWarningMessage) {
                    showNotification({ level: 'warning', message: autoLogConflictWarningMessage, ttl: 5000 });
                }
                else {
                    const conflictLog = {
                        type: 'Call',
                        id: data.body.call.sessionId,
                        phoneNumber: contactPhoneNumber,
                        direction: data.body.call.direction,
                        contactInfo: callMatchedContact ?? [],
                        subject: logInfo.subject,
                        note: logInfo.note,
                        date: moment(data.body.call.startTime).format('MM/DD/YYYY')
                    };
                    const conflictContent = logCore.getConflictContentFromUnresolvedLog(conflictLog);
                    showNotification({ level: 'warning', message: `Call not logged. ${conflictContent.description}. Please log it manually on call history page`, ttl: 5000 });
                }
            }
        }

        // Case: auto log and no conflict, log directly
        if (!hasConflict) {
            logInfo.subject = data.body.call.direction === 'Inbound' ?
                `Inbound Call from ${defaultingContact?.name ?? ''}` :
                `Outbound Call to ${defaultingContact?.name ?? ''}`;
            if (existingCalls?.length > 0 && existingCalls[0]?.matched) {
                // Ensure we get the most recent cached note
                const cachedNote = await logCore.getCachedNote({ sessionId: data.body.call.sessionId });
                const noteToUse = cachedNote || logInfo.note || '';

                await logCore.updateLog({
                    serverUrl: manifest.serverUrl,
                    logType: 'Call',
                    telephonySessionId: data.body.call.telephonySessionId,
                    sessionId: data.body.call.sessionId,
                    subject: logInfo.subject,
                    note: noteToUse,
                    aiNote: data.body.aiNote,
                    transcript: data.body.transcript,
                    startTime: data.body.call.startTime,
                    duration: data.body.call.duration,
                    result: data.body.call.result,
                    direction: data.body.call.direction,
                    from: data.body.call.from,
                    to: data.body.call.to,
                    isShowNotification: true
                });
            }
            else {
                // auto log
                await logCore.addLog(
                    {
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        logInfo: data.body.call,
                        isMain: true,
                        note: logInfo.note,
                        aiNote: data.body.aiNote,
                        transcript: data.body.transcript,
                        subject: logInfo.subject,
                        additionalSubmission: autoSelectAdditionalSubmission,
                        contactId: defaultingContact?.id,
                        contactType: defaultingContact?.type,
                        contactName: defaultingContact?.name
                    });
                const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
                const supportDisposition = implementedInterfaces?.upsertCallDisposition;
                if (supportDisposition && !isObjectEmpty(autoSelectAdditionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                    await dispositionCore.upsertDisposition({
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        sessionId: data.body.call.sessionId,
                        dispositions: { ...autoSelectAdditionalSubmission, note: logInfo.note ?? "" }
                    });
                }
            }
        }
        if (requireManualDisposition) {
            showNotification({ level: 'warning', message: 'Manual disposition might be needed. Please edit logged call to disposition.', ttl: 5000 });
        }
    }
    // Case: auto log OFF and manual -> open log page
    else if (data.body.redirect) {
        let loggedContactId = null;
        const existingCallLogRecord = await chrome.storage.local.get(`rc-crm-call-log-${data.body.call.sessionId}`);
        if (existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`]) {
            loggedContactId = existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`].contact?.id ?? null;
        }
        await cacheLogPageData({
            id: data.body.call.sessionId,
            manifest,
            logType: 'Call',
            triggerType: triggerTypeInUse,
            platformName,
            direction: data.body.call.direction,
            contactInfo: callMatchedContact ?? [],
            logInfo,
            loggedContactId
        });
        const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
        const useContactSearch = implementedInterfaces?.findContactWithName;
        // add your codes here to log call to your service
        let callPage = logPage.getLogPageRender({
            id: data.body.call.sessionId,
            manifest,
            logType: 'Call',
            triggerType: triggerTypeInUse,
            platformName,
            direction: data.body.call.direction,
            contactInfo: callMatchedContact ?? [],
            logInfo,
            loggedContactId,
            contactPhoneNumber,
            useContactSearch
        });

        // create log page defaulting
        if (triggerTypeInUse === 'createLog') {
            // default form value from user settings
            if (data.body.call.direction === 'Inbound') {
                callPage = await logPageFormDataDefaulting({
                    platform,
                    targetPage: callPage,
                    caseType: 'inboundCall',
                    logType: 'callLog'
                });
            }
            if (data.body.call.direction === 'Outbound') {
                callPage = await logPageFormDataDefaulting({
                    platform,
                    targetPage: callPage,
                    caseType: 'outboundCall',
                    logType: 'callLog'
                });
            }
        }
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-update-call-log-page',
            page: callPage,
        }, '*');

        // navigate to call log page
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/log/call/${data.body.call.sessionId}`,
        }, '*');
    }
}

exports.onEvent = onEvent;
