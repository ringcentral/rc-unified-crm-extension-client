import userCore from '../core/user';
import logCore from '../core/log';
import contactCore from '../core/contact';
import { showNotification, dismissNotification } from '../lib/util';
import { getLogConflictInfo } from '../lib/logUtil';

async function retroAutoCallLog({
    userSettings,
    isAdmin,
    rcAdditionalSubmission,
    manifest,
    platformName,
    platform
}) {
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
                const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({
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
                                additionalSubmission: autoSelectAdditionalSubmission,
                                rcAdditionalSubmission,
                                contactId: callMatchedContact[0]?.id,
                                contactType: callMatchedContact[0]?.type,
                                contactName: callMatchedContact[0]?.name,
                                userSettings,
                                isShowNotification: false
                            });
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

exports.retroAutoCallLog = retroAutoCallLog;