import logCore from '../../../../core/log';
import userCore from '../../../../core/user';
import { responseMessage, isObjectEmpty } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    let callLogMatchData = {};
    let noLocalMatchedSessionIds = [];
    const { userSettings } = await chrome.storage.local.get('userSettings');
    // existingCallLogRecords: call logs in local storage
    const existingCallLogRecords = await chrome.storage.local.get(
        data.body.sessionIds.map(sessionId => `rc-crm-call-log-${sessionId}`)
    );
    for (const sessionId of data.body.sessionIds) {
        // match existing records
        if (existingCallLogRecords[`rc-crm-call-log-${sessionId}`]) {
            callLogMatchData[sessionId] = [{ id: sessionId, note: '', contact: { id: existingCallLogRecords[`rc-crm-call-log-${sessionId}`].contact?.id } }];
        } else {
            // register non-existing records to be checked online
            noLocalMatchedSessionIds.push(sessionId);
        }
    }
    if (noLocalMatchedSessionIds.length > 0) {
        const { successful, callLogs } = await logCore.getLog({ serverUrl: manifest.serverUrl, logType: 'Call', sessionIds: noLocalMatchedSessionIds.toString(), requireDetails: false });
        // Case: no local record, but online DB check says YES
        if (successful) {
            const newLocalMatchedCallLogRecords = {};
            for (const sessionId of noLocalMatchedSessionIds) {
                const correspondingLog = callLogs.find(l => l.sessionId === sessionId);
                // correspondingLog: if matched => exsiting log record in online DB for this sessionId
                if (correspondingLog?.matched) {
                    const localNote = await logCore.getCachedNote({ sessionId });
                    if (localNote) {
                        callLogMatchData[sessionId] = [{ id: sessionId, note: localNote }];
                        // update online record with local note
                        await logCore.updateLog({
                            serverUrl: manifest.serverUrl,
                            logType: 'Call',
                            sessionId,
                            note: localNote
                        })
                    }
                    else {
                        callLogMatchData[sessionId] = [{ id: sessionId, note: '' }];
                    }
                    newLocalMatchedCallLogRecords[`rc-crm-call-log-${sessionId}`] = { logId: correspondingLog.logId, contact: { id: correspondingLog.contact?.id } };
                }
                else {
                    const isCallQueue = await chrome.storage.local.get({ [`is-call-queue-${sessionId}`]: { isQueue: false } });
                    if (isCallQueue[`is-call-queue-${sessionId}`]?.isQueue && isCallQueue[`is-call-queue-${sessionId}`]?.warning) {
                        callLogMatchData[sessionId] = [
                            {
                                type: 'status',
                                status: 'failed',
                                message: isCallQueue[`is-call-queue-${sessionId}`]?.warning
                            }
                        ];
                    }
                }
            }
            await chrome.storage.local.set(newLocalMatchedCallLogRecords);
        }
    }
    if (userCore.getOneTimeLogSetting(userSettings).value) {
        const loggedSessionIds = Object.keys(callLogMatchData);
        for (const sessionId of data.body.sessionIds) {
            if (loggedSessionIds.includes(sessionId)) {
                continue;
            }
            const isCallLogDataReady = await chrome.storage.local.get(`call-log-data-ready-${sessionId}`);
            if (!isObjectEmpty(isCallLogDataReady) && !isCallLogDataReady[`call-log-data-ready-${sessionId}`]?.isReady) {
                callLogMatchData[sessionId] = [
                    {
                        type: 'status',
                        status: 'failed',
                        message: 'preparing data...'
                    }
                ]
            }
        }
    }
    responseMessage(
        data.requestId,
        {
            data: callLogMatchData
        });
}

export default onEvent;