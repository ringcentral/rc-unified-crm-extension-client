import userCore from '../core/user';
import logCore from '../core/log';
import dispositionCore from '../core/disposition';
import contactCore from '../core/contact';
import { showNotification, dismissNotification, isObjectEmpty, getRcAccessToken } from '../lib/util';
import { getLogConflictInfo } from '../lib/logUtil';

async function retroAutoCallLog({
    manifest,
    platformName,
    platform
}) {
    const { isAdmin } = await chrome.storage.local.get({ isAdmin: false });
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} });
    if (userCore.getDisableRetroCallLogSync(userSettings).value) {
        return;
    }
    const { retroAutoCallLogMaxAttempt } = await chrome.storage.local.get({ retroAutoCallLogMaxAttempt: 10 });
    let retroLoggedCount = 0;
    if (retroAutoCallLogMaxAttempt > 0) {
        await chrome.storage.local.set({ retroAutoCallLogMaxAttempt: retroAutoCallLogMaxAttempt - 1 });
        const effectiveTotal = 10;
        let effectiveCount = 0;
        const itemsPerPage = 50;
        const pageNumber = 1;
        const { calls, hasMore } = await RCAdapter.getUnloggedCalls(itemsPerPage, pageNumber)
        const isAutoLog = userCore.getAutoLogCallSetting(userSettings, isAdmin).value;
        const { retroAutoCallLogNotificationId } = await chrome.storage.local.get({ retroAutoCallLogNotificationId: null })
        if (isAutoLog) {
            if (!retroAutoCallLogNotificationId) {
                const newRetroAutoCallLogNotificationId = await showNotification({ level: 'success', message: 'Attempting to sync historical call logs in the background...', ttl: 5000 });
                await chrome.storage.local.set({ retroAutoCallLogNotificationId: newRetroAutoCallLogNotificationId });
            }
            for (const c of calls) {
                if (effectiveCount >= effectiveTotal) {
                    break;
                }
                const contactPhoneNumber = c.direction === 'Inbound' ? c.from.phoneNumber : c.to.phoneNumber;
                const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName });
                if (!callContactMatched) {
                    continue;
                }
                const { hasConflict, autoSelectAdditionalSubmission } = await getLogConflictInfo({
                    platform,
                    isAutoLog,
                    contactInfo: callMatchedContact,
                    logType: 'callLog',
                    direction: c.direction,
                    isVoicemail: false
                });
                if (!hasConflict) {
                    const callLogSubject = c.direction === 'Inbound' ?
                        `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
                        `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
                    const note = await logCore.getCachedNote({ sessionId: c.sessionId });
                    const exsitingLog = await logCore.getLog({
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        sessionIds: c.sessionId,
                        requireDetails: false
                    });
                    if (!!exsitingLog?.callLogs[0] && !exsitingLog.callLogs[0].matched) {
                        await logCore.addLog(
                            {
                                serverUrl: manifest.serverUrl,
                                logType: 'Call',
                                logInfo: c,
                                isMain: true,
                                note,
                                subject: callLogSubject,
                                rcAdditionalSubmission,
                                contactId: callMatchedContact[0]?.id,
                                contactType: callMatchedContact[0]?.type,
                                contactName: callMatchedContact[0]?.name,
                                isShowNotification: false
                            });
                        if (!isObjectEmpty(autoSelectAdditionalSubmission)) {
                            await dispositionCore.upsertDisposition({
                                serverUrl: manifest.serverUrl,
                                logType: 'Call',
                                sessionId: c.sessionId,
                                dispositions: autoSelectAdditionalSubmission,
                                rcAdditionalSubmission
                            });
                        }
                        retroLoggedCount++;
                        effectiveCount++;
                    }
                    else {
                        // force call log matcher check
                        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                            type: 'rc-adapter-trigger-call-logger-match',
                            sessionIds: [exsitingLog.callLogs[0].sessionId]
                        }, '*');
                    }
                }
            }
            if (!hasMore) {
                const { retroAutoCallLogIntervalId } = await chrome.storage.local.get({ retroAutoCallLogIntervalId: null });
                clearInterval(retroAutoCallLogIntervalId);
                dismissNotification({ notificationId: retroAutoCallLogNotificationId });
                showNotification({ level: 'success', message: `Historical call syncing finished. ${retroLoggedCount} call(s) synced.`, ttl: 5000 });
            }
        }
    }
    else {
        const { retroAutoCallLogIntervalId } = await chrome.storage.local.get({ retroAutoCallLogIntervalId: null });
        clearInterval(retroAutoCallLogIntervalId);
        showNotification({ level: 'success', message: `Historical call syncing finished. ${retroLoggedCount} call(s) synced.`, ttl: 5000 });
    }
}

async function forceCallLogMatcherCheck() {
    const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
    const { userSettings } = await chrome.storage.local.get({ userSettings: {} });
    if (!!userSettings?.serverSideLogging?.enable && crmAuthed) {
        // To help with performance, we only check the first 10 calls
        const { calls, hasMore } = await RCAdapter.getUnloggedCalls(10, 1)
        const sessionIds = calls.map(c => c.sessionId);
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-trigger-call-logger-match',
            sessionIds: sessionIds
        }, '*');
    }
}

async function syncCallData({
    manifest,
    dataBody
}) {
    const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} });
    const rcAccessToken = getRcAccessToken();
    const recordingLink = dataBody?.call?.recording?.link;
    // case: with recording link ready, definitely recorded, update with link
    if (recordingLink) {
        console.log('call recording updating...');
        await logCore.updateLog(
            {
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                rcAdditionalSubmission,
                sessionId: dataBody.call.sessionId,
                recordingLink: dataBody.call.recording.link,
                recordingDownloadLink: `${dataBody.call.recording.contentUri}?accessToken=${rcAccessToken}`,
                aiNote: dataBody.aiNote,
                transcript: dataBody.transcript,
                startTime: dataBody.call.startTime,
                duration: dataBody.call.duration,
                result: dataBody.call.result
            });
    }
    // case: no recording link
    else {
        await logCore.updateLog(
            {
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                rcAdditionalSubmission,
                sessionId: dataBody.call.sessionId,
                aiNote: dataBody.aiNote,
                transcript: dataBody.transcript,
                startTime: dataBody.call.startTime,
                duration: dataBody.call.duration,
                result: dataBody.call.result
            });
    }
}

exports.retroAutoCallLog = retroAutoCallLog;
exports.forceCallLogMatcherCheck = forceCallLogMatcherCheck;
exports.syncCallData = syncCallData;