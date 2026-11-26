import contactCore from '../../../core/contact';
import userCore from '../../../core/user';
import logCore from '../../../core/log';
import calldownPage from '../../../components/calldownPage';
import { isObjectEmpty, showNotification } from '../../../lib/util';
import axios from 'axios';
import dispositionCore, { type UpsertDispositionResult } from '../../../core/disposition';
import logPage from '../../../components/logPage';
import { getCachedLogPageData, getExistingContacts } from '../../../lib/logUtil';
import { hasProvisionalCallSessionId } from '../../../lib/callLogReadiness';
import { t } from '../../../i18n';

type UnknownRecord = Record<string, any>;

type EventOptions = {
    data: UnknownRecord;
    manifest: UnknownRecord;
    platformInfo?: UnknownRecord;
    platformName: string;
    platform: UnknownRecord;
    contactPhoneNumber: string;
    // The call's logs in App Connect, looked up when the form was saved
    existingCalls?: UnknownRecord[];
};

function getWidgetFrameWindow(): Window {
    return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

// The submitted form data normally carries the trigger type this page was
// rendered with. Fall back to the cached page data when the widget reports a
// form that dropped it, so the log is still saved.
async function resolveFormTriggerType(data: UnknownRecord): Promise<string | undefined> {
    if (data.body.formData?.triggerType) {
        return data.body.formData.triggerType;
    }
    const cachedLogPageData = await getCachedLogPageData();
    if (cachedLogPageData?.id === data.body.call?.sessionId) {
        return cachedLogPageData.triggerType;
    }
    return undefined;
}

function isCallLogged(existingCalls: UnknownRecord[] | undefined, sessionId: string): boolean {
    return !!existingCalls?.find(l => l.sessionId == sessionId)?.matched;
}

// App Connect refuses a second log for a session it already logged with this message.
function isExistingLogResult(result: UnknownRecord | undefined): boolean {
    const message = result?.returnMessage?.message;
    return !result?.successful && typeof message === 'string' && message.startsWith('Existing log for session');
}

// A create form saved into a log App Connect already made, such as a RingCX log made by
// server-side logging while the wrap-up form was open, can only update that log's subject and
// note, plus whatever the CRM applies as call dispositions. List the other form choices that
// won't reach the CRM so the agent can be told.
async function getChangesNotSavedToExistingLog({ data, manifest, platformName, dispositionSaved }: {
    data: UnknownRecord;
    manifest: UnknownRecord;
    platformName: string;
    dispositionSaved: boolean;
}): Promise<string[]> {
    const formData = data.body.formData;
    const changes: string[] = [];
    if (formData.contact === 'createNewContact') {
        changes.push(t('notifications.warning.existingLogNewContactNotLinked'));
    }
    else {
        // The log keeps the contact it was made with, which we can't look up here. It matches
        // the agent's choice when the call matched only that one contact.
        const cachedLogPageData = await getCachedLogPageData();
        const matchedContacts = cachedLogPageData?.id === data.body.call.sessionId ?
            getExistingContacts(cachedLogPageData.contactInfo) :
            [];
        if (!(matchedContacts.length === 1 && matchedContacts[0].id == formData.contact)) {
            changes.push(t('notifications.warning.existingLogContactNotChanged'));
        }
    }
    // Custom call log fields reach an existing log only as call dispositions. A CRM can turn
    // down dispositions it has nothing to apply from, such as Clio without a matter.
    if (!dispositionSaved) {
        const callLogFields: UnknownRecord[] = manifest.platforms[platformName].page?.callLog?.additionalFields ?? [];
        const unsavedFieldNames = callLogFields
            .filter(f => formData[f.const] && formData[f.const] != 'none')
            .map(f => f.title ?? f.const);
        if (unsavedFieldNames.length > 0) {
            changes.push(t('notifications.warning.existingLogFieldsNotSaved', { fields: unsavedFieldNames.join(', ') }));
        }
    }
    return changes;
}

function showChangesNotSavedToExistingLog(changes: string[]): void {
    showNotification({
        level: 'warning',
        message: t('notifications.warning.callAlreadyLogged'),
        ttl: 10000,
        details: [{
            title: t('notifications.warning.changesNotSaved'),
            items: changes.map((text, index) => ({ id: String(index + 1), type: 'text', text }))
        }]
    });
}

// The notification logCore.updateLog shows for its result when asked to
function showUpdateResultNotification(saveResult: UnknownRecord | undefined, failedMessage: string): void {
    showNotification({
        level: saveResult?.returnMessage?.messageType ?? (saveResult?.successful ? 'success' : 'warning'),
        message: saveResult?.returnMessage?.message ?? (saveResult?.successful ? t('notifications.success.callLogUpdated') : failedMessage),
        ttl: saveResult?.returnMessage?.ttl ?? 3000,
        details: saveResult?.returnMessage?.details
    });
}

function upsertFormDisposition(data: UnknownRecord, manifest: UnknownRecord, additionalSubmission: UnknownRecord): Promise<UpsertDispositionResult | undefined> {
    return dispositionCore.upsertDisposition({
        serverUrl: manifest.serverUrl,
        logType: 'Call',
        sessionId: data.body.call.sessionId,
        dispositions: { ...additionalSubmission, note: data.body.formData.note ?? "" }
    });
}

function updateLogFromForm(data: UnknownRecord, manifest: UnknownRecord, isShowNotification = true): Promise<UnknownRecord | undefined> {
    return logCore.updateLog({
        serverUrl: manifest.serverUrl,
        logType: 'Call',
        telephonySessionId: data.body.call.telephonySessionId,
        sessionId: data.body.call.sessionId,
        call: data.body.call,
        subject: data.body.formData.activityTitle ?? "",
        note: data.body.formData.note ?? "",
        aiNote: data.body.aiNote,
        transcript: data.body.transcript,
        startTime: data.body.call.startTime,
        duration: data.body.call.duration,
        result: data.body.call.result,
        direction: data.body.call.direction,
        from: data.body.call.from,
        to: data.body.call.to,
        activityCompletionReady: data.body.activityCompletionReady ?? false,
        isShowNotification
    });
}

type LogFormResult = {
    successful: boolean;
    message?: string;
};

async function onEvent({ data, manifest, platformInfo, platformName, platform, contactPhoneNumber, existingCalls }: EventOptions): Promise<LogFormResult> {
    void platformInfo;
    void platform;
    const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
    const additionalSubmission: UnknownRecord = {};
    const additionalFields = manifest.platforms[platformName].page?.callLog?.additionalFields ?? [];
    const newContactAdditionalFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
    for (const f of additionalFields.concat(newContactAdditionalFields)) {
        if (data.body.formData[f.const] && data.body.formData[f.const] != "none") {
            additionalSubmission[f.const] = data.body.formData[f.const];
        }
    }
    const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as { implementedInterfaces?: UnknownRecord | null };
    const supportDisposition = implementedInterfaces?.upsertCallDisposition;
    const shouldSaveDisposition = !!supportDisposition && !isObjectEmpty(additionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value;
    let saveResult: UnknownRecord | undefined;
    let saveFailedMessage = t('notifications.warning.callLogFailed');
    switch (await resolveFormTriggerType(data)) {
        // Case 1.1: create log
        case 'createLog':
            const loggedBeforeSave = isCallLogged(existingCalls, data.body.call.sessionId);
            if (!loggedBeforeSave && hasProvisionalCallSessionId(data.body.call)) {
                const message = t('notifications.warning.provisionalCallSession');
                showNotification({ level: 'warning', message, ttl: 3000 });
                return { successful: false, message };
            }
            let newContactInfo: UnknownRecord = {};
            if (data.body.formData.contact === 'createNewContact') {
                const createContactResult = await contactCore.createContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: contactPhoneNumber,
                    newContactName: data.body.formData.newContactName,
                    newContactType: data.body.formData.newContactType,
                    additionalSubmission
                }) as UnknownRecord;
                newContactInfo = createContactResult.contactInfo;
                const newContactReturnMessage = createContactResult.returnMessage;
                showNotification({ level: newContactReturnMessage?.messageType, message: newContactReturnMessage?.message, ttl: newContactReturnMessage?.ttl, details: newContactReturnMessage?.details });
                if (userCore.getopenContactPageAfterCreationSetting(userSettings).value) {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
                }
            }

            // The call may have been logged after this create form was built, for example by
            // server-side logging when a RingCX call ends while its wrap-up form is open. Save the
            // form into that log then, as the edit form built after logging would.
            if (!loggedBeforeSave) {
                saveResult = await logCore.addLog(
                    {
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        logInfo: data.body.call,
                        isMain: true,
                        note: data.body.formData.note ?? "",
                        aiNote: data.body.aiNote,
                        transcript: data.body.transcript,
                        subject: data.body.formData.activityTitle ?? "",
                        contactId: newContactInfo?.id ?? data.body.formData.contact,
                        contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
                        additionalSubmission,
                        activityCompletionReady: data.body.activityCompletionReady ?? false
                    });
            }
            // Also covers a log made between the lookup above and this save
            const savedIntoExistingLog = loggedBeforeSave || isExistingLogResult(saveResult);
            if (savedIntoExistingLog) {
                saveFailedMessage = t('notifications.warning.callLogUpdateFailed');
                // The update can't change the log's contact or custom fields, and the custom
                // fields reach the log only if the CRM accepts them as dispositions. Hold back the
                // update's notification until we know, so the agent is warned instead of being
                // told the save fully succeeded.
                saveResult = await updateLogFromForm(data, manifest, false);
                const dispositionResult = shouldSaveDisposition ?
                    await upsertFormDisposition(data, manifest, additionalSubmission) :
                    undefined;
                const changesNotSaved = await getChangesNotSavedToExistingLog({
                    data,
                    manifest,
                    platformName,
                    dispositionSaved: !!dispositionResult?.successful
                });
                if (saveResult?.successful && changesNotSaved.length > 0) {
                    showChangesNotSavedToExistingLog(changesNotSaved);
                }
                else {
                    showUpdateResultNotification(saveResult, saveFailedMessage);
                }
            }
            // Optional: schedule callback into Call Back after successful log creation
            try {
                if (data.body.formData.scheduleCallback && data.body.formData.callbackDateTime) {
                    const rcUserInfo = ((await chrome.storage.local.get('rcUserInfo')) as { rcUserInfo?: UnknownRecord }).rcUserInfo;
                    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
                    const schedulePayload = {
                        contactId: newContactInfo?.id ?? data.body.formData.contact,
                        contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
                        phoneNumber: contactPhoneNumber,
                        scheduledAt: data.body.formData.callbackDateTime,
                        note: data.body.formData.note ?? ''
                    };
                    await axios.post(`${manifest.serverUrl}/calldown?rcAccountId=${rcAccountId}`, schedulePayload);
                    // Refresh Call Back tab data and badge right after scheduling
                    try {
                        const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
                        getWidgetFrameWindow().postMessage({
                            type: 'rc-adapter-register-customized-page',
                            page: calldownPageRender,
                        }, '*');
                    } catch (e) { /* ignore refresh errors */ }
                }
            } catch (e) { /* ignore scheduling errors to not block logging */ }
            if (shouldSaveDisposition) {
                // Already saved above for an existing log
                if (!savedIntoExistingLog) {
                    await upsertFormDisposition(data, manifest, additionalSubmission);
                }
                // update unlogged call page list
                let { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null }) as { unloggedCallPageDataCache?: UnknownRecord[] | null };
                if (unloggedCallPageDataCache) {
                    unloggedCallPageDataCache = unloggedCallPageDataCache.filter(c => c.sessionId !== data.body.call.sessionId);
                    const unloggedCallPageRender = logPage.getUnloggedCallPageRender({ unloggedCalls: unloggedCallPageDataCache });
                    getWidgetFrameWindow().postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: unloggedCallPageRender
                    });
                    await chrome.storage.local.set({ unloggedCallPageDataCache });
                }
            }
            break;
        // Case 1.2: update log
        case 'editLog':
            saveFailedMessage = t('notifications.warning.callLogUpdateFailed');
            saveResult = await updateLogFromForm(data, manifest);
            if (shouldSaveDisposition) {
                await upsertFormDisposition(data, manifest, additionalSubmission);
            }
            break;
    }
    if (!saveResult?.successful) {
        return { successful: false, message: saveResult?.returnMessage?.message ?? saveFailedMessage };
    }
    return { successful: true };
}

export { onEvent };
export default {
    onEvent,
};
