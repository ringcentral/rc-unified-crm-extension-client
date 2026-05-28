import axios from 'axios';
import { isObjectEmpty, showNotification, getRcAccessToken, getRcInfo } from '../lib/util';
import { trackSyncCallLog, trackSyncMessageLog } from '../lib/analytics';
import { upsertPluginAsyncTaskIds } from '../service/pluginService';
import { t } from '../i18n';

// Input {id} = sessionId from RC
async function addLog({
    serverUrl,
    logType,
    logInfo,
    isMain,
    subject,
    note,
    aiNote,
    transcript,
    contactId,
    contactType,
    contactName,
    additionalSubmission,
    isShowNotification = true
}) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} });
    // eslint-disable-next-line no-param-reassign
    additionalSubmission = { ...additionalSubmission, ...rcAdditionalSubmission };
    const overridingPhoneNumberFormat = [];
    if (userSettings?.overridingPhoneNumberFormat?.value) {
        overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat.value);
    }
    if (userSettings?.overridingPhoneNumberFormat2?.value) {
        overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat2.value);
    }
    if (userSettings?.overridingPhoneNumberFormat3?.value) {
        overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat3.value);
    }

    if (subject) {
        // eslint-disable-next-line no-param-reassign
        logInfo['customSubject'] = subject;
    }
    let addLogRes;
    if (rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                if (!logInfo.recording) {
                const extensionNumber = rcInfo?.value?.cachedData?.extensionInfo?.extensionNumber ?? '';
                    // case: if call is recorded but recording isn't ready, use '(pending...)' as temporary placeholder
                    const hasRecording = await chrome.storage.local.get(`rec-link-${logInfo.sessionId}`);
                    if (hasRecording[`rec-link-${logInfo.sessionId}`]) {
                        // eslint-disable-next-line no-param-reassign
                        logInfo.recording = hasRecording[`rec-link-${logInfo.sessionId}`];
                    }
                }
                addLogRes = await axios.post(`${serverUrl}/callLog`, { logInfo, note, aiNote, transcript, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName, extensionNumber });
                if (addLogRes.data.successful) {
                    trackSyncCallLog({ hasNote: note !== '' });
                    if (addLogRes.data.pluginAsyncTaskIds?.length > 0) {
                        await upsertPluginAsyncTaskIds({ taskIds: addLogRes.data.pluginAsyncTaskIds });
                    }
                    if (isShowNotification) {
                        showNotification({ level: addLogRes.data.returnMessage?.messageType ?? 'success', message: addLogRes.data.returnMessage?.message ?? t('notifications.success.callLogAdded'), ttl: addLogRes.data.returnMessage?.ttl ?? 3000, details: addLogRes.data.returnMessage?.details });
                    }
                    await chrome.storage.local.set({
                        [`rc-crm-call-log-${logInfo.sessionId}`]: {
                            contact: { id: contactId },
                            logId: addLogRes.data.logId,
                        }
                    });
                }
                else {
                    if (isShowNotification) {
                        showNotification({ level: addLogRes.data.returnMessage?.messageType ?? 'warning', message: addLogRes.data.returnMessage?.message ?? t('notifications.warning.callLogFailed'), ttl: addLogRes.data.returnMessage?.ttl ?? 3000, details: addLogRes.data.returnMessage?.details });
                    }
                }
                // force call log matcher check
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-call-logger-match',
                    sessionIds: [logInfo.sessionId]
                }, '*');
                break;
            case 'Message':
                addLogRes = await axios.post(`${serverUrl}/messageLog`, { logInfo, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName });
                if (addLogRes.data.successful) {
                    if (isMain & addLogRes.data.logIds.length > 0) {
                        trackSyncMessageLog();
                        let messageLogPrefCache = {};
                        messageLogPrefCache[`rc-crm-conversation-pref-${logInfo.conversationLogId}`] = {
                            contact: {
                                id: contactId,
                                type: contactType,
                                name: contactName
                            },
                            additionalSubmission: rcAdditionalSubmission
                        };
                        await chrome.storage.local.set(messageLogPrefCache);
                    }
                    if (addLogRes.data.logIds?.length > 0 && isShowNotification) {
                        showNotification({ level: addLogRes.data.returnMessage?.messageType ?? 'success', message: addLogRes.data.returnMessage?.message ?? t('notifications.success.messageLogAdded'), ttl: addLogRes.data.returnMessage?.ttl ?? 3000, details: addLogRes.data.returnMessage?.details });
                    }
                    await chrome.storage.local.set({ [`rc-crm-conversation-log-${logInfo.conversationLogId}`]: { logged: true } });
                }
                break;
        }
    }
    else {
        showNotification({ level: 'warning', message: t('notifications.warning.connectToCrm'), ttl: 3000 });
    }
}

async function getLog({ serverUrl, logType, sessionIds, requireDetails }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const rcInfo = await getRcInfo();
                const extensionNumber = rcInfo?.value?.cachedData?.extensionInfo?.extensionNumber ?? '';
                const callLogRes = await axios.get(`${serverUrl}/callLog?sessionIds=${sessionIds}&requireDetails=${requireDetails}&extensionNumber=${extensionNumber}`);
                showNotification({ level: callLogRes.data.returnMessage?.messageType, message: callLogRes.data.returnMessage?.message, ttl: callLogRes.data.returnMessage?.ttl, details: callLogRes.data.returnMessage?.details });
                return { successful: callLogRes.data.successful, callLogs: callLogRes.data.logs };
        }
    }
    else {
        return { successful: false, message: t('notifications.warning.connectToCrm') };
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

async function updateLog({ serverUrl, logType, telephonySessionId, sessionId, recordingLink, subject, note, startTime, duration, aiNote, transcript, result, direction, from, to, isShowNotification }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} });
    if (rcUnifiedCrmExtJwt) {
        switch (logType) {
            case 'Call':
                const rcInfo = await getRcInfo();
                const extensionNumber = rcInfo?.value?.cachedData?.extensionInfo?.extensionNumber ?? '';
                const patchBody = {
                    telephonySessionId,
                    sessionId,
                    recordingLink,
                    subject,
                    note,
                    startTime,
                    duration,
                    aiNote,
                    transcript,
                    result,
                    direction,
                    from,
                    to,
                    additionalSubmission: rcAdditionalSubmission
                    extensionNumber
                }
                const callLogRes = await axios.patch(`${serverUrl}/callLog`, patchBody);
                if (isShowNotification) {
                    if (callLogRes.data.successful) {
                        if (callLogRes.data.pluginAsyncTaskIds?.length > 0) {
                            await upsertPluginAsyncTaskIds({ taskIds: callLogRes.data.pluginAsyncTaskIds });
                        }
                    }
                    else {
                        showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'warning', message: callLogRes.data.returnMessage?.message ?? t('notifications.warning.callLogUpdateFailed'), ttl: callLogRes.data.returnMessage?.ttl ?? 3000, details: callLogRes.data.returnMessage?.details });
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

async function uploadCacheNote({ serverUrl, sessionId }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const cachedNote = await chrome.storage.local.get(sessionId);
    if (rcUnifiedCrmExtJwt && cachedNote[sessionId]) {
        const postBody = {
            sessionId,
            note: cachedNote[sessionId]
        }
        const postRes = await axios.post(`${serverUrl}/callLog/cacheNote`, postBody);
    }
}

function getConflictContentFromUnresolvedLog(log) {
    const isMultipleContact = log.contactInfo?.filter(c => !c.isNewContact)?.length > 1;
    const isNoContact = log.contactInfo?.filter(c => !c.isNewContact)?.length === 0 && log.contactInfo?.some(c => c.isNewContact);
    const contactName = isMultipleContact ? t('conflicts.multipleContacts') : log.contactInfo.find(c => !c.isNewContact)?.name;
    if (isMultipleContact || isNoContact) {
        return {
            title: contactName ? `${contactName} ${log?.phoneNumber ? `(${log?.phoneNumber})` : ''}` : log?.phoneNumber,
            description: isNoContact ? t('conflicts.noMatchedContact') : t('conflicts.multipleMatchedContacts')
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
            description: t('conflicts.multipleAssociations', { associations: multiplAssociations.toString() }),
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
exports.uploadCacheNote = uploadCacheNote;
exports.getConflictContentFromUnresolvedLog = getConflictContentFromUnresolvedLog;