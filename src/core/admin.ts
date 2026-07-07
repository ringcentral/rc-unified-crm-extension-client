import axios from 'axios';
import moment from 'moment';
import adminPage from '../components/admin/adminPage'
import authCore from '../core/auth'
import { RcAPI } from '../lib/rcAPI';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { getRcAccessToken, getRcContactInfo, showNotification } from '../lib/util';
import { getPlatformInfo } from '../service/platformService';
import { getManifest as getManifestBase } from '../service/manifestService';

type UnknownRecord = Record<string, any>;

declare const process: UnknownRecord;
declare const RCAdapter: UnknownRecord;

const chromeStorageLocal = chrome.storage.local as any;

async function getManifest(): Promise<UnknownRecord> {
    return (await getManifestBase()) as UnknownRecord;
}

function getWidgetFrame(): UnknownRecord {
    return document.querySelector("#rc-widget-adapter-frame") as UnknownRecord;
}

async function getAdminSettings({ serverUrl }: UnknownRecord): Promise<UnknownRecord | null> {
    try {
        const rcAccessToken = getRcAccessToken();
        const getAdminSettingsResponse = await axios.get(
            `${serverUrl}/admin/settings?rcAccessToken=${rcAccessToken}`);
        return getAdminSettingsResponse.data;
    }
    catch (e) {
        return null;
    }
}

async function uploadAdminSettings({ serverUrl, adminSettings }: UnknownRecord): Promise<any> {
    const rcAccessToken = getRcAccessToken();
    const uploadAdminSettingsResponse = await axios.post(
        `${serverUrl}/admin/settings?rcAccessToken=${rcAccessToken}`,
        {
            adminSettings
        });
    await chrome.storage.local.set({ adminSettings });
}

async function refreshAdminSettings(): Promise<UnknownRecord> {
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platform = manifest.platforms[platformInfo.platformName];
    const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get('rcUnifiedCrmExtJwt');
    const rcAccessToken = getRcAccessToken();
    let adminSettings;
    // Admin tab render
    const storedAdminSettings = await getAdminSettings({ serverUrl: manifest.serverUrl, rcAccessToken });
    await chrome.storage.local.set({ isAdmin: !!storedAdminSettings });
    if (storedAdminSettings) {
        try {
            const adminPageRender = adminPage.getAdminPageRender({ platform });
            getWidgetFrame().contentWindow.postMessage({
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
    const { crmUserInfo } = await chromeStorageLocal.get({ crmUserInfo: null });
    authCore.setAuth(!!rcUnifiedCrmExtJwt, crmUserInfo?.name, !!storedAdminSettings);

    await chrome.storage.local.set({ adminSettings });
    return { adminSettings }
}

async function getServerSideLogging({ platform }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging) {
        return;
    }
    const serverDomainUrl = platform.serverSideLogging.url;
    const { serverSideLoggingToken } = await chromeStorageLocal.get('serverSideLoggingToken');
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

async function getServerSideLoggingAdditionalFieldValues({ platform }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging || !platform.serverSideLogging.additionalFields) {
        return {};
    }
    const { rcUserInfo } = (await chromeStorageLocal.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const manifest = await getManifest();
    const settingsResponse = await axios.get(
        `${manifest.serverUrl}/admin/serverLoggingSettings?rcAccountId=${rcAccountId}`,
    );
    return settingsResponse.data;
}

async function uploadServerSideLoggingAdditionalFieldValues({ platform, formData }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging || !platform.serverSideLogging.additionalFields) {
        return;
    }
    const additionalFieldValues = {};
    platform.serverSideLogging.additionalFields.forEach(field => {
        additionalFieldValues[field.const] = formData.serverSideLoggingHolder[field.const];
    });
    const { rcUserInfo } = (await chromeStorageLocal.get('rcUserInfo'));
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const manifest = await getManifest();
    const uploadResponse = await axios.post(
        `${manifest.serverUrl}/admin/serverLoggingSettings?rcAccountId=${rcAccountId}`,
        {
            additionalFieldValues,
        }
    );
    return uploadResponse.data;
}

async function enableServerSideLogging({ serverUrl, platform, subscriptionLevel, loggingByAdmin, sources, silence = false }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging) {
        return;
    }
    const rcAccessToken = getRcAccessToken();
    const serverDomainUrl = platform.serverSideLogging.url;
    const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get('rcUnifiedCrmExtJwt');
    const { serverSideLoggingToken } = await chromeStorageLocal.get('serverSideLoggingToken');
    const { adminSettings } = await chromeStorageLocal.get('adminSettings');
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
                    crmAdapterUrl: serverUrl,
                    subscriptionLevel,
                    loggingByAdmin,
                    loggingWithUserAssigned: platform.serverSideLogging?.useAdminAssignedUserToken ? !loggingByAdmin : false,
                    detailedCallLog: adminSettings?.userSettings?.addCallLogLegs?.value ?? false,
                    sources
                },
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Access-Token': serverSideLoggingToken
                    }
                }
            );
            if (!silence) {
                showNotification({ level: 'success', message: 'Server side logging turned ON. Auto call log inside the extension will be forced OFF.', ttl: 5000 });
            }
        }
        catch (e) {
            console.error('Error enabling server side logging:', e);
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
                        crmPlatform: platform.name,
                        crmAdapterUrl: serverUrl,
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
                if (!silence) {
                    showNotification({ level: 'success', message: 'Server side logging turned ON. Auto call log inside the extension will be forced OFF.', ttl: 5000 });
                }
            }
            if (e.response.status === 400) {
                showNotification({
                    level: "warning",
                    message: `Failed to create subscription:${e.response.data.result.message}`,
                    ttl: 10000
                });
            }
        }
    }
}

async function disableServerSideLogging({ platform }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging) {
        return;
    }
    const rcAccessToken = getRcAccessToken();
    const serverDomainUrl = platform.serverSideLogging.url;
    const { serverSideLoggingToken } = await chromeStorageLocal.get('serverSideLoggingToken');
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

async function updateServerSideDoNotLogNumbers({ platform, doNotLogNumbers }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging) {
        return;
    }
    const serverDomainUrl = platform.serverSideLogging.url;
    const { serverSideLoggingToken } = await chromeStorageLocal.get('serverSideLoggingToken');
    let parsedNumbers = [];
    const { selectedRegion } = await chromeStorageLocal.get({ selectedRegion: 'US' });
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

async function authServerSideLogging({ platform }: UnknownRecord): Promise<any> {
    if (!platform.serverSideLogging) {
        return;
    }
    const { rcUserInfo } = await chromeStorageLocal.get('rcUserInfo');
    const rcAccessToken = getRcAccessToken();
    const rcClientId = "Y4m1YREFKbXdDoet5djv46";
    const serverDomainUrl = platform.serverSideLogging.url;
    // Auth
    const rcAPI = new RcAPI();
    const rcInteropCode = await rcAPI.getInteropCode({ rcAccessToken, rcClientId });
    const serverSideLoggingTokenResp = await axios.get(
        `${serverDomainUrl}/oauth/callback?code=${rcInteropCode}&rcAccountId=${rcUserInfo?.rcAccountId}`,
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

async function authAppConnectServer({ serverUrl }: UnknownRecord): Promise<any> {
    try {
        const rcAccessToken = getRcAccessToken();
        // eslint-disable-next-line no-undef
        const rcClientId = process.env.RC_CLIENT_ID;
        const rcAPI = new RcAPI();
        const rcInteropCode = await rcAPI.getInteropCode({ rcAccessToken, rcClientId });
        const serverSideLoggingTokenResp = await axios.get(
            `${serverUrl}/ringcentral/oauth/callback?code=${rcInteropCode}`,
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );
    }
    catch (e) {
        console.log('Cannot auth app connect server', e);
    }
}

async function getAdminReportStats({ serverUrl, timezone, timeFrom, timeTo, groupBy }: UnknownRecord): Promise<any> {
    if (timeFrom === undefined || timeTo === undefined) {
        return null;
    }
    const adminReportStatsResp = await axios.get(
        `${serverUrl}/ringcentral/admin/report?timezone=${timezone}&timeFrom=${timeFrom}&timeTo=${timeTo}&groupBy=${groupBy}`,
        {
            headers: {
                Accept: 'application/json'
            }
        }
    );
    return adminReportStatsResp.data;
}

async function getUserExtensionReportStats({ serverUrl, rcExtensionId, timezone, timeFrom, timeTo }: UnknownRecord): Promise<any> {
    if (timeFrom === undefined || timeTo === undefined) {
        return null;
    }
    const userReportStatsResp = await axios.get(
        `${serverUrl}/ringcentral/admin/userReport?rcExtensionId=${rcExtensionId}&timezone=${timezone}&timeFrom=${timeFrom}&timeTo=${timeTo}`,
    );
    if (rcExtensionId === `~`) {
        const { calls, hasMore } = await RCAdapter.getUnloggedCalls(100, 1);
        const filteredCalls = calls.filter(call => moment(call.startTime).isAfter(timeFrom) && moment(call.startTime).isBefore(timeTo));
        if (userReportStatsResp.data) {
            userReportStatsResp.data.unloggedCallStats = {
                unloggedCallCount: filteredCalls.length,
                calls: filteredCalls
            }
        }
        else {
            userReportStatsResp.data = {
                unloggedCallStats: {
                    unloggedCallCount: filteredCalls.length,
                    calls: filteredCalls
                }
            };
        }
    }
    return userReportStatsResp.data;
}

async function getUserMapping({ serverUrl }: UnknownRecord): Promise<any> {
    const { rcUserInfo } = (await chromeStorageLocal.get('rcUserInfo'));
    const rcAccessToken = getRcAccessToken();
    const rcExtensionList = (await getRcContactInfo()).filter(rc => rc.type == 'User' || rc.type == 'Department');
    const userMappingResp = await axios.post(
        `${serverUrl}/admin/userMapping?rcAccessToken=${rcAccessToken}`,
        {
            rcExtensionList
        }
    );
    return userMappingResp.data;
}

async function reinitializeUserMapping({ serverUrl }: UnknownRecord): Promise<any> {
    const { rcUserInfo } = (await chromeStorageLocal.get('rcUserInfo'));
    const rcAccessToken = getRcAccessToken();
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    const manifest = await getManifest();
    const rcExtensionList = (await getRcContactInfo()).filter(rc => rc.type == 'User' || rc.type == 'Department');
    const reinitializeUserMappingResp = await axios.post(
        `${manifest.serverUrl}/admin/reinitializeUserMapping?rcAccountId=${rcAccountId}&rcAccessToken=${rcAccessToken}`,
        {
            rcExtensionList
        }
    );
    return reinitializeUserMappingResp.data;
}

async function getManagedAuthSettings({ serverUrl }: UnknownRecord): Promise<any> {
    const rcAccessToken = getRcAccessToken();
    const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get('rcUnifiedCrmExtJwt');
    const platformInfo = await getPlatformInfo();
    const response = await axios.get(
        `${serverUrl}/admin/managedAuth?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}&connectorId=${encodeURIComponent(platformInfo?.connectorId ?? '')}&isPrivate=${encodeURIComponent(platformInfo?.isPrivate ? 'true' : 'false')}`,
    );
    await chrome.storage.local.set({ managedAuthSettings: response.data });
    return response.data;
}

async function saveManagedAuthSettings({
    serverUrl,
    scope,
    values,
    rcExtensionId,
    rcUserName,
    fieldsToRemove = [],
    refreshAfterSave = true
}: UnknownRecord): Promise<any> {
    const rcAccessToken = getRcAccessToken();
    const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get('rcUnifiedCrmExtJwt');
    const platformInfo = await getPlatformInfo();
    const response = await axios.post(
        `${serverUrl}/admin/managedAuth?jwtToken=${rcUnifiedCrmExtJwt}&rcAccessToken=${rcAccessToken}&connectorId=${encodeURIComponent(platformInfo?.connectorId ?? '')}&isPrivate=${encodeURIComponent(platformInfo?.isPrivate ? 'true' : 'false')}`,
        {
            scope,
            values,
            rcExtensionId,
            rcUserName,
            fieldsToRemove
        }
    );
    if (refreshAfterSave) {
        await getManagedAuthSettings({ serverUrl });
    }
    return response.data;
}

async function deleteManagedOAuthAccount({ serverUrl, platformName }: UnknownRecord): Promise<any> {
    const rcAccessToken = getRcAccessToken();
    const response = await axios.delete(
        `${serverUrl}/admin/managedOAuth/account?rcAccessToken=${encodeURIComponent(rcAccessToken ?? '')}&platform=${encodeURIComponent(platformName)}`
    );
    return response.data;
}

const adminCore = {
    getAdminSettings,
    uploadAdminSettings,
    refreshAdminSettings,
    getServerSideLogging,
    enableServerSideLogging,
    disableServerSideLogging,
    updateServerSideDoNotLogNumbers,
    authServerSideLogging,
    getServerSideLoggingAdditionalFieldValues,
    uploadServerSideLoggingAdditionalFieldValues,
    authAppConnectServer,
    getUserMapping,
    getUserExtensionReportStats,
    getAdminReportStats,
    reinitializeUserMapping,
    getManagedAuthSettings,
    saveManagedAuthSettings,
    deleteManagedOAuthAccount,
};

export {
    getAdminSettings,
    uploadAdminSettings,
    refreshAdminSettings,
    getServerSideLogging,
    enableServerSideLogging,
    disableServerSideLogging,
    updateServerSideDoNotLogNumbers,
    authServerSideLogging,
    getServerSideLoggingAdditionalFieldValues,
    uploadServerSideLoggingAdditionalFieldValues,
    authAppConnectServer,
    getUserMapping,
    getUserExtensionReportStats,
    getAdminReportStats,
    reinitializeUserMapping,
    getManagedAuthSettings,
    saveManagedAuthSettings,
    deleteManagedOAuthAccount,
};

export default adminCore;
