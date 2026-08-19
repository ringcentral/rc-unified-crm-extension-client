import axios from 'axios';
import moment from 'moment';
import { getRcAccessToken, refreshRCToken } from '../lib/util';
import { getManifest as getManifestBase } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import adminCore from './admin';
import embeddableServices from '../service/embeddableServices';
import reportPage from '../components/reportPage/reportPage';
import calldownPage from '../components/calldownPage';
import { RcAPI } from '../lib/rcAPI';

type UnknownRecord = Record<string, any>;

declare const RCAdapter: UnknownRecord;

const chromeStorageLocal = chrome.storage.local as any;

async function getManifest(): Promise<UnknownRecord> {
    return (await getManifestBase()) as UnknownRecord;
}

function getWidgetFrame(): UnknownRecord {
    return document.querySelector("#rc-widget-adapter-frame") as UnknownRecord;
}

async function getUserReportStats({ dateRange, customStartDate, customEndDate }: UnknownRecord): Promise<any> {
    if (customStartDate === undefined || customEndDate === undefined) {
        return null;
    }
    const rcAPI = new RcAPI();
    await refreshRCToken();
    let rcAccessToken = getRcAccessToken();
    const callLogData = await rcAPI.getRcCallLog({ rcAccessToken, dateRange, customStartDate, customEndDate });
    // phone activity
    const inboundCallCount = callLogData.records.filter(call => call.direction === 'Inbound').length;
    const outboundCallCount = callLogData.records.filter(call => call.direction === 'Outbound').length;
    const answeredCallCount = callLogData.records.filter(call => call.direction === 'Inbound' && (call.result === 'Call connected' || call.result === 'Accepted' || call.result === 'Answered Not Accepted')).length;
    const answeredCallPercentage = answeredCallCount === 0 ? '0%' : `${((answeredCallCount / (inboundCallCount || 1)) * 100).toFixed(2)}%`;
    // phone engagement
    const totalTalkTime = Math.round(callLogData.records.reduce((acc, call) => acc + (call.duration || 0), 0) / 60) || 0;
    const averageTalkTime = Math.round(totalTalkTime / (inboundCallCount + outboundCallCount)) || 0;
    // sms activity
    await refreshRCToken();
    rcAccessToken = getRcAccessToken();
    const smsLogData = await rcAPI.getRcSMSLog({ rcAccessToken, dateRange, customStartDate, customEndDate });
    const smsSentCount = smsLogData.records.filter(sms => sms.direction === 'Outbound').length;
    const smsReceivedCount = smsLogData.records.filter(sms => sms.direction === 'Inbound').length;
    const { calls, hasMore } = await RCAdapter.getUnloggedCalls(100, 1);
    const filteredCalls = calls.filter(call => moment(call.startTime).isAfter(customStartDate) && moment(call.startTime).isBefore(customEndDate));
    const reportStats: UnknownRecord = {
        dateRange,
        callLogStats: {
            inboundCallCount,
            outboundCallCount,
            answeredCallCount,
            answeredCallPercentage,
            totalTalkTime,
            averageTalkTime
        },
        smsLogStats: {
            smsSentCount,
            smsReceivedCount
        },
        unloggedCallStats: {
            unloggedCallCount: filteredCalls.length,
            calls: filteredCalls
        }
    };
    if (dateRange === 'Select date range...') {
        reportStats.startDate = customStartDate;
        reportStats.endDate = customEndDate;
    }
    return reportStats;
}

async function preloadUserSettingsFromAdmin({ serverUrl }: UnknownRecord): Promise<any> {
    const { rcUserInfo } = (await chromeStorageLocal.get('rcUserInfo'));
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

async function getUserSettingsOnline({ serverUrl }: UnknownRecord): Promise<any> {
    const { rcUserInfo } = (await chromeStorageLocal.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const getUserSettingsResponse = await axios.get(
        `${serverUrl}/user/settings?rcAccountId=${rcAccountId}`);
    return getUserSettingsResponse.data;
}

async function uploadUserSettings({ serverUrl, userSettings, settingKeysToRemove }: UnknownRecord): Promise<any> {
    const { selectedRegion } = await chromeStorageLocal.get({ selectedRegion: 'US' });
    let userSettingsToUpload = userSettings;
    // TODO: Remove this legacy migration once all environments have fully switched to
    // `userSettings.overridingNumberFormat` as the single source of truth (and older per-user
    // `overridingPhoneNumberFormat/2/3` are no longer sent/stored).
    // Backward-compatible migration: if per-user overridingPhoneNumberFormat* exist, ensure overridingNumberFormat exists too
    if (userSettingsToUpload && !userSettingsToUpload.overridingNumberFormat) {
        const format1 = userSettingsToUpload?.overridingPhoneNumberFormat?.value;
        const format2 = userSettingsToUpload?.overridingPhoneNumberFormat2?.value;
        const format3 = userSettingsToUpload?.overridingPhoneNumberFormat3?.value;
        if (format1 || format2 || format3) {
            userSettingsToUpload.overridingNumberFormat = {
                customizable: userSettingsToUpload?.overridingPhoneNumberFormat?.customizable ?? true,
                numberFormatter1: format1 ?? '',
                numberFormatter2: format2 ?? '',
                numberFormatter3: format3 ?? '',
            }
        }
    }
    if (userSettingsToUpload.selectedRegion) {
        userSettingsToUpload.selectedRegion.value = selectedRegion;
    }
    else {
        userSettingsToUpload.selectedRegion = { value: selectedRegion };
    }
    const uploadUserSettingsResponse = await axios.post(
        `${serverUrl}/user/settings`,
        {
            userSettings: userSettingsToUpload,
            settingKeysToRemove
        });
    return uploadUserSettingsResponse?.data?.userSettings;
}


async function refreshUserSettings({ changedSettings, settingKeysToRemove = [], isAvoidForceChange = false }: UnknownRecord): Promise<any> {
    const { crmAuthed } = await chromeStorageLocal.get({ crmAuthed: false });
    if (!crmAuthed) {
        return;
    }
    const rcAccessToken = getRcAccessToken();
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platformName = platformInfo?.platformName ?? '';
    const appointmentsSupported = !!manifest?.platforms?.[platformName]?.page?.appointment?.supported;
    let userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl, rcAccessToken });
    // TODO: Remove this mirroring once all UI/logic reads `overridingNumberFormat` directly and we no longer
    // need to support the legacy per-user `overridingPhoneNumberFormat/2/3` fields.
    // Backward-compatible migration: reflect overridingNumberFormat into overridingPhoneNumberFormat* for older UI and tools
    if (userSettings?.overridingNumberFormat) {
        const customizable = userSettings.overridingNumberFormat.customizable ?? true;
        userSettings.overridingPhoneNumberFormat = {
            customizable,
            value: userSettings.overridingNumberFormat.numberFormatter1 ?? '',
        };
        userSettings.overridingPhoneNumberFormat2 = {
            customizable,
            value: userSettings.overridingNumberFormat.numberFormatter2 ?? '',
        };
        userSettings.overridingPhoneNumberFormat3 = {
            customizable,
            value: userSettings.overridingNumberFormat.numberFormatter3 ?? '',
        };
    }
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
    userSettings = await uploadUserSettings({ serverUrl: manifest.serverUrl, userSettings, settingKeysToRemove });
    await chrome.storage.local.set({ userSettings });
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-update-features-flags',
        chat: getShowChatTabSetting(userSettings).value,
        meetings: getShowMeetingsTabSetting(userSettings).value,
        text: getShowTextTabSetting(userSettings).value,
        fax: getShowFaxTabSetting(userSettings).value,
        voicemail: getShowVoicemailTabSetting(userSettings).value,
        recordings: getShowRecordingsTabSetting(userSettings).value,
        contacts: getShowContactsTabSetting(userSettings).value,
        calldown: getShowCalldownTabSetting(userSettings).value,
        appointments: appointmentsSupported && getShowAppointmentsTabSetting(userSettings).value,
    }, '*');
    const autoLogMessagesGroupTrigger = (userSettings?.autoLogSMS?.value ?? false) || (userSettings?.autoLogInboundFax?.value ?? false) || (userSettings?.autoLogOutboundFax?.value ?? false) || (userSettings?.autoLogVoicemail?.value ?? false);
    const isServerSideLoggingEnabledForEndUsers = (userSettings?.serverSideLogging?.enable && userSettings?.serverSideLogging?.loggingLevel === 'Account') ?? false;
    window.postMessage({ type: 'rc-server-side-logging-enabled', enabled: isServerSideLoggingEnabledForEndUsers }, '*');
    RCAdapter.setAutoLog({ call: (userSettings.autoLogCall?.value && !isServerSideLoggingEnabledForEndUsers) ?? false, message: autoLogMessagesGroupTrigger })
    if (!isAvoidForceChange) {
        const showAiAssistantWidgetSetting = getShowAiAssistantWidgetSetting(userSettings);
        const autoStartAiAssistantSetting = getAutoStartAiAssistantSetting(userSettings);
        getWidgetFrame().contentWindow.postMessage({
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
    const c2dMatcherType = getC2DMatcherTypeSetting(userSettings).value;
    await chrome.storage.local.set({ notificationLevelSetting, c2dMatcherType });
    const service = await embeddableServices.getServiceManifest();
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service
    }, '*');
    // custom tabs
    const reportPageRender = reportPage.getReportsPageRender({ userStats: null, adminStats: null, userSettings });
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: reportPageRender,
    }, '*');
    const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: calldownPageRender,
    }, '*');
    return userSettings;
}

async function refreshUserInfo({ serverUrl }: UnknownRecord): Promise<any> {
    const response = await axios.post(`${serverUrl}/user/refreshInfo`);
    return response;
}

async function updateSSCLToken({ serverUrl, platform, token }: UnknownRecord): Promise<any> {
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

function getAutoLogVoicemailSetting(userSettings) {
    return {
        value: userSettings?.autoLogVoicemail?.value ?? false,
        readOnly: userSettings?.autoLogVoicemail?.customizable === undefined ? false : !userSettings?.autoLogVoicemail?.customizable,
        readOnlyReason: !userSettings?.autoLogVoicemail?.customizable ? 'This setting is managed by admin' : ''
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

// Whether the per-message (granular) SMS logging feature is turned ON for this
// user. Defaults to OFF so platforms that support it retain whole-conversation
// logging until an admin/user explicitly turns selected-message logging on.
function getSelectedMessageLogSetting(userSettings) {
    return {
        value: userSettings?.selectedMessageLog?.value ?? false,
        readOnly: userSettings?.selectedMessageLog?.customizable === undefined ? false : !userSettings?.selectedMessageLog?.customizable,
        readOnlyReason: !userSettings?.selectedMessageLog?.customizable ? 'This setting is managed by admin' : ''
    }
}

// Effective gate for the selected-message logging feature: the platform must
// advertise support (`isSelectedMessageLogSupported`) AND the user/admin setting
// must be enabled. Used by both the service manifest (to toggle the widget UI)
// and the message-logger handler (to toggle the runtime behavior) so they never
// diverge.
function isSelectedMessageLogEnabled({ platform, userSettings }) {
    return platform?.isSelectedMessageLogSupported === true
        && getSelectedMessageLogSetting(userSettings).value === true;
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
        value: userSettings?.multiContactMatchBehavior?.value ?? 'promptToSelect',
        readOnly: userSettings?.multiContactMatchBehavior?.customizable === undefined ? false : !userSettings?.multiContactMatchBehavior?.customizable,
        readOnlyReason: !userSettings?.multiContactMatchBehavior?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getopenContactPageAfterCreationSetting(userSettings) {
    return {
        value: userSettings?.openContactPageAfterCreation?.value ?? false,
        readOnly: userSettings?.openContactPageAfterCreation?.customizable === undefined ? false : !userSettings?.openContactPageAfterCreation?.customizable,
        readOnlyReason: !userSettings?.openContactPageAfterCreation?.customizable ? 'This setting is managed by admin' : ''
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

function getShowCalldownTabSetting(userSettings) {
    return {
        value: userSettings?.showCalldownTab?.value ?? true,
        readOnly: userSettings?.showCalldownTab?.customizable === undefined ? false : !userSettings?.showCalldownTab?.customizable,
        readOnlyReason: !userSettings?.showCalldownTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowAppointmentsTabSetting(userSettings) {
    return {
        value: userSettings?.showAppointmentsTab?.value ?? true,
        readOnly: userSettings?.showAppointmentsTab?.customizable === undefined ? false : !userSettings?.showAppointmentsTab?.customizable,
        readOnlyReason: !userSettings?.showAppointmentsTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getShowUserReportTabSetting(userSettings) {
    return {
        value: userSettings?.showUserReportTab?.value ?? true,
        readOnly: userSettings?.showUserReportTab?.customizable === undefined ? false : !userSettings?.showUserReportTab?.customizable,
        readOnlyReason: !userSettings?.showUserReportTab?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getC2DMatcherTypeSetting(userSettings) {
    return {
        value: userSettings?.c2dMatcherType?.value ?? 'libPhone',
        readOnly: userSettings?.c2dMatcherType?.customizable === undefined ? false : !userSettings?.c2dMatcherType?.customizable,
        readOnlyReason: !userSettings?.c2dMatcherType?.customizable ? 'This setting is managed by admin' : ''
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

function getLanguageSetting(userSettings) {
    return {
        value: userSettings?.language?.value ?? 'auto',
        readOnly: userSettings?.language?.customizable === undefined ? false : !userSettings?.language?.customizable,
        readOnlyReason: !userSettings?.language?.customizable ? 'This setting is managed by admin' : ''
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

function getPhoneNumberDisplayFormatTypeSetting(userSettings) {
    return {
        value: userSettings?.phoneNumberDisplayFormatType?.value ?? 'national',
        readOnly: userSettings?.phoneNumberDisplayFormatType?.customizable === undefined ? false : !userSettings?.phoneNumberDisplayFormatType?.customizable,
        readOnlyReason: !userSettings?.phoneNumberDisplayFormatType?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getPhoneNumberDisplayFormatTemplateSetting(userSettings) {
    return {
        value: userSettings?.phoneNumberDisplayFormatTemplate?.value ?? '',
        readOnly: userSettings?.phoneNumberDisplayFormatTemplate?.customizable === undefined ? false : !userSettings?.phoneNumberDisplayFormatTemplate?.customizable,
        readOnlyReason: !userSettings?.phoneNumberDisplayFormatTemplate?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getQuickAccessButtonSizeSetting(userSettings) {
    return {
        value: userSettings?.quickAccessButtonSize?.value ?? 'large',
        readOnly: userSettings?.quickAccessButtonSize?.customizable === undefined ? false : !userSettings?.quickAccessButtonSize?.customizable,
        readOnlyReason: !userSettings?.quickAccessButtonSize?.customizable ? 'This setting is managed by admin' : ''
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

function getAllPluginSettings(userSettings) {
    const result = {};
    for (const settingsKey in userSettings) {
        if (settingsKey.startsWith('plugin_')) {
            const pluginId = settingsKey.split('plugin_')[1];
            if (userSettings[settingsKey]?.isRemoved) {
                continue;
            }
            result[pluginId] = userSettings[settingsKey]?.value ?? null;
        }
    }
    return result;
}

function getPluginSetting(userSettings, pluginId) {
    return userSettings[`plugin_${pluginId}`]?.value;
}

const userCore = {
    getUserReportStats,
    preloadUserSettingsFromAdmin,
    getUserSettingsOnline,
    uploadUserSettings,
    refreshUserSettings,
    updateSSCLToken,
    refreshUserInfo,
    getAutoLogCallSetting,
    getAutoLogSMSSetting,
    getAutoLogVoicemailSetting,
    getAutoLogInboundFaxSetting,
    getAutoLogOutboundFaxSetting,
    getEnableRetroCallLogSync,
    getOneTimeLogSetting,
    getSelectedMessageLogSetting,
    isSelectedMessageLogEnabled,
    getCallPopSetting,
    getSMSPopSetting,
    getIncomingCallPop,
    getOutgoingCallPop,
    getCallPopMultiMatchBehavior,
    getopenContactPageAfterCreationSetting,
    getDeveloperModeSetting,
    getAutoOpenSetting,
    getShowAiAssistantWidgetSetting,
    getAutoStartAiAssistantSetting,
    getShowChatTabSetting,
    getShowMeetingsTabSetting,
    getShowTextTabSetting,
    getShowFaxTabSetting,
    getShowVoicemailTabSetting,
    getShowRecordingsTabSetting,
    getShowContactsTabSetting,
    getShowUserReportTabSetting,
    getC2DMatcherTypeSetting,
    getClickToDialEmbedMode,
    getClickToDialUrls,
    getQuickAccessButtonEmbedMode,
    getQuickAccessButtonUrls,
    getNotificationLevelSetting,
    getLanguageSetting,
    getAddCallLogNoteSetting,
    getAddCallSessionIdSetting,
    getAddRingCentralUserNameSetting,
    getAddRingCentralNumberSetting,
    getAddCallLogSubjectSetting,
    getAddCallLogContactNumberSetting,
    getAddCallLogDateTimeSetting,
    getLogDateFormatSetting,
    getAddCallLogDurationSetting,
    getAddCallLogResultSetting,
    getAddCallLogRecordingSetting,
    getAddCallLogAiNoteSetting,
    getAddCallLogTranscriptSetting,
    getShowCalldownTabSetting,
    getShowAppointmentsTabSetting,
    getUnknownContactPreferenceSetting,
    getMultipleContactsPreferenceSetting,
    getNewContactTypeSetting,
    getNewContactNamePrefixSetting,
    getPhoneNumberDisplayFormatTypeSetting,
    getPhoneNumberDisplayFormatTemplateSetting,
    getQuickAccessButtonSizeSetting,
    getCustomSetting,
    getAllPluginSettings,
    getPluginSetting,
};

export {
    getUserReportStats,
    preloadUserSettingsFromAdmin,
    getUserSettingsOnline,
    uploadUserSettings,
    refreshUserSettings,
    updateSSCLToken,
    refreshUserInfo,
    getAutoLogCallSetting,
    getAutoLogSMSSetting,
    getAutoLogVoicemailSetting,
    getAutoLogInboundFaxSetting,
    getAutoLogOutboundFaxSetting,
    getEnableRetroCallLogSync,
    getOneTimeLogSetting,
    getSelectedMessageLogSetting,
    isSelectedMessageLogEnabled,
    getCallPopSetting,
    getSMSPopSetting,
    getIncomingCallPop,
    getOutgoingCallPop,
    getCallPopMultiMatchBehavior,
    getopenContactPageAfterCreationSetting,
    getDeveloperModeSetting,
    getAutoOpenSetting,
    getShowAiAssistantWidgetSetting,
    getAutoStartAiAssistantSetting,
    getShowChatTabSetting,
    getShowMeetingsTabSetting,
    getShowTextTabSetting,
    getShowFaxTabSetting,
    getShowVoicemailTabSetting,
    getShowRecordingsTabSetting,
    getShowContactsTabSetting,
    getShowUserReportTabSetting,
    getC2DMatcherTypeSetting,
    getClickToDialEmbedMode,
    getClickToDialUrls,
    getQuickAccessButtonEmbedMode,
    getQuickAccessButtonUrls,
    getNotificationLevelSetting,
    getLanguageSetting,
    getAddCallLogNoteSetting,
    getAddCallSessionIdSetting,
    getAddRingCentralUserNameSetting,
    getAddRingCentralNumberSetting,
    getAddCallLogSubjectSetting,
    getAddCallLogContactNumberSetting,
    getAddCallLogDateTimeSetting,
    getLogDateFormatSetting,
    getAddCallLogDurationSetting,
    getAddCallLogResultSetting,
    getAddCallLogRecordingSetting,
    getAddCallLogAiNoteSetting,
    getAddCallLogTranscriptSetting,
    getShowCalldownTabSetting,
    getShowAppointmentsTabSetting,
    getUnknownContactPreferenceSetting,
    getMultipleContactsPreferenceSetting,
    getNewContactTypeSetting,
    getNewContactNamePrefixSetting,
    getPhoneNumberDisplayFormatTypeSetting,
    getPhoneNumberDisplayFormatTemplateSetting,
    getQuickAccessButtonSizeSetting,
    getCustomSetting,
    getAllPluginSettings,
    getPluginSetting,
};

export default userCore;
