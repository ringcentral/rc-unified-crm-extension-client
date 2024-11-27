import axios from 'axios';

async function getUserSettings({ serverUrl }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const getUserSettingsResponse = await axios.get(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}`);
    return getUserSettingsResponse.data;
}

async function uploadUserSettings({ serverUrl, userSettings }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rc_callLogger_auto_log_notify: callAutoLog } = await chrome.storage.local.get({ rc_callLogger_auto_log_notify: false })
    const { rc_messageLogger_auto_log_notify: messageAutoLog } = await chrome.storage.local.get({ rc_messageLogger_auto_log_notify: false });
    userSettings.push({
        id: 'callAutoLog',
        value: callAutoLog
    });
    userSettings.push({
        id: 'messageAutoLog',
        value: messageAutoLog
    });
    const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
    userSettings.push({
        id: 'selectedRegion',
        value: selectedRegion
    });
    const uploadUserSettingsResponse = await axios.post(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}`,
        {
            userSettings
        });
}

exports.getUserSettings = getUserSettings;
exports.uploadUserSettings = uploadUserSettings;