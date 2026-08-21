import { responseMessage, isObjectEmpty, showNotification } from '../../../lib/util';
import logCore from '../../../core/log';
import userCore from '../../../core/user';
import tempLogNotePage from '../../../components/tempLogNotePage';
import {
    extractCallRecord,
    isCallDataComplete,
    resolveCallLogReadiness,
} from '../../../lib/callLogReadiness';

import logFormHandler from './logForm';
import callLogSyncHandler from './callLogSync';
import viewLogHandler from './viewLog';
import createLogHandler from './createLog';

type UnknownRecord = Record<string, any>;

type EventOptions = {
    data: UnknownRecord;
    manifest: UnknownRecord;
    platformInfo?: UnknownRecord;
    platformName: string;
    platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
    return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent(options: EventOptions) {
    const { manifest, platformInfo, platformName, platform } = options;
    let { data } = options;
    if (data.body?.call?.action) {
        const isQueue = await chrome.storage.local.get(`is-call-queue-${data.body.call.sessionId}`) as UnknownRecord;
        if ((data.body.call.result === 'Missed' && isQueue[`is-call-queue-${data.body.call.sessionId}`]?.isQueue) || (data.body.call.delegationType === 'QueueForwarding' && data.body.call.result === 'Answered Elsewhere')) {
            getWidgetFrameWindow().postMessage({
                type: 'rc-adapter-trigger-call-logger-match',
                sessionIds: [data.body.call.sessionId]
            }, '*');
            await chrome.storage.local.set({
                [`is-call-queue-${data.body.call.sessionId}`]: {
                    isQueue: true,
                    warning: 'Answered by someone else',
                    expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                }
            });
            responseMessage(data.requestId, { data: 'ok' });
            if (data.body.redirect) {
                showNotification({ level: 'warning', message: 'Cannot log this call. It is answered by someone else.', ttl: 3000 });
            }
            return;
        }
    }
    if (data.body.call.queueCall) {
        await chrome.storage.local.set({
            [`is-call-queue-${data.body.call.sessionId}`]: {
                isQueue: true,
                expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
            }
        });
        if (data.body?.call?.result === 'Ringing') {
            responseMessage(data.requestId, { data: 'ok' });
            return;
        }
        if (data.body?.call?.telephonyStatus === 'Ringing' && data.body?.call?.result === 'Disconnected') {
            getWidgetFrameWindow().postMessage({
                type: 'rc-adapter-trigger-call-logger-match',
                sessionIds: [data.body.call.sessionId]
            }, '*');
            await chrome.storage.local.set({
                [`is-call-queue-${data.body.call.sessionId}`]: {
                    isQueue: true,
                    warning: 'Answered by someone else',
                    expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                }
            });
            responseMessage(data.requestId, { data: 'ok' });
            if (data.body.redirect) {
                showNotification({ level: 'warning', message: 'Cannot log this call. It is answered by someone else.', ttl: 3000 });
            }
            return;
        }
    }
    const readinessKey = `call-log-data-ready-${data.body.call.sessionId}`;
    const recordingKey = `rec-link-${data.body.call.sessionId}`;
    const storedData = await chrome.storage.local.get([
        'userSettings',
        readinessKey,
        recordingKey,
    ]) as UnknownRecord;
    const userSettings = storedData.userSettings as UnknownRecord;

    if (data.body.redirect && !isCallDataComplete(data.body.call) && typeof RCAdapter.getCallLog === 'function') {
        try {
            const recoveredCall = extractCallRecord(await RCAdapter.getCallLog({ sessionId: data.body.call.sessionId }));
            if (isCallDataComplete(recoveredCall)) {
                data = {
                    ...data,
                    body: {
                        ...data.body,
                        call: { ...data.body.call, ...recoveredCall },
                    },
                };
            }
        }
        catch {
            // Keep the existing preparing-data behavior when recovery is unavailable.
        }
    }

    const isFinalDataResult = data.body.call.action !== undefined;
    const isRecorded = !isObjectEmpty(storedData[recordingKey] ?? {});
    const hasRecording = !!data.body.call.recording?.link;
    const readiness = resolveCallLogReadiness({
        call: data.body.call,
        previousState: storedData[readinessKey],
        explicitlyFinal: isFinalDataResult,
        existingAutoDataReady: isRecorded || !hasRecording,
    });
    await chrome.storage.local.set({
        [readinessKey]: readiness,
    });
    if (userCore.getOneTimeLogSetting(userSettings).value) {
        const readyForCurrentRequest = data.body.redirect
            ? readiness.autoReady || isCallDataComplete(data.body.call)
            : readiness.autoReady;
        if (!readyForCurrentRequest) {
            if (data.body.redirect) {
                showNotification({ level: 'warning', message: 'Call data is not yet ready. Please input your custom note while it is preparing data.', ttl: 3000 });
                const cachedNote = await logCore.getCachedNote({ sessionId: data.body.call.sessionId });
                const tempLogNotePageRender = tempLogNotePage.getTempLogNotePageRender({ sessionId: data.body.call.sessionId, cachedNote });
                getWidgetFrameWindow().postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: tempLogNotePageRender
                });
                getWidgetFrameWindow().postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${tempLogNotePageRender.id}`, // page id
                }, '*');
            }
            responseMessage(data.requestId, { data: 'ok' });
            return;
        }
    }
    let isAutoLog = false;
    const isCallAutoPopup = userCore.getCallPopSetting(userSettings).value;
    // extensions numbers should NOT be logged unless explicitly allowed
    const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
    const isExtensionNumber = data.body.call.direction === 'Inbound' ?
        ((!!data.body.call.from.extensionNumber && !data.body.call.from.phoneNumber) || (data.body.call.from.phoneNumber && data.body.call.from.phoneNumber.length <= 6)) :
        ((!!data.body.call.to.extensionNumber && !data.body.call.to.phoneNumber) || (data.body.call.to.phoneNumber && data.body.call.to.phoneNumber.length <= 6));
    if (!allowExtensionNumberLogging) {
        if (isExtensionNumber) {
            showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
            responseMessage(data.requestId, { data: 'ok' });
            return;
        }
    }

    const contactPhoneNumber = data.body.call.direction === 'Inbound' ?
        (data.body.call.from.phoneNumber ?? data.body.call.from.extensionNumber) :
        (data.body.call.to.phoneNumber ?? data.body.call.to.extensionNumber);

    // If user click, show loading animation
    if (data.body.redirect) {
        window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    }

    let { callLogs: existingCalls } = await logCore.getLog({
        serverUrl: manifest.serverUrl,
        logType: 'Call',
        sessionIds: data.body.call.sessionId,
        requireDetails: false
    }) as { callLogs?: UnknownRecord[] };

    let triggerTypeInUse = data.body.triggerType;
    // Translate: If no existing call log, create condition here to navigate to auto log
    if (userCore.getAutoLogCallSetting(userSettings, false).value && data.body.triggerType === 'callLogSync' && !(existingCalls?.length > 0 && existingCalls[0]?.matched)) {
        triggerTypeInUse = 'createLog';
        isAutoLog = true;
    }

    // Translate: Right after call, once presence update to Disconnect, auto log the call
    if (data.body.triggerType === 'presenceUpdate') {
        if (data.body.call.result === 'Disconnected' || data.body.call.result === 'CallConnected') {
            triggerTypeInUse = 'createLog';
            isAutoLog = true;
        }
        else {
            responseMessage(data.requestId, { data: 'ok' });
            return;
        }
    }

    // Translate: If want to create, but find log already exist, then change to edit
    if (data.body.triggerType === 'createLog' && !!existingCalls && existingCalls.find(l => l.sessionId == data.body.call.sessionId)?.matched) {
        triggerTypeInUse = 'editLog';
    }
    // Cases that don't need to get contact info
    // Case 1: manual log
    // Case 2: call log sync 
    // Case 3: view log
    // Case 4: open log form
    switch (triggerTypeInUse) {
        // Case 1: User manual log via form
        case 'logForm':
            await logFormHandler.onEvent({ data, manifest, platformInfo, platformName, platform, contactPhoneNumber });
            break;
        // Case 2: call log sync
        case 'callLogSync':
            await (callLogSyncHandler as UnknownRecord).onEvent({ data, manifest, platformInfo, platformName, platform, existingCalls });
            break;
        // Case 3: view log page
        case 'viewLog':
            await viewLogHandler.onEvent({ data, manifest, platformInfo, platformName, platform, existingCalls, contactPhoneNumber, userSettings });
            break;
        // Case 4&5: open create&edit form (both share the same form)
        case 'editLog':
            existingCalls = (await logCore.getLog({
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                sessionIds: data.body.call.sessionId,
                requireDetails: true
            }) as { callLogs?: UnknownRecord[] }).callLogs;
            await createLogHandler.onEvent({ data, triggerTypeInUse, manifest, platformInfo, platformName, platform, contactPhoneNumber, userSettings, existingCalls, isAutoLog, isCallAutoPopup, isExtensionNumber });
            break;
        case 'createLog':
            await createLogHandler.onEvent({ data, triggerTypeInUse, manifest, platformInfo, platformName, platform, contactPhoneNumber, userSettings, existingCalls, isAutoLog, isCallAutoPopup, isExtensionNumber });
            break;
    }
    // response to widget
    responseMessage(data.requestId, { data: 'ok' });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export { onEvent };
export default {
    onEvent,
};
