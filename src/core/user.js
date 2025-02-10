import axios from 'axios';

async function preloadUserSettingsFromAdmin({ serverUrl, rcAccessToken }) {
    try {
        const preloadUserSettingsResponse = await axios.get(`${serverUrl}/user/preloadSettings?rcAccessToken=${rcAccessToken}`);
        return preloadUserSettingsResponse.data;
    }
    catch (e) {
        console.log(e)
        return null;
    }
}

async function getUserSettings({ serverUrl, rcAccessToken }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const getUserSettingsResponse = await axios.get(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}`);
    return getUserSettingsResponse.data;
}

async function uploadUserSettings({ serverUrl, userSettings }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rc_callLogger_auto_log_notify: callAutoLog } = await chrome.storage.local.get({ rc_callLogger_auto_log_notify: false })
    const { rc_messageLogger_auto_log_notify: messageAutoLog } = await chrome.storage.local.get({ rc_messageLogger_auto_log_notify: false });
    const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
    let userSettingsToUpload = userSettings;
    userSettingsToUpload.callAutoLog = { value: callAutoLog };
    userSettingsToUpload.messageAutoLog = { value: messageAutoLog };
    userSettingsToUpload.selectedRegion = { value: selectedRegion };
    const uploadUserSettingsResponse = await axios.post(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}`,
        {
            userSettings: userSettingsToUpload
        });
    return userSettingsToUpload;
}
function getAutoLogCallSetting(userSettings) {
    const serverSideLoggingEnabled = userSettings?.serverSideLogging?.enable ?? false;
    if (serverSideLoggingEnabled) {
        return {
            value: false,
            readOnly: true,
            readOnlyReason: 'This cannot be turn ON becauase server side logging is enabled by admin'
        }
    }
    return {
        value: userSettings?.autoLogCall?.value ?? false,
        readOnly: userSettings?.autoLogCall?.customizable === undefined ? false : !!!userSettings?.autoLogCall?.customizable,
        readOnlyReason: !userSettings?.autoLogCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoLogSMSSetting(userSettings) {
    return {
        value: userSettings?.autoLogSMS?.value ?? false,
        readOnly: userSettings?.autoLogSMS?.customizable === undefined ? false : !!!userSettings?.autoLogSMS?.customizable,
        readOnlyReason: !userSettings?.autoLogSMS?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getDisableRetroCallLogSync(userSettings) {
    return {
        value: userSettings?.disableRetroCallLogSync?.value ?? false,
        readOnly: userSettings?.disableRetroCallLogSync?.customizable === undefined ? false : !!!userSettings?.disableRetroCallLogSync?.customizable,
        readOnlyReason: !!!userSettings?.disableRetroCallLogSync?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getCallPopSetting(userSettings) {
    return {
        value: userSettings?.popupLogPageAfterCall?.value ?? false,
        readOnly: userSettings?.popupLogPageAfterCall?.customizable === undefined ? false : !!!userSettings?.popupLogPageAfterCall?.customizable,
        readOnlyReason: !!!userSettings?.popupLogPageAfterCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getSMSPopSetting(userSettings) {
    return {
        value: userSettings?.popupLogPageAfterSMS?.value ?? false,
        readOnly: userSettings?.popupLogPageAfterSMS?.customizable === undefined ? false : !!!userSettings?.popupLogPageAfterSMS?.customizable,
        readOnlyReason: !!!userSettings?.popupLogPageAfterSMS?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getIncomingCallPop(userSettings) {
    return {
        value: userSettings?.openContactPageFromIncomingCall?.value ?? 'disabled',
        readOnly: userSettings?.openContactPageFromIncomingCall?.customizable === undefined ? false : !!!userSettings?.openContactPageFromIncomingCall?.customizable,
        readOnlyReason: !!!userSettings?.openContactPageFromIncomingCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getOutgoingCallPop(userSettings) {
    return {
        value: userSettings?.openContactPageFromOutgoingCall?.value ?? 'disabled',
        readOnly: userSettings?.openContactPageFromOutgoingCall?.customizable === undefined ? false : !!!userSettings?.openContactPageFromOutgoingCall?.customizable,
        readOnlyReason: !!!userSettings?.openContactPageFromOutgoingCall?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getCallPopMultiMatchBehavior(userSettings) {
    return {
        value: userSettings?.multiContactMatchBehavior?.value ?? 'openAllMatches',
        readOnly: userSettings?.multiContactMatchBehavior?.customizable === undefined ? false : !!!userSettings?.multiContactMatchBehavior?.customizable,
        readOnlyReason: !!!userSettings?.multiContactMatchBehavior?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getOpenContactAfterCreationSetting(userSettings) {
    return {
        value: userSettings?.openContactAfterCreatingIt?.value ?? false,
        readOnly: userSettings?.openContactAfterCreatingIt?.customizable === undefined ? false : !!!userSettings?.openContactAfterCreatingIt?.customizable,
        readOnlyReason: !!!userSettings?.openContactAfterCreatingIt?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getDeveloperModeSetting(userSettings) {
    return {
        value: userSettings?.developerMode?.value ?? false,
        readOnly: userSettings?.developerMode?.customizable === undefined ? false : !!!userSettings?.developerMode?.customizable,
        readOnlyReason: !!!userSettings?.developerMode?.customizable ? 'This setting is managed by admin' : ''
    }
}

function getAutoOpenSetting(userSettings) {
    return {
        value: userSettings?.autoOpenExtension?.value ?? false,
        readOnly: userSettings?.autoOpenExtension?.customizable === undefined ? false : !!!userSettings?.autoOpenExtension?.customizable,
        readOnlyReason: !!!userSettings?.autoOpenExtension?.customizable ? 'This setting is managed by admin' : ''
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
        readOnly: userSettings[id]?.customizable === undefined ? false : !!!userSettings[id]?.customizable,
        readOnlyReason: !!!userSettings[id]?.customizable ? 'This setting is managed by admin' : ''
    }
}

exports.preloadUserSettingsFromAdmin = preloadUserSettingsFromAdmin;
exports.getUserSettings = getUserSettings;
exports.uploadUserSettings = uploadUserSettings;

exports.getAutoLogCallSetting = getAutoLogCallSetting;
exports.getAutoLogSMSSetting = getAutoLogSMSSetting;
exports.getDisableRetroCallLogSync = getDisableRetroCallLogSync;
exports.getCallPopSetting = getCallPopSetting;
exports.getSMSPopSetting = getSMSPopSetting;
exports.getIncomingCallPop = getIncomingCallPop;
exports.getOutgoingCallPop = getOutgoingCallPop;
exports.getCallPopMultiMatchBehavior = getCallPopMultiMatchBehavior;
exports.getOpenContactAfterCreationSetting = getOpenContactAfterCreationSetting;
exports.getDeveloperModeSetting = getDeveloperModeSetting;
exports.getAutoOpenSetting = getAutoOpenSetting;
exports.getCustomSetting = getCustomSetting;