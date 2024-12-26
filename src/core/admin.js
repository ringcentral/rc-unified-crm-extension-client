import axios from 'axios';

async function getAdminSettings({ serverUrl, rcAccessToken }) {
    try {
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
        const getAdminSettingsResponse = await axios.get(
            `${serverUrl}/admin/settings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}`);
        return getAdminSettingsResponse.data;
    }
    catch (e) {
        return null;
    }
}

async function uploadAdminSettings({ serverUrl, adminSettings, rcAccessToken }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const uploadAdminSettingsResponse = await axios.post(
        `${serverUrl}/admin/settings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}`,
        {
            adminSettings
        });
}

async function enableServerSideLogging({ platform, rcAccessToken }) {
    if (!!!platform.serverSideLogging) {
        return;
    }
    const serverDomainUrl = platform.serverSideLogging.url;
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const serverSideLoggingToken = await authServerSideLogging({ platform, rcAccessToken });
    // Subscribe
    const subscribeResp = await axios.post(
        `${serverDomainUrl}/subscribe`,
        {
            crmToken: rcUnifiedCrmExtJwt,
            crmPlatform: platform.name
        },
        {
            headers: {
                Accept: 'application/json',
                'X-Access-Token': serverSideLoggingToken
            }
        }
    );
}

async function disableServerSideLogging({ platform, rcAccessToken }) {
    if (!!!platform.serverSideLogging) {
        return;
    }
    const serverDomainUrl = platform.serverSideLogging.url;
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { serverSideLoggingToken } = await chrome.storage.local.get('serverSideLoggingToken');
    if (!!serverSideLoggingToken) {
        try {
            // Unsubscribe
            const unsubscribeResp = await axios.post(
                `${serverDomainUrl}/unsubscribe`,
                {
                    crmToken: rcUnifiedCrmExtJwt,
                    crmPlatform: platform.name
                },
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Access-Token': serverSideLoggingToken
                    }
                }
            );
        }
        catch (e) {
            if (e.response.status === 401) {
                // Token expired
                const serverSideLoggingToken = await authServerSideLogging({ platform, rcAccessToken });
                // Unsubscribe
                const unsubscribeResp = await axios.post(
                    `${serverDomainUrl}/unsubscribe`,
                    {
                        crmToken: rcUnifiedCrmExtJwt,
                        crmPlatform: platform.name
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
        // unauth
        await chrome.storage.local.remove('serverSideLoggingToken');
    }
}

async function authServerSideLogging({ platform, rcAccessToken }) {
    if (!!!platform.serverSideLogging) {
        return;
    }

    const rcClientId = platform.serverSideLogging.rcClientId;
    const serverDomainUrl = platform.serverSideLogging.url;
    // Auth
    const rcInteropCodeResp = await axios.post(
        'https://platform.ringcentral.com/restapi/v1.0/interop/generate-code',
        {
            clientId: rcClientId
        },
        {
            headers: {
                Authorization: `Bearer ${rcAccessToken}`
            }
        }
    );
    const rcInteropCode = rcInteropCodeResp.data.code;
    const serverSideLoggingTokenResp = await axios.get(
        `${serverDomainUrl}/oauth/callback?code=${rcInteropCode}`,
        {
            headers: {
                Accept: 'application/json'
            }
        }
    );
    const serverSideLoggingToken = serverSideLoggingTokenResp.data.jwtToken;
    await chrome.storage.local.set({ serverSideLoggingToken });
    return serverSideLoggingToken;
}

exports.getAdminSettings = getAdminSettings;
exports.uploadAdminSettings = uploadAdminSettings;
exports.enableServerSideLogging = enableServerSideLogging;
exports.disableServerSideLogging = disableServerSideLogging;