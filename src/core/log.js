import axios from 'axios';
import { isObjectEmpty, showNotification } from '../lib/util';
import { trackSyncCallLog, trackSyncMessageLog } from '../lib/analytics';

// Input {id} = sessionId from RC
async function addLog({ serverUrl, logType, logInfo, isMain, subject, note, aiNote, transcript, additionalSubmission, rcAdditionalSubmission, contactId, contactType, contactName, isShowNotification = true }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    additionalSubmission = { ...additionalSubmission, ...rcAdditionalSubmission };
    const overridingPhoneNumberFormat = [];
    if (!!userSettings?.overridingPhoneNumberFormat?.value) {
        overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat.value);
    }
    if (!!userSettings?.overridingPhoneNumberFormat2?.value) {
        overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat2.value);
    }
    if (!!userSettings?.overridingPhoneNumberFormat3?.value) {
        overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat3.value);
    }

    if (!!subject) {
        logInfo['customSubject'] = subject;
    }
    if (!!rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                // case: if call is recorded and recording is ready
                if (logInfo.recording) {
                    const rcAccessToken = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).access_token;
                    logInfo.recording.downloadUrl = `${logInfo.recording.contentUri}?accessToken=${rcAccessToken}`;
                }
                else {
                    // case: if call is recorded but recording isn't ready, use '(pending...)' as temporary placeholder
                    const hasRecording = await chrome.storage.local.get(`rec-link-${logInfo.sessionId}`);
                    if (!!hasRecording[`rec-link-${logInfo.sessionId}`]) {
                        logInfo.recording = hasRecording[`rec-link-${logInfo.sessionId}`];
                    }
                }
                const addCallLogRes = await axios.post(`${serverUrl}/callLog?jwtToken=${rcUnifiedCrmExtJwt}`, { logInfo, note, aiNote, transcript, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName });
                if (addCallLogRes.data.successful) {
                    trackSyncCallLog({ hasNote: note !== '' });
                    if (isShowNotification) {
                        showNotification({ level: addCallLogRes.data.returnMessage?.messageType ?? 'success', message: addCallLogRes.data.returnMessage?.message ?? 'Call log added', ttl: addCallLogRes.data.returnMessage?.ttl ?? 3000, details: addCallLogRes.data.returnMessage?.details });
                    }
                    await chrome.storage.local.set({
                        [`rc-crm-call-log-${logInfo.sessionId}`]: {
                            contact: { id: contactId },
                            logId: addCallLogRes.data.logId,
                        }
                    });
                }
                else {
                    if (isShowNotification) {
                        showNotification({ level: addCallLogRes.data.returnMessage?.messageType ?? 'warning', message: addCallLogRes.data.returnMessage?.message ?? 'Failed to save call log', ttl: addCallLogRes.data.returnMessage?.ttl ?? 3000, details: addCallLogRes.data.returnMessage?.details });
                    }
                }
                // force call log matcher check
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-call-logger-match',
                    sessionIds: [logInfo.sessionId]
                }, '*');
                break;
            case 'Message':
                const messageLogRes = await axios.post(`${serverUrl}/messageLog?jwtToken=${rcUnifiedCrmExtJwt}`, { logInfo, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName });
                if (messageLogRes.data.successful) {
                    if (isMain & messageLogRes.data.logIds.length > 0) {
                        trackSyncMessageLog();
                        let messageLogPrefCache = {};
                        messageLogPrefCache[`rc-crm-conversation-pref-${logInfo.conversationLogId}`] = {
                            contact: {
                                id: contactId,
                                type: contactType,
                                name: contactName
                            },
                            additionalSubmission
                        };
                        await chrome.storage.local.set(messageLogPrefCache);
                    }
                    if (messageLogRes.data.logIds?.length > 0 && isShowNotification) {
                        showNotification({ level: messageLogRes.data.returnMessage?.messageType ?? 'success', message: messageLogRes.data.returnMessage?.message ?? 'Message log added', ttl: messageLogRes.data.returnMessage?.ttl ?? 3000, details: messageLogRes.data.returnMessage?.details });
                    }
                    await chrome.storage.local.set({ [`rc-crm-conversation-log-${logInfo.conversationLogId}`]: { logged: true } });
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
                showNotification({ level: callLogRes.data.returnMessage?.messageType, message: callLogRes.data.returnMessage?.message, ttl: callLogRes.data.returnMessage?.ttl, details: callLogRes.data.returnMessage?.details });
                return { successful: callLogRes.data.successful, callLogs: callLogRes.data.logs };
        }
    }
    else {
        return { successful: false, message: 'Please go to Settings and connect to CRM platform' };
    }
}

function openLog({ manifest, platformName, hostname, logId, contactType, contactId }) {
    const logPageUrl = manifest.platforms[platformName].logPageUrl
        .replace('{hostname}', hostname)
        .replaceAll('{logId}', logId)
        .replaceAll('{contactId}', contactId)
        .replaceAll('{contactType}', contactType);
    window.open(logPageUrl);
}

async function updateLog({ serverUrl, logType, sessionId, rcAdditionalSubmission, recordingLink, recordingDownloadLink, subject, note, startTime, duration, aiNote, transcript, result, isShowNotification }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (!!rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const patchBody = {
                    sessionId,
                    recordingLink,
                    recordingDownloadLink,
                    subject,
                    note,
                    startTime,
                    duration,
                    aiNote,
                    transcript,
                    result
                }
                const callLogRes = await axios.patch(`${serverUrl}/callLog?jwtToken=${rcUnifiedCrmExtJwt}`, patchBody);
                if (isShowNotification) {
                    if (callLogRes.data.successful) {
                        showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'success', message: callLogRes.data.returnMessage?.message ?? 'Call log updated', ttl: callLogRes.data.returnMessage?.ttl ?? 3000, details: callLogRes.data.returnMessage?.details });
                    }
                    else {
                        showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'warning', message: callLogRes.data.returnMessage?.message ?? 'Call log update failed', ttl: callLogRes.data.returnMessage?.ttl ?? 3000, details: callLogRes.data.returnMessage?.details });
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
exports.getConflictContentFromUnresolvedLog = getConflictContentFromUnresolvedLog;