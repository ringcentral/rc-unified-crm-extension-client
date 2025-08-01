import axios from 'axios';
import { showNotification } from '../lib/util';
import { trackCrmLogin, trackCrmLogout } from '../lib/analytics';
import { openDB } from 'idb';

async function submitPlatformSelection(platform) {
    await chrome.storage.local.set({
        ['platform-info']: platform
    })
}

// apiUrl: Insightly
// username, password: Redtail
async function apiKeyLogin({ serverUrl, apiKey, formData, useLicense }) {
    try {
        const platformInfo = await chrome.storage.local.get('platform-info');
        const platformName = platformInfo['platform-info'].platformName;
        const hostname = platformInfo['platform-info'].hostname;
        const res = await axios.post(`${serverUrl}/apiKeyLogin?state=platform=${platformName}`, {
            apiKey: apiKey ?? 'apiKey',
            platform: platformName,
            hostname,
            additionalInfo: {
                ...formData
            }
        });
        setAuth(true);
        showNotification({ level: res.data.returnMessage?.messageType ?? 'success', message: res.data.returnMessage?.message ?? 'Successfully authorized.', ttl: res.data.returnMessage?.ttl ?? 3000 });
        await chrome.storage.local.set({
            ['rcUnifiedCrmExtJwt']: res.data.jwtToken
        });
        const crmUserInfo = { name: res.data.name };
        await chrome.storage.local.set({ crmUserInfo });
        setAuth(true, crmUserInfo.name);
        trackCrmLogin();
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: 'goBack',
        }, '*');
        if (useLicense) {
            await refreshLicenseStatus({ serverUrl });
        }
        return res.data.jwtToken;
    }
    catch (e) {
        console.log(e);
        showNotification({ level: 'warning', message: 'Failed to register api key.', ttl: 3000 });
    }
}

async function onAuthCallback({ serverUrl, callbackUri, useLicense }) {
    const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).owner_id;
    const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
    const rcInfo = await indexDB.get('keyvaluepairs', 'dataFetcherV2-storageData');
    const platformInfo = await chrome.storage.local.get('platform-info');
    const hostname = platformInfo['platform-info'].hostname;
    let oauthCallbackUrl = '';
    // Unique: Bullhorn
    if (platformInfo['platform-info'].platformName === 'bullhorn') {
        const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
        const { crm_extension_bullhornUsername } = await chrome.storage.local.get({ crm_extension_bullhornUsername: null });
        oauthCallbackUrl = `${serverUrl}/oauth-callback?callbackUri=${callbackUri}&hostname=${hostname}&tokenUrl=${crm_extension_bullhorn_user_urls.oauthUrl}/token&apiUrl=${crm_extension_bullhorn_user_urls.restUrl}&username=${crm_extension_bullhornUsername}&rcAccountId=${rcInfo.value.cachedData.extensionInfo.account.id}`;
    }
    else {
        oauthCallbackUrl = `${serverUrl}/oauth-callback?callbackUri=${callbackUri}&hostname=${hostname}&rcAccountId=${rcInfo.value.cachedData.extensionInfo.account.id}`;
    }
    const res = await axios.get(oauthCallbackUrl);
    showNotification({ level: res.data.returnMessage?.messageType ?? 'success', message: res.data.returnMessage?.message ?? 'Successfully authorized.', ttl: res.data.returnMessage?.ttl ?? 3000 });
    if (!res.data.jwtToken) {
        return;
    }
    const crmUserInfo = { name: res.data.name };
    await chrome.storage.local.set({ crmUserInfo });
    setAuth(true, crmUserInfo.name);
    await chrome.storage.local.set({
        ['rcUnifiedCrmExtJwt']: res.data.jwtToken
    });
    trackCrmLogin();
    if (useLicense) {
        await refreshLicenseStatus({ serverUrl });
    }
    return res.data.jwtToken;
}

async function unAuthorize({ serverUrl, platformName, rcUnifiedCrmExtJwt }) {
    try {
        const res = await axios.post(`${serverUrl}/unAuthorize?jwtToken=${rcUnifiedCrmExtJwt}`);
        // Unique: Bullhorn
        if (platformName === 'bullhorn') {
            await chrome.storage.local.remove('crm_extension_bullhornUsername');
            await chrome.storage.local.remove('crm_extension_bullhorn_user_urls');
        }
        showNotification({ level: res.data.returnMessage?.messageType ?? 'success', message: res.data.returnMessage?.message ?? 'Successfully unauthorized.', ttl: res.data.returnMessage?.ttl ?? 3000 });
        trackCrmLogout()
    }
    catch (e) {
        console.log(e);
    }
    await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
    await chrome.storage.local.remove('serverSideLoggingToken');
    await chrome.storage.local.remove('isAdmin');
    await chrome.storage.local.remove('crmAuthed');
    setAuth(false);
}

async function checkAuth() {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    // get crm user info
    const { crmUserInfo } = (await chrome.storage.local.get({ crmUserInfo: null }));
    const { isAdmin } = (await chrome.storage.local.get({ isAdmin: null }));
    setAuth(!!rcUnifiedCrmExtJwt, crmUserInfo?.name);
    setAccountName(crmUserInfo?.name, isAdmin);
    return !!rcUnifiedCrmExtJwt;
}

function setAuth(auth, accountName) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-authorization-status',
        authorized: auth,
        authorizedAccount: accountName ?? ''
    });
}

function setAccountName(accountName, isAdmin) {
    if (isAdmin) {
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-update-authorization-status',
            authorized: true,
            authorizedAccount: `${accountName} (Admin)`
        });
    }

}

async function getLicenseStatus({ serverUrl }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const res = await axios.get(`${serverUrl}/licenseStatus?jwtToken=${rcUnifiedCrmExtJwt}`);
    const licenseStatusColor = res.data.isLicenseValid ? 'inherit' : 'danger.b04';

    return {
        licenseStatus: res.data.licenseStatus,
        licenseStatusColor,
        licenseStatusDescription: res.data.licenseStatusDescription
    };
}

async function refreshLicenseStatus({ serverUrl }) {
    const licenseStatusResponse = await getLicenseStatus({ serverUrl });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-refresh-license-status',
        licenseStatus: `License: ${licenseStatusResponse.licenseStatus}`,
        licenseStatusColor: licenseStatusResponse.licenseStatusColor,
        licenseDescription: licenseStatusResponse.licenseStatusDescription
    }, '*');
}

exports.submitPlatformSelection = submitPlatformSelection;
exports.apiKeyLogin = apiKeyLogin;
exports.onAuthCallback = onAuthCallback;
exports.unAuthorize = unAuthorize;
exports.checkAuth = checkAuth;
exports.setAuth = setAuth;
exports.setAccountName = setAccountName;
exports.getLicenseStatus = getLicenseStatus;
exports.refreshLicenseStatus = refreshLicenseStatus;