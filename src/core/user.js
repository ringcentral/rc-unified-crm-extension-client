import axios from 'axios';
import { getRcAccessToken, getManifest, getUserReportStats } from '../lib/util';
import adminCore from './admin';
import { getServiceManifest } from '../service/embeddableServices';
import reportPage from '../components/reportPage';

async function preloadUserSettingsFromAdmin({ serverUrl }) {
    const { rcUserInfo } = (await chrome.storage.local.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    try {
        const preloadUserSettingsResponse = await axios.get(`${serverUrl}/user/preloadSettings?rcAccountId=${rcAccountId}`);
        return preloadUserSettingsResponse.data;
    }
    catch (e) {
        console.log(e)
        return null;
    }
}

async function getUserSettingsOnline({ serverUrl }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rcUserInfo } = (await chrome.storage.local.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const getUserSettingsResponse = await axios.get(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccountId=${rcAccountId}`);
    return getUserSettingsResponse.data;
}

async function uploadUserSettings({ serverUrl, userSettings }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
    let userSettingsToUpload = userSettings;
    if (userSettingsToUpload.selectedRegion) {
        userSettingsToUpload.selectedRegion.value = selectedRegion;
    }
    else {
        userSettingsToUpload.selectedRegion = { value: selectedRegion };
    }
    const uploadUserSettingsResponse = await axios.post(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}`,
        {
            userSettings: userSettingsToUpload
        });
    return uploadUserSettingsResponse?.data?.userSettings;
}


async function refreshUserSettings({ changedSettings, isAvoidForceChange = false }) {
    const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
    if (!crmAuthed) {
        return;
    }
    const rcAccessToken = getRcAccessToken();
    const manifest = await getManifest();
    let userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl, rcAccessToken });
    if (changedSettings) {
        for (const k of Object.keys(changedSettings)) {
            if (userSettings[k] === undefined || !userSettings[k].value) {
                userSettings[k] = changedSettings[k];
            }
            else {
                userSettings[k].value = changedSettings[k].value;
            }
        }
    }
    userSettings = await uploadUserSettings({ serverUrl: manifest.serverUrl, userSettings });
    await chrome.storage.local.set({ userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-features-flags',
        chat: getShowChatTabSetting(userSettings).value,
        meetings: getShowMeetingsTabSetting(userSettings).value,
        text: getShowTextTabSetting(userSettings).value,
        fax: getShowFaxTabSetting(userSettings).value,
        voicemail: getShowVoicemailTabSetting(userSettings).value,
        recordings: getShowRecordingsTabSetting(userSettings).value,
        contacts: getShowContactsTabSetting(userSettings).value
    }, '*');
    const autoLogMessagesGroupTrigger = (userSettings?.autoLogSMS?.value ?? false) || (userSettings?.autoLogInboundFax?.value ?? false) || (userSettings?.autoLogOutboundFax?.value ?? false);
    const isServerSideLoggingEnabledForEndUsers = (userSettings?.serverSideLogging?.enable && userSettings?.serverSideLogging?.loggingLevel === 'Account') ?? false;
    RCAdapter.setAutoLog({ call: (userSettings.autoLogCall?.value && !isServerSideLoggingEnabledForEndUsers) ?? false, message: autoLogMessagesGroupTrigger })
    if (!isAvoidForceChange) {
        const showAiAssistantWidgetSetting = getShowAiAssistantWidgetSetting(userSettings);
        const autoStartAiAssistantSetting = getAutoStartAiAssistantSetting(userSettings);
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-update-ai-assistant-settings',
            showAiAssistantWidget: showAiAssistantWidgetSetting?.value ?? false,
            showAiAssistantWidgetReadOnly: showAiAssistantWidgetSetting?.readOnly ?? false,
            showAiAssistantWidgetReadOnlyReason: showAiAssistantWidgetSetting?.readOnlyReason ?? '',
            autoStartAiAssistant: autoStartAiAssistantSetting?.value ?? false,
            autoStartAiAssistantReadOnly: autoStartAiAssistantSetting?.readOnly ?? false,
            autoStartAiAssistantReadOnlyReason: autoStartAiAssistantSetting?.readOnlyReason ?? '',
        }, '*');
    }
    const notificationLevelSetting = getNotificationLevelSetting(userSettings).value;
    await chrome.storage.local.set({ notificationLevelSetting });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await getServiceManifest())
    }, '*');
    // custom tabs
    const reportPageRender = reportPage.getReportsPageRender({ userStats: null, userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: reportPageRender,
    }, '*');
    return userSettings;
}

async function updateSSCLToken({ serverUrl, platform, token }) {
    const userSettings = await getUserSettingsOnline({ serverUrl, rcAccessToken: getRcAccessToken() });
    const serverSideLoggingEnabled = userSettings?.serverSideLogging?.enable ?? false;
    if (serverSideLoggingEnabled && token !== undefined) {
        const serverSideLoggingToken = await adminCore.authServerSideLogging({ platform });
        const updateSSCLTokenResponse = await axios.post(
            `${platform.serverSideLogging.url}/update-crm-token`,
            {
                crmToken: token,
                crmPlatform: platform.name,
                crmAdapterUrl: serverUrl
            },
            {
                headers: {
                    Accept: 'application/json',
                    'X-Access-Token': serverSideLoggingToken
                }
            }
        );
    }
}

function getAutoLogCallSetting(userSettings, isAdmin) {
    const serverSideLoggingEnabled = userSettings?.serverSideLogging?.enable ?? false;
    if (serverSideLoggingEnabled && (userSettings?.serverSideLogging?.loggingLevel === 'Account' || isAdmin)) {
        return {
            value: false,
            readOnly: true,
            readOnlyReason: 'This cannot be turn ON becauase server side logging is enabled by admin',
            warning: 'Unavailable while server side call logging enabled'
        }
    }
    return {
        value: userSettings?.autoLogCall?.value ?? false,
        readOnly: userSettings?.autoLogCall?.customizable === undefined ? false : !userSettings?.autoLogCall?.customizable,
        readOnlyReason: !userSettings?.autoLogCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoLogSMSSetting(userSettings) {
    return {
        value: userSettings?.autoLogSMS?.value ?? false,
        readOnly: userSettings?.autoLogSMS?.customizable === undefined ? false : !userSettings?.autoLogSMS?.customizable,
        readOnlyReason: !userSettings?.autoLogSMS?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoLogInboundFaxSetting(userSettings) {
    return {
        value: userSettings?.autoLogInboundFax?.value ?? false,
        readOnly: userSettings?.autoLogInboundFax?.customizable === undefined ? false : !userSettings?.autoLogInboundFax?.customizable,
        readOnlyReason: !userSettings?.autoLogInboundFax?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoLogOutboundFaxSetting(userSettings) {
    return {
        value: userSettings?.autoLogOutboundFax?.value ?? false,
        readOnly: userSettings?.autoLogOutboundFax?.customizable === undefined ? false : !userSettings?.autoLogOutboundFax?.customizable,
        readOnlyReason: !userSettings?.autoLogOutboundFax?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getEnableRetroCallLogSync(userSettings) {
    return {
        value: userSettings?.enableRetroCallLogSync?.value ?? true,
        readOnly: userSettings?.enableRetroCallLogSync?.customizable === undefined ? false : !userSettings?.enableRetroCallLogSync?.customizable,
        readOnlyReason: !userSettings?.enableRetroCallLogSync?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getOneTimeLogSetting(userSettings) {
    return {
        value: userSettings?.oneTimeLog?.value ?? false,
        readOnly: userSettings?.oneTimeLog?.customizable === undefined ? false : !userSettings?.oneTimeLog?.customizable,
        readOnlyReason: !userSettings?.oneTimeLog?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getCallPopSetting(userSettings) {
    return {
        value: userSettings?.popupLogPageAfterCall?.value ?? false,
        readOnly: userSettings?.popupLogPageAfterCall?.customizable === undefined ? false : !userSettings?.popupLogPageAfterCall?.customizable,
        readOnlyReason: !userSettings?.popupLogPageAfterCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getSMSPopSetting(userSettings) {
    return {
        value: userSettings?.popupLogPageAfterSMS?.value ?? false,
        readOnly: userSettings?.popupLogPageAfterSMS?.customizable === undefined ? false : !userSettings?.popupLogPageAfterSMS?.customizable,
        readOnlyReason: !userSettings?.popupLogPageAfterSMS?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getIncomingCallPop(userSettings) {
    return {
        value: userSettings?.openContactPageFromIncomingCall?.value ?? 'disabled',
        readOnly: userSettings?.openContactPageFromIncomingCall?.customizable === undefined ? false : !userSettings?.openContactPageFromIncomingCall?.customizable,
        readOnlyReason: !userSettings?.openContactPageFromIncomingCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getOutgoingCallPop(userSettings) {
    return {
        value: userSettings?.openContactPageFromOutgoingCall?.value ?? 'disabled',
        readOnly: userSettings?.openContactPageFromOutgoingCall?.customizable === undefined ? false : !userSettings?.openContactPageFromOutgoingCall?.customizable,
        readOnlyReason: !userSettings?.openContactPageFromOutgoingCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getCallPopMultiMatchBehavior(userSettings) {
    return {
        value: userSettings?.multiContactMatchBehavior?.value ?? 'openAllMatches',
        readOnly: userSettings?.multiContactMatchBehavior?.customizable === undefined ? false : !userSettings?.multiContactMatchBehavior?.customizable,
        readOnlyReason: !userSettings?.multiContactMatchBehavior?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getOpenContactAfterCreationSetting(userSettings) {
    return {
        value: userSettings?.openContactAfterCreatingIt?.value ?? false,
        readOnly: userSettings?.openContactAfterCreatingIt?.customizable === undefined ? false : !userSettings?.openContactAfterCreatingIt?.customizable,
        readOnlyReason: !userSettings?.openContactAfterCreatingIt?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getDeveloperModeSetting(userSettings, developerModeLocal) {
    return {
        value: (userSettings?.developerMode?.value || developerModeLocal) ?? false,
        readOnly: userSettings?.developerMode?.customizable === undefined ? false : !userSettings?.developerMode?.customizable,
        readOnlyReason: !userSettings?.developerMode?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoOpenSetting(userSettings) {
    return {
        value: userSettings?.autoOpenExtension?.value ?? false,
        readOnly: userSettings?.autoOpenExtension?.customizable === undefined ? false : !userSettings?.autoOpenExtension?.customizable,
        readOnlyReason: !userSettings?.autoOpenExtension?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowAiAssistantWidgetSetting(userSettings) {
    return {
        value: userSettings?.showAiAssistantWidget?.value ?? false,
        readOnly: userSettings?.showAiAssistantWidget?.customizable === undefined ? false : !userSettings?.showAiAssistantWidget?.customizable,
        readOnlyReason: !userSettings?.showAiAssistantWidget?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoStartAiAssistantSetting(userSettings) {
    return {
        value: userSettings?.autoStartAiAssistant?.value ?? false,
        readOnly: userSettings?.autoStartAiAssistant?.customizable === undefined ? false : !userSettings?.autoStartAiAssistant?.customizable,
        readOnlyReason: !userSettings?.autoStartAiAssistant?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowChatTabSetting(userSettings) {
    return {
        value: userSettings?.showChatTab?.value ?? true,
        readOnly: userSettings?.showChatTab?.customizable === undefined ? false : !userSettings?.showChatTab?.customizable,
        readOnlyReason: !userSettings?.showChatTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowMeetingsTabSetting(userSettings) {
    return {
        value: userSettings?.showMeetingsTab?.value ?? true,
        readOnly: userSettings?.showMeetingsTab?.customizable === undefined ? false : !userSettings?.showMeetingsTab?.customizable,
        readOnlyReason: !userSettings?.showMeetingsTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowTextTabSetting(userSettings) {
    return {
        value: userSettings?.showTextTab?.value ?? true,
        readOnly: userSettings?.showTextTab?.customizable === undefined ? false : !userSettings?.showTextTab?.customizable,
        readOnlyReason: !userSettings?.showTextTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowFaxTabSetting(userSettings) {
    return {
        value: userSettings?.showFaxTab?.value ?? true,
        readOnly: userSettings?.showFaxTab?.customizable === undefined ? false : !userSettings?.showFaxTab?.customizable,
        readOnlyReason: !userSettings?.showFaxTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowVoicemailTabSetting(userSettings) {
    return {
        value: userSettings?.showVoicemailTab?.value ?? true,
        readOnly: userSettings?.showVoicemailTab?.customizable === undefined ? false : !userSettings?.showVoicemailTab?.customizable,
        readOnlyReason: !userSettings?.showVoicemailTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowRecordingsTabSetting(userSettings) {
    return {
        value: userSettings?.showRecordingsTab?.value ?? true,
        readOnly: userSettings?.showRecordingsTab?.customizable === undefined ? false : !userSettings?.showRecordingsTab?.customizable,
        readOnlyReason: !userSettings?.showRecordingsTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowContactsTabSetting(userSettings) {
    return {
        value: userSettings?.showContactsTab?.value ?? true,
        readOnly: userSettings?.showContactsTab?.customizable === undefined ? false : !userSettings?.showContactsTab?.customizable,
        readOnlyReason: !userSettings?.showContactsTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowUserReportTabSetting(userSettings) {
    return {
        value: userSettings?.showUserReportTab?.value ?? true,
        readOnly: userSettings?.showUserReportTab?.customizable === undefined ? false : !userSettings?.showUserReportTab?.customizable,
        readOnlyReason: !userSettings?.showUserReportTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getClickToDialEmbedMode(userSettings) {
    return {
        value: userSettings?.clickToDialEmbedMode?.value ?? 'crmOnly',
        readOnly: userSettings?.clickToDialEmbedMode?.customizable === undefined ? false : !userSettings?.clickToDialEmbedMode?.customizable,
        readOnlyReason: !userSettings?.clickToDialEmbedMode?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getClickToDialUrls(userSettings) {
    return {
        value: (!userSettings?.clickToDialUrls?.value || userSettings?.clickToDialUrls?.value === '') ? [] : userSettings?.clickToDialUrls?.value,
        readOnly: userSettings?.clickToDialUrls?.customizable === undefined ? false : !userSettings?.clickToDialUrls?.customizable,
        readOnlyReason: !userSettings?.clickToDialUrls?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getQuickAccessButtonEmbedMode(userSettings) {
    return {
        value: userSettings?.quickAccessButtonEmbedMode?.value ?? 'crmOnly',
        readOnly: userSettings?.quickAccessButtonEmbedMode?.customizable === undefined ? false : !userSettings?.quickAccessButtonEmbedMode?.customizable,
        readOnlyReason: !userSettings?.quickAccessButtonEmbedMode?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getQuickAccessButtonUrls(userSettings) {
    return {
        value: (!userSettings?.quickAccessButtonUrls?.value || userSettings?.quickAccessButtonUrls?.value === '') ? [] : userSettings?.quickAccessButtonUrls?.value,
        readOnly: userSettings?.quickAccessButtonUrls?.customizable === undefined ? false : !userSettings?.quickAccessButtonUrls?.customizable,
        readOnlyReason: !userSettings?.quickAccessButtonUrls?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getNotificationLevelSetting(userSettings) {
    return {
        value: userSettings?.notificationLevelSetting?.value ?? ['success', 'warning', 'error'],
        readOnly: userSettings?.notificationLevelSetting?.customizable === undefined ? false : !userSettings?.notificationLevelSetting?.customizable,
        readOnlyReason: !userSettings?.notificationLevelSetting?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogNoteSetting(userSettings) {
    return {
        value: userSettings?.addCallLogNote?.value ?? true,
        readOnly: userSettings?.addCallLogNote?.customizable === undefined ? false : !userSettings?.addCallLogNote?.customizable,
        readOnlyReason: !userSettings?.addCallLogNote?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallSessionIdSetting(userSettings) {
    return {
        value: userSettings?.addCallSessionId?.value ?? false,
        readOnly: userSettings?.addCallSessionId?.customizable === undefined ? false : !userSettings?.addCallSessionId?.customizable,
        readOnlyReason: !userSettings?.addCallSessionId?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddRingCentralUserNameSetting(userSettings) {
    return {
        value: userSettings?.addRingCentralUserName?.value ?? false,
        readOnly: userSettings?.addRingCentralUserName?.customizable === undefined ? false : !userSettings?.addRingCentralUserName?.customizable,
        readOnlyReason: !userSettings?.addRingCentralUserName?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddRingCentralNumberSetting(userSettings) {
    return {
        value: userSettings?.addRingCentralNumber?.value ?? false,
        readOnly: userSettings?.addRingCentralNumber?.customizable === undefined ? false : !userSettings?.addRingCentralNumber?.customizable,
        readOnlyReason: !userSettings?.addRingCentralNumber?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogSubjectSetting(userSettings) {
    return {
        value: userSettings?.addCallLogSubject?.value ?? true,
        readOnly: userSettings?.addCallLogSubject?.customizable === undefined ? false : !userSettings?.addCallLogSubject?.customizable,
        readOnlyReason: !userSettings?.addCallLogSubject?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogContactNumberSetting(userSettings) {
    return {
        value: userSettings?.addCallLogContactNumber?.value ?? true,
        readOnly: userSettings?.addCallLogContactNumber?.customizable === undefined ? false : !userSettings?.addCallLogContactNumber?.customizable,
        readOnlyReason: !userSettings?.addCallLogContactNumber?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogDateTimeSetting(userSettings) {
    return {
        value: userSettings?.addCallLogDateTime?.value ?? true,
        readOnly: userSettings?.addCallLogDateTime?.customizable === undefined ? false : !userSettings?.addCallLogDateTime?.customizable,
        readOnlyReason: !userSettings?.addCallLogDateTime?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getLogDateFormatSetting(userSettings) {
    return {
        value: userSettings?.logDateFormat?.value ?? 'YYYY-MM-DD hh:mm:ss A',
        readOnly: userSettings?.logDateFormat?.customizable === undefined ? false : !userSettings?.logDateFormat?.customizable,
        readOnlyReason: !userSettings?.logDateFormat?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogDurationSetting(userSettings) {
    return {
        value: userSettings?.addCallLogDuration?.value ?? true,
        readOnly: userSettings?.addCallLogDuration?.customizable === undefined ? false : !userSettings?.addCallLogDuration?.customizable,
        readOnlyReason: !userSettings?.addCallLogDuration?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogResultSetting(userSettings) {
    return {
        value: userSettings?.addCallLogResult?.value ?? true,
        readOnly: userSettings?.addCallLogResult?.customizable === undefined ? false : !userSettings?.addCallLogResult?.customizable,
        readOnlyReason: !userSettings?.addCallLogResult?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogRecordingSetting(userSettings) {
    return {
        value: userSettings?.addCallLogRecording?.value ?? true,
        readOnly: userSettings?.addCallLogRecording?.customizable === undefined ? false : !userSettings?.addCallLogRecording?.customizable,
        readOnlyReason: !userSettings?.addCallLogRecording?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAddCallLogAiNoteSetting(userSettings) {
    return {
        value: userSettings?.addCallLogAiNote?.value ?? true,
        readOnly: userSettings?.addCallLogAiNote?.customizable === undefined ? false : !userSettings?.addCallLogAiNote?.customizable,
        readOnlyReason: !userSettings?.addCallLogAiNote?.customizable ? 'This setting is managed by admin' : ''
    }
}
function getAddCallLogTranscriptSetting(userSettings) {
    return {
        value: userSettings?.addCallLogTranscript?.value ?? true,
        readOnly: userSettings?.addCallLogTranscript?.customizable === undefined ? false : !userSettings?.addCallLogTranscript?.customizable,
        readOnlyReason: !userSettings?.addCallLogTranscript?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getUnknownContactPreferenceSetting(userSettings) {
    return {
        value: userSettings?.unknownContactPreference?.value ?? 'skipLogging',
        readOnly: userSettings?.unknownContactPreference?.customizable === undefined ? false : !userSettings?.unknownContactPreference?.customizable,
        readOnlyReason: !userSettings?.unknownContactPreference?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getMultipleContactsPreferenceSetting(userSettings) {
    return {
        value: userSettings?.multipleContactsPreference?.value ?? 'skipLogging',
        readOnly: userSettings?.multipleContactsPreference?.customizable === undefined ? false : !userSettings?.multipleContactsPreference?.customizable,
        readOnlyReason: !userSettings?.multipleContactsPreference?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getNewContactTypeSetting(userSettings, contactTypes) {
    return {
        value: userSettings?.newContactType?.value ?? null,
        readOnly: userSettings?.newContactType?.customizable === undefined ? false : !userSettings?.newContactType?.customizable,
        readOnlyReason: !userSettings?.newContactType?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getNewContactNamePrefixSetting(userSettings) {
    return {
        value: userSettings?.newContactNamePrefix?.value ?? 'PlaceholderContact',
        readOnly: userSettings?.newContactNamePrefix?.customizable === undefined ? false : !userSettings?.newContactNamePrefix?.customizable,
        readOnlyReason: !userSettings?.newContactNamePrefix?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getCustomSetting(userSettings, id, defaultValue) {
    if (userSettings === undefined) {
        return {
            value: null,
            readOnly: false,
            readOnlyReason: ''
        };
    }
    return {
        value: userSettings[id]?.value ?? defaultValue,
        readOnly: userSettings[id]?.customizable === undefined ? false : !userSettings[id]?.customizable,
        readOnlyReason: !userSettings[id]?.customizable ? 'This setting is managed by admin' : '',
        options: userSettings[id]?.options ?? []
    }
}

exports.preloadUserSettingsFromAdmin = preloadUserSettingsFromAdmin;
exports.getUserSettingsOnline = getUserSettingsOnline;
exports.uploadUserSettings = uploadUserSettings;
exports.refreshUserSettings = refreshUserSettings;
exports.updateSSCLToken = updateSSCLToken;

exports.getAutoLogCallSetting = getAutoLogCallSetting;
exports.getAutoLogSMSSetting = getAutoLogSMSSetting;
exports.getAutoLogInboundFaxSetting = getAutoLogInboundFaxSetting;
exports.getAutoLogOutboundFaxSetting = getAutoLogOutboundFaxSetting;
exports.getEnableRetroCallLogSync = getEnableRetroCallLogSync;
exports.getOneTimeLogSetting = getOneTimeLogSetting;
exports.getCallPopSetting = getCallPopSetting;
exports.getSMSPopSetting = getSMSPopSetting;
exports.getIncomingCallPop = getIncomingCallPop;
exports.getOutgoingCallPop = getOutgoingCallPop;
exports.getCallPopMultiMatchBehavior = getCallPopMultiMatchBehavior;
exports.getOpenContactAfterCreationSetting = getOpenContactAfterCreationSetting;
exports.getDeveloperModeSetting = getDeveloperModeSetting;
exports.getAutoOpenSetting = getAutoOpenSetting;
exports.getShowAiAssistantWidgetSetting = getShowAiAssistantWidgetSetting;
exports.getAutoStartAiAssistantSetting = getAutoStartAiAssistantSetting;
exports.getShowChatTabSetting = getShowChatTabSetting;
exports.getShowMeetingsTabSetting = getShowMeetingsTabSetting;
exports.getShowTextTabSetting = getShowTextTabSetting;
exports.getShowFaxTabSetting = getShowFaxTabSetting;
exports.getShowVoicemailTabSetting = getShowVoicemailTabSetting;
exports.getShowRecordingsTabSetting = getShowRecordingsTabSetting;
exports.getShowContactsTabSetting = getShowContactsTabSetting;  
exports.getShowUserReportTabSetting = getShowUserReportTabSetting;
exports.getClickToDialEmbedMode = getClickToDialEmbedMode;
exports.getClickToDialUrls = getClickToDialUrls;
exports.getQuickAccessButtonEmbedMode = getQuickAccessButtonEmbedMode;
exports.getQuickAccessButtonUrls = getQuickAccessButtonUrls;
exports.getNotificationLevelSetting = getNotificationLevelSetting;

exports.getAddCallLogNoteSetting = getAddCallLogNoteSetting;
exports.getAddCallSessionIdSetting = getAddCallSessionIdSetting;
exports.getAddRingCentralUserNameSetting = getAddRingCentralUserNameSetting;
exports.getAddRingCentralNumberSetting = getAddRingCentralNumberSetting;
exports.getAddCallLogSubjectSetting = getAddCallLogSubjectSetting;
exports.getAddCallLogContactNumberSetting = getAddCallLogContactNumberSetting;
exports.getAddCallLogDateTimeSetting = getAddCallLogDateTimeSetting;
exports.getLogDateFormatSetting = getLogDateFormatSetting;
exports.getAddCallLogDurationSetting = getAddCallLogDurationSetting;
exports.getAddCallLogResultSetting = getAddCallLogResultSetting;
exports.getAddCallLogRecordingSetting = getAddCallLogRecordingSetting;
exports.getAddCallLogAiNoteSetting = getAddCallLogAiNoteSetting;
exports.getAddCallLogTranscriptSetting = getAddCallLogTranscriptSetting;
exports.getUnknownContactPreferenceSetting = getUnknownContactPreferenceSetting;
exports.getMultipleContactsPreferenceSetting = getMultipleContactsPreferenceSetting;
exports.getNewContactTypeSetting = getNewContactTypeSetting;
exports.getNewContactNamePrefixSetting = getNewContactNamePrefixSetting;

exports.getCustomSetting = getCustomSetting;