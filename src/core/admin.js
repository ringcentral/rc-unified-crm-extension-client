import axios from 'axios';
import adminPage from '../components/admin/adminPage'
import authCore from '../core/auth'
import { parsePhoneNumber } from 'awesome-phonenumber';
import { getRcAccessToken, getPlatformInfo, getManifest } from '../lib/util';

async function getAdminSettings({ serverUrl }) {
    try {
        const rcAccessToken = getRcAccessToken();
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
        const getAdminSettingsResponse = await axios.get(
            `${serverUrl}/admin/settings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}`);
        return getAdminSettingsResponse.data;
    }
    catch (e) {
        return null;
    }
}

async function uploadAdminSettings({ serverUrl, adminSettings }) {
    const rcAccessToken = getRcAccessToken();
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const uploadAdminSettingsResponse = await axios.post(
        `${serverUrl}/admin/settings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}`,
        {
            adminSettings
        });
}

async function refreshAdminSettings() {
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platform = manifest.platforms[platformInfo.platformName];
    const rcAccessToken = getRcAccessToken();
    let adminSettings;
    // Admin tab render
    const storedAdminSettings = await getAdminSettings({ serverUrl: manifest.serverUrl, rcAccessToken });
    await chrome.storage.local.set({ isAdmin: !!storedAdminSettings });
    if (storedAdminSettings) {
        try {
            const adminPageRender = adminPage.getAdminPageRender({ platform });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: adminPageRender,
            }, '*');
            await chrome.storage.local.set({ adminSettings: storedAdminSettings });
            adminSettings = storedAdminSettings;
        } catch (e) {
            console.log('Cannot find admin settings', e);
        }
    }

    // Set user setting display name
    const { crmUserInfo } = await chrome.storage.local.get({ crmUserInfo: null });
    authCore.setAccountName(crmUserInfo?.name, !!storedAdminSettings);

    return { adminSettings }
}

async function getServerSideLogging({ platform }) {
    if (!platform.serverSideLogging) {
        return;
    }
    const serverDomainUrl = platform.serverSideLogging.url;
    const { serverSideLoggingToken } = await chrome.storage.local.get('serverSideLoggingToken');
    if (serverSideLoggingToken) {
        try {
            const subscribeResp = await axios.get(
                `${serverDomainUrl}/subscription`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Access-Token': serverSideLoggingToken
                    }
                }
            );
            return subscribeResp.data;
        }
        catch (e) {
            if (e.response.status === 401) {
                // Token expired
                const serverSideLoggingToken = await authServerSideLogging({ platform });
                const subscribeResp = await axios.get(
                    `${serverDomainUrl}/subscription`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Access-Token': serverSideLoggingToken
                        }
                    }
                );
                return subscribeResp.data;
            }
        }
    }
    else {
        const serverSideLoggingToken = await authServerSideLogging({ platform });
        const subscribeResp = await axios.get(
            `${serverDomainUrl}/subscription`,
            {
                headers: {
                    Accept: 'application/json',
                    'X-Access-Token': serverSideLoggingToken
                }
            }
        );
        return subscribeResp.data;
    }
}

async function getServerSideLoggingAdditionalFieldValues({ platform }) {
    if (!platform.serverSideLogging || !platform.serverSideLogging.additionalFields) {
        return {};
    }
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rcUserInfo } = (await chrome.storage.local.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const manifest = await getManifest();
    const settingsResponse = await axios.get(
        `${manifest.serverUrl}/admin/serverLoggingSettings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccountId=${rcAccountId}`,
    );
    return settingsResponse.data;
}

async function uploadServerSideLoggingAdditionalFieldValues({ platform, formData }) {
    if (!platform.serverSideLogging || !platform.serverSideLogging.additionalFields) {
        return;
    }
    const additionalFieldValues = {};
    platform.serverSideLogging.additionalFields.forEach(field => {
        additionalFieldValues[field.const] = formData[field.const];
    });
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { rcUserInfo } = (await chrome.storage.local.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const manifest = await getManifest();
    const uploadResponse = await axios.post(
        `${manifest.serverUrl}/admin/serverLoggingSettings?jwtToken=${rcUnifiedCrmExtJwt}&rcAccountId=${rcAccountId}`,
        {
            additionalFieldValues,
        }
    );
    return uploadResponse.data;
}

async function enableServerSideLogging({ platform, subscriptionLevel, loggingByAdmin }) {
    if (!platform.serverSideLogging) {
        return;
    }
    const rcAccessToken = getRcAccessToken();
    const serverDomainUrl = platform.serverSideLogging.url;
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { serverSideLoggingToken } = await chrome.storage.local.get('serverSideLoggingToken');
    if (serverSideLoggingToken) {
        try {
            // get subscription
            const getSubscriptionResp = await axios.get(
                `${serverDomainUrl}/subscription`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Access-Token': serverSideLoggingToken
                    }
                }
            );
            // if subscribed, unsubscribe it first
            if (getSubscriptionResp.data.subscribed) {
                await disableServerSideLogging({ platform, rcAccessToken });
            }
            //  Subscribe
            // TODO: loggingWithUserAssigned overrides loggingByAdmin if useAdminAssignedUserToken is true
            //       There are 2 roles, one to create activity and the other to own it (case: admin creating and assigning to user, so user would eventually own it)
            //       To change the naming so that it has better readability. Right it's confusing on variable names for different roles.
            const subscribeResp = await axios.post(
                `${serverDomainUrl}/subscribe`,
                {
                    crmToken: rcUnifiedCrmExtJwt,
                    crmPlatform: platform.name,
                    subscriptionLevel,
                    loggingByAdmin,
                    loggingWithUserAssigned: platform.serverSideLogging?.useAdminAssignedUserToken ? !loggingByAdmin : false
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
                const serverSideLoggingToken = await authServerSideLogging({ platform });

                // get subscription
                const getSubscriptionResp = await axios.get(
                    `${serverDomainUrl}/subscription`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Access-Token': serverSideLoggingToken
                        }
                    }
                );
                if (getSubscriptionResp.data.subscribed) {
                    return;
                }
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
        }
    }
}

async function disableServerSideLogging({ platform }) {
    if (!platform.serverSideLogging) {
        return;
    }
    const rcAccessToken = getRcAccessToken();
    const serverDomainUrl = platform.serverSideLogging.url;
    const { serverSideLoggingToken } = await chrome.storage.local.get('serverSideLoggingToken');
    if (serverSideLoggingToken) {
        try {
            // get subscription
            const getSubscriptionResp = await axios.get(
                `${serverDomainUrl}/subscription`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Access-Token': serverSideLoggingToken
                    }
                }
            );
            if (!getSubscriptionResp.data.subscribed) {
                return;
            }
            // Unsubscribe
            const unsubscribeResp = await axios.post(
                `${serverDomainUrl}/unsubscribe`,
                {},
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
                const serverSideLoggingToken = await authServerSideLogging({ platform });
                if (!serverSideLoggingToken) {
                    return;
                }
                // Unsubscribe
                const unsubscribeResp = await axios.post(
                    `${serverDomainUrl}/unsubscribe`,
                    {},
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Access-Token': serverSideLoggingToken
                        }
                    }
                );
            }
        }
    }
}

async function updateServerSideDoNotLogNumbers({ platform, doNotLogNumbers }) {
    if (!platform.serverSideLogging) {
        return;
    }
    const serverDomainUrl = platform.serverSideLogging.url;
    const { serverSideLoggingToken } = await chrome.storage.local.get('serverSideLoggingToken');
    let parsedNumbers = [];
    const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
    for (const n of doNotLogNumbers.split(',')) {
        // extension numbers are less than 6 digits
        if (n.length > 6) {
            const pn = parsePhoneNumber(n, { regionCode: selectedRegion });
            if (pn.valid) {
                parsedNumbers.push(pn.number.e164);
            }
        }
        else {
            parsedNumbers.push(n);
        }
    }
    if (serverSideLoggingToken) {
        try {
            // update do not log numbers
            const updateNumbersResp = await axios.post(
                `${serverDomainUrl}/do-not-log-numbers`,
                {
                    doNotLogNumbers: parsedNumbers.toString()
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
                const serverSideLoggingToken = await authServerSideLogging({ platform });
                // update do not log numbers
                const updateNumbersResp = await axios.post(
                    `${serverDomainUrl}/do-not-log-numbers`,
                    {
                        doNotLogNumbers: parsedNumbers.toString()
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
    }
}

async function authServerSideLogging({ platform }) {
    if (!platform.serverSideLogging) {
        return;
    }

    const rcAccessToken = getRcAccessToken();
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
exports.refreshAdminSettings = refreshAdminSettings;
exports.getServerSideLogging = getServerSideLogging;
exports.enableServerSideLogging = enableServerSideLogging;
exports.disableServerSideLogging = disableServerSideLogging;
exports.updateServerSideDoNotLogNumbers = updateServerSideDoNotLogNumbers;
exports.authServerSideLogging = authServerSideLogging;
exports.getServerSideLoggingAdditionalFieldValues = getServerSideLoggingAdditionalFieldValues;
exports.uploadServerSideLoggingAdditionalFieldValues = uploadServerSideLoggingAdditionalFieldValues;
