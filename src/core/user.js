import axios from 'axios';

async function getUserSettings({ serverUrl }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const getUserSettingsResponse = await axios.get(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}`);
    return getUserSettingsResponse.data;
}

async function uploadUserSettings({ serverUrl, userSettings }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const uploadUserSettingsResponse = await axios.post(
        `${serverUrl}/user/settings?jwtToken=${rcUnifiedCrmExtJwt}`,
        {
            userSettings
        });
}

exports.getUserSettings = getUserSettings;
exports.uploadUserSettings = uploadUserSettings;