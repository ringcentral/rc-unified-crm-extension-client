import contactCore from '../../../core/contact';
import userCore from '../../../core/user';
import logCore from '../../../core/log';
import calldownPage from '../../../components/calldownPage';
import { isObjectEmpty, showNotification } from '../../../lib/util';
import axios from 'axios';  
import dispositionCore from '../../../core/disposition';
import logPage from '../../../components/logPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, contactPhoneNumber }) {
    const { userSettings } = await chrome.storage.local.get('userSettings');
    let additionalSubmission = {};
    const additionalFields = manifest.platforms[platformName].page?.callLog?.additionalFields ?? [];
    const newContactAdditionalFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
    for (const f of additionalFields.concat(newContactAdditionalFields)) {
        if (data.body.formData[f.const] && data.body.formData[f.const] != "none") {
            additionalSubmission[f.const] = data.body.formData[f.const];
        }
    }
    const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
    const supportDisposition = implementedInterfaces?.upsertCallDisposition;
    switch (data.body.formData.triggerType) {
        // Case 1.1: create log
        case 'createLog':
            let newContactInfo = {};
            if (data.body.formData.contact === 'createNewContact') {
                const createContactResult = await contactCore.createContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: contactPhoneNumber,
                    newContactName: data.body.formData.newContactName,
                    newContactType: data.body.formData.newContactType,
                    additionalSubmission
                });
                newContactInfo = createContactResult.contactInfo;
                const newContactReturnMessage = createContactResult.returnMessage;
                showNotification({ level: newContactReturnMessage?.messageType, message: newContactReturnMessage?.message, ttl: newContactReturnMessage?.ttl, details: newContactReturnMessage?.details });
                if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
                }
            }

            await logCore.addLog(
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
                    returnToHistoryPage: !!data.body.redirect
                });
            // Optional: schedule callback into Call-down after successful log creation
            try {
                if (data.body.formData.scheduleCallback && data.body.formData.callbackDateTime) {
                    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                    const rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
                    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
                    const schedulePayload = {
                        contactId: newContactInfo?.id ?? data.body.formData.contact,
                        contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
                        phoneNumber: contactPhoneNumber,
                        scheduledAt: data.body.formData.callbackDateTime,
                        note: data.body.formData.note ?? ''
                    };
                    await axios.post(`${manifest.serverUrl}/calldown?jwtToken=${rcUnifiedCrmExtJwt}&rcAccountId=${rcAccountId}`, schedulePayload);
                    // Refresh Call-down tab data and badge right after scheduling
                    try {
                        const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, jwtToken: rcUnifiedCrmExtJwt, filterStatus: 'All', userSettings });
                        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                            type: 'rc-adapter-register-customized-page',
                            page: calldownPageRender,
                        }, '*');
                    } catch (e) { /* ignore refresh errors */ }
                }
            } catch (e) { /* ignore scheduling errors to not block logging */ }
            if (supportDisposition && !isObjectEmpty(additionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                await dispositionCore.upsertDisposition({
                    serverUrl: manifest.serverUrl,
                    logType: 'Call',
                    sessionId: data.body.call.sessionId,
                    dispositions: { ...additionalSubmission, note: data.body.formData.note ?? "" }
                });
                // update unlogged call page list
                let { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null });
                if (unloggedCallPageDataCache) {
                    unloggedCallPageDataCache = unloggedCallPageDataCache.filter(c => c.sessionId !== data.body.call.sessionId);
                    const unloggedCallPageRender = logPage.getUnloggedCallPageRender({ unloggedCalls: unloggedCallPageDataCache });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: unloggedCallPageRender
                    });
                    await chrome.storage.local.set({ unloggedCallPageDataCache });
                }
            }
            break;
        // Case 1.2: update log
        case 'editLog':
            await logCore.updateLog({
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                telephonySessionId: data.body.call.telephonySessionId,
                sessionId: data.body.call.sessionId,
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
                isShowNotification: true
            });
            if (supportDisposition && !isObjectEmpty(additionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                await dispositionCore.upsertDisposition({
                    serverUrl: manifest.serverUrl,
                    logType: 'Call',
                    sessionId: data.body.call.sessionId,
                    dispositions: { ...additionalSubmission, note: data.body.formData.note ?? "" }
                });
            }
            break;
    }
}

exports.onEvent = onEvent;