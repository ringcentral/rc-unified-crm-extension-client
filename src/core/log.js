import axios from 'axios';
import moment from 'moment';
import { isObjectEmpty, showNotification } from '../lib/util';
import { trackSyncCallLog, trackSyncMessageLog } from '../lib/analytics';

// Input {id} = sessionId from RC
async function addLog({ serverUrl, logType, logInfo, isMain, subject, note, additionalSubmission, contactId, contactType, contactName, isShowNotification = true }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { extensionUserSettings } = await chrome.storage.local.get('extensionUserSettings');
    const overridingPhoneNumberFormat = (!!extensionUserSettings && !isObjectEmpty(extensionUserSettings)) ? (extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat')?.value ?? '') : "";
    if (!!subject) {
        logInfo['customSubject'] = subject;
    }
    if (!!rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const addCallLogRes = await axios.post(`${serverUrl}/callLog?jwtToken=${rcUnifiedCrmExtJwt}`, { logInfo, note, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName });
                if (addCallLogRes.data.successful) {
                    await chrome.storage.local.set({ [`rc-crm-call-log-${logInfo.sessionId}`]: {
                        contact: { id: contactId },
                        logId: addCallLogRes.data.logId,
                    } });
                }
                // force call log matcher check
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-call-logger-match',
                    sessionIds: [logInfo.sessionId]
                }, '*');
                if (addCallLogRes.data.successful) {
                    trackSyncCallLog({ hasNote: note !== '' });
                    // check for remaining recording link
                    const recordingSessionId = `rec-link-${logInfo.sessionId}`;
                    const existingCallRecording = await chrome.storage.local.get(recordingSessionId);
                    if (!!existingCallRecording[recordingSessionId]) {
                        if (!logInfo.recording) {
                            await updateLog({ serverUrl, logType: 'Call', sessionId: logInfo.sessionId, recordingLink: existingCallRecording[recordingSessionId].recordingLink });
                        } else {
                            await chrome.storage.local.remove(recordingSessionId);
                        }
                    }
                    await resolveCachedLog({ type: 'Call', id: logInfo.sessionId });
                    if (isShowNotification) {
                        showNotification({ level: addCallLogRes.data.returnMessage?.messageType ?? 'success', message: addCallLogRes.data.returnMessage?.message ?? 'Call log added', ttl: addCallLogRes.data.returnMessage?.ttl ?? 3000 });
                    }
                }
                else {
                    if (isShowNotification) {
                        showNotification({ level: addCallLogRes.data.returnMessage?.messageType ?? 'warning', message: addCallLogRes.data.returnMessage?.message ?? 'Failed to save call log', ttl: addCallLogRes.data.returnMessage?.ttl ?? 3000 });
                    }
                }
                break;
            case 'Message':
                if (!moment(logInfo.creationTime).isSame(new Date(), "day")) {
                    const isLogged = await chrome.storage.local.get(`rc-crm-conversation-log-${logInfo.conversationLogId}`);
                    if (isLogged[`rc-crm-conversation-log-${logInfo.conversationLogId}`]?.logged) {
                        console.log(`skipping logged conversation on date ${logInfo.date}`)
                        break;
                    }
                }
                const messageLogRes = await axios.post(`${serverUrl}/messageLog?jwtToken=${rcUnifiedCrmExtJwt}`, { logInfo, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName });
                if (messageLogRes.data.successful) {
                    if (isMain & messageLogRes.data.logIds.length > 0) {
                        trackSyncMessageLog();
                        let messageLogPrefCache = {};
                        messageLogPrefCache[`rc-crm-conversation-pref-${logInfo.conversationId}`] = {
                            contact: {
                                id: contactId,
                                type: contactType,
                                name: contactName
                            },
                            additionalSubmission
                        };
                        await chrome.storage.local.set(messageLogPrefCache);
                    }
                    if (isShowNotification) {
                        showNotification({ level: messageLogRes.data.returnMessage?.messageType ?? 'success', message: messageLogRes.data.returnMessage?.message ?? 'Message log added', ttl: messageLogRes.data.returnMessage?.ttl ?? 3000 });
                    }
                    await chrome.storage.local.set({ [`rc-crm-conversation-log-${logInfo.conversationLogId}`]: { logged: true } });
                    await resolveCachedLog({ type: 'Message', id: logInfo.conversationId });
                }
                break;
        }
    }
    else {
        showNotification({ level: 'warning', message: 'Please go to Settings and connect to CRM platform', ttl: 3000 });
    }
}

async function getLog({ serverUrl, logType, sessionIds, requireDetails }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (!!rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const callLogRes = await axios.get(`${serverUrl}/callLog?jwtToken=${rcUnifiedCrmExtJwt}&sessionIds=${sessionIds}&requireDetails=${requireDetails}`);
                showNotification({ level: callLogRes.data.returnMessage?.messageType, message: callLogRes.data.returnMessage?.message, ttl: callLogRes.data.returnMessage?.ttl })
                return { successful: callLogRes.data.successful, callLogs: callLogRes.data.logs };
        }
    }
    else {
        return { successful: false, message: 'Please go to Settings and connect to CRM platform' };
    }
}

function openLog({ manifest, platformName, hostname, logId, contactType }) {
    const logPageUrl = manifest.platforms[platformName].logPageUrl
        .replace('{hostname}', hostname)
        .replaceAll('{logId}', logId)
        .replaceAll('{contactType}', contactType);
    window.open(logPageUrl);
}

async function updateLog({ serverUrl, logType, sessionId, recordingLink, subject, note }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (!!rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const patchBody = {
                    sessionId,
                    recordingLink,
                    subject,
                    note
                }
                const callLogRes = await axios.patch(`${serverUrl}/callLog?jwtToken=${rcUnifiedCrmExtJwt}`, patchBody);
                if (callLogRes.data.successful) {
                    if (!!recordingLink) {
                        const recordingSessionId = `rec-link-${sessionId}`;
                        const existingCallRecording = await chrome.storage.local.get(recordingSessionId);
                        if (!!existingCallRecording[recordingSessionId]) {
                            await chrome.storage.local.remove(recordingSessionId);
                        }
                        showNotification({ level: 'success', message: 'Call recording link uploaded.', ttl: 3000 });
                        console.log('call recording update done');
                    }
                    else {
                        showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'success', message: callLogRes.data.returnMessage?.message ?? 'Call log updated', ttl: callLogRes.data.returnMessage?.ttl ?? 3000 });
                    }
                }
        }
    }
}

async function cacheCallNote({ sessionId, note }) {
    let noteToCache = {};
    noteToCache[sessionId] = note;
    await chrome.storage.local.set(noteToCache);
}

async function getCachedNote({ sessionId }) {
    const cachedNote = await chrome.storage.local.get(sessionId);
    if (isObjectEmpty(cachedNote)) {
        return '';
    }
    else {
        return cachedNote[sessionId];
    }
}

async function cacheUnresolvedLog({ type, id, phoneNumber, direction, contactInfo, subject, note, date }) {
    let existingUnresolvedLogs = await chrome.storage.local.get({ unresolvedLogs: {} });
    let log = {
        type,
        phoneNumber,
        direction,
        contactInfo,
        subject,
        note,
        date
    };
    existingUnresolvedLogs.unresolvedLogs[`${type}-${id}`] = log;
    await chrome.storage.local.set(existingUnresolvedLogs);
    console.log(`log cached for ${type}-${id}`);
    return log;
}

async function getLogCache({ cacheId }) {
    const existingUnresolvedLogs = await chrome.storage.local.get({ unresolvedLogs: {} });
    return existingUnresolvedLogs?.unresolvedLogs[cacheId];
}

async function getAllUnresolvedLogs() {
    const existingUnresolvedLogs = await chrome.storage.local.get({ unresolvedLogs: {} });
    return existingUnresolvedLogs.unresolvedLogs;
}

async function resolveCachedLog({ type, id }) {
    let existingUnresolvedLogs = await chrome.storage.local.get({ unresolvedLogs: {} });
    if (!!existingUnresolvedLogs.unresolvedLogs[`${type}-${id}`]) {
        delete existingUnresolvedLogs.unresolvedLogs[`${type}-${id}`];
        await chrome.storage.local.set(existingUnresolvedLogs);
    }
}

function getConflictContentFromUnresolvedLog(log) {
    const isMultipleContact = log.contactInfo.filter(c => !c.isNewContact).length > 1;
    const isNoContact = log.contactInfo.length === 1 && log.contactInfo.some(c => c.isNewContact);
    const contactName = isMultipleContact ? 'Multiple contacts' : log.contactInfo[0].name;
    if (isMultipleContact || isNoContact) {
        return {
            title: `${contactName} ${log?.phoneNumber ? `(${log?.phoneNumber})` : ''}`,
            description: isNoContact ? 'There is no matched contact' : 'There are multiple matched contacts'
        }
    }
    else {
        const multiplAssociations = [];
        const targetContact = log.contactInfo.find(c => !c.isNewContact);
        for (const association of Object.keys(targetContact.additionalInfo)) {
            if (Array.isArray(targetContact.additionalInfo[association]) || targetContact.additionalInfo[association].length > 1) {
                const associationPascalCaseWithSpace = association
                    // insert a space before all caps
                    .replace(/([A-Z])/g, ' $1')
                    // uppercase the first character
                    .replace(/^./, function (str) { return str.toUpperCase(); })
                multiplAssociations.push(associationPascalCaseWithSpace);
            }
        }
        return {
            title: `${contactName} ${log?.phoneNumber ? `(${log?.phoneNumber})` : ''}`,
            description: `There are multiple associated "${multiplAssociations.toString()}".`,
            type: log.type
        }
    }
}

exports.addLog = addLog;
exports.getLog = getLog;
exports.openLog = openLog;
exports.updateLog = updateLog;
exports.cacheCallNote = cacheCallNote;
exports.getCachedNote = getCachedNote;
exports.cacheUnresolvedLog = cacheUnresolvedLog;
exports.getLogCache = getLogCache;
exports.getAllUnresolvedLogs = getAllUnresolvedLogs;
exports.resolveCachedLog = resolveCachedLog;
exports.getConflictContentFromUnresolvedLog = getConflictContentFromUnresolvedLog;