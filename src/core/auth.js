import axios from 'axios';
import { getRcAccessToken, getRcInfo, showNotification } from '../lib/util';
import { getPlatformInfo } from '../service/platformService';
import { getManifest } from '../service/manifestService';
import { trackCrmLogin, trackCrmLogout } from '../lib/analytics';
import { openDB } from 'idb';
import platformSelectionPage from '../components/platformSelectionPage';
import embeddableServices from '../service/embeddableServices';
import authPage from '../components/authPage';
import { tryConnectToBullhorn } from '../misc/bullhorn';
import { t } from '../i18n';
import { getPluginConfigurePageRender } from '../components/pluginConfigurePage';
import pluginService from '../service/pluginService';
import adminCore from './admin';
import userCore from './user';
import RcAPI from '../lib/rcAPI';

function handleThirdPartyOAuthWindow(oAuthUri) {
    chrome.runtime.sendMessage({
        type: 'openThirdPartyAuthWindow',
        oAuthUri
    });
}

async function onUserClickConnectButton({ platform, platformName, manifest }) {
    if (!platform || !platformName || !manifest) {
        const platformInfo = await getPlatformInfo();
        // eslint-disable-next-line no-param-reassign
        platformName = platformInfo?.platformName ?? '';
        // eslint-disable-next-line no-param-reassign
        manifest = await getManifest(true);
        // eslint-disable-next-line no-param-reassign
        platform = manifest?.platforms[platformName];
    }
    switch (platform.auth.type) {
        case 'oauth':
            let authUri;
            let customState = '';
            if (platform.auth.oauth.customState) {
                customState = platform.auth.oauth.customState;
            }
            // Unique: Pipedrive
            if (platformName === 'pipedrive') {
                authUri = manifest.platforms.pipedrive.auth.oauth.redirectUri;
                handleThirdPartyOAuthWindow(authUri);
            }
            // Unique: Bullhorn
            else if (platformName === 'bullhorn') {
                await tryConnectToBullhorn({ platform });
            }
            else {
                authUri = `${platform.auth.oauth.authUrl}?` +
                    `response_type=code` +
                    `&client_id=${platform.auth.oauth.clientId}` +
                    `${!!platform.auth.oauth.scope && platform.auth.oauth.scope != '' ? `&${platform.auth.oauth.scope}` : ''}` +
                    `&state=${customState === '' ? `platform=${platform.name}` : customState}` +
                    '&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html';
                handleThirdPartyOAuthWindow(authUri);
            }
            break;
        case 'apiKey':
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            const storedPlatformInfo = await chrome.storage.local.get('platform-info');
            const managedAuthState = await getManagedAuthState({
                serverUrl: manifest.serverUrl,
                platformName,
                connectorId: storedPlatformInfo?.['platform-info']?.connectorId ?? null,
                isPrivate: !!storedPlatformInfo?.['platform-info']?.isPrivate
            });
            if (managedAuthState?.allRequiredFieldsSatisfied) {
                const returnedToken = await apiKeyLogin({ serverUrl: manifest.serverUrl, useLicense: platform.useLicense, formData: {} });
                const crmAuthed = !!returnedToken;
                await chrome.storage.local.set({ crmAuthed });
                if (crmAuthed) {
                    await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
                    const adminSettingResults = await adminCore.refreshAdminSettings();
                    if (adminSettingResults.adminSettings) {
                        await adminCore.authAppConnectServer({ serverUrl: manifest.serverUrl });
                    }
                }
                // exit from platform selection page
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                }, '*');
                window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                return;
            }
            const authPageRender = authPage.getAuthPageRender({
                manifest,
                platformName,
                visibleFieldConsts: managedAuthState?.visibleFieldConsts ?? null
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: authPageRender
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${authPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
            }, '*');
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            break;
    }
}

async function getManagedAuthState({ serverUrl, platformName, connectorId = null, isPrivate = false, rcInfo = null, rcExtensionId = null, rcAccountId = null }) {
    try {
        const rcAccessToken = getRcAccessToken();
        const rcAPI = new RcAPI();
        const interopCode = await rcAPI.getInteropCode({ rcAccessToken, rcClientId: "Y4m1YREFKbXdDoet5djv46" });
        const resolvedRcInfo = rcInfo ?? await getRcInfo();
        const resolvedRcAccountId = rcAccountId ?? resolvedRcInfo?.value?.cachedData?.extensionInfo?.account?.id;
        const resolvedRcExtensionId = rcExtensionId ?? resolvedRcInfo?.value?.cachedData?.extensionInfo?.id;
        const response = await axios.get(
            `${serverUrl}/apiKeyManagedAuthState?platform=${encodeURIComponent(platformName)}&connectorId=${encodeURIComponent(connectorId ?? '')}&isPrivate=${encodeURIComponent(isPrivate ? 'true' : 'false')}&rcAccountId=${encodeURIComponent(resolvedRcAccountId ?? '')}&rcExtensionId=${encodeURIComponent(resolvedRcExtensionId ?? '')}&interopCode=${encodeURIComponent(interopCode ?? '')}`
        );
        return response.data;
    }
    catch (error) {
        return null;
    }
}

async function checkAndOpenPlatformSelectionPage({ platformList }) {
    const platformInfo = await getPlatformInfo();
    if (!platformInfo) {
        await embeddableServices.preconfigureServiceManifest();
        const platformSelectionPageRender = platformSelectionPage.getPlatformSelectionPageRender({ platformList });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: platformSelectionPageRender,
        }, '*');
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/customized/${platformSelectionPageRender.id}`
        }, '*');
    }
}

// apiUrl: Insightly
// username, password: Redtail
async function apiKeyLogin({ serverUrl, apiKey, formData, useLicense }) {
    try {
        const platformInfo = await chrome.storage.local.get('platform-info');
        const platformName = platformInfo['platform-info'].platformName;
        const hostname = platformInfo['platform-info'].hostname;
        const connectorId = platformInfo['platform-info'].connectorId;
        const isPrivate = !!platformInfo['platform-info'].isPrivate;
        const manifest = await getManifest();
        const platform = manifest?.platforms[platformName];
        const proxyId = platform.proxyId ? platform.proxyId : '';
        const rcInfo = await getRcInfo();
        const rcAccessToken = getRcAccessToken();
        const rcAPI = new RcAPI();
        const interopCode = await rcAPI.getInteropCode({ rcAccessToken, rcClientId: "Y4m1YREFKbXdDoet5djv46" });
        const res = await axios.post(`${serverUrl}/apiKeyLogin?state=platform=${platformName}`, {
            apiKey,
            platform: platformName,
            hostname,
            proxyId,
            interopCode,
            connectorId,
            isPrivate,
            rcAccountId: rcInfo.value.cachedData.extensionInfo.account.id,
            rcExtensionId: rcInfo.value.cachedData.extensionInfo.id,
            userEmail: rcInfo.value.cachedData.extensionInfo.contact.email,
            additionalInfo: {
                ...formData
            }
        });
        setAuth(true);
        showNotification({ level: res.data.returnMessage?.messageType ?? 'success', message: res.data.returnMessage?.message ?? t('notifications.success.authorized'), ttl: res.data.returnMessage?.ttl ?? 3000 });
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
        showNotification({ level: e.response?.data?.returnMessage?.messageType ?? 'warning', message: e.response?.data?.returnMessage?.message ?? 'Failed to register api key.', ttl: 3000 });
    }
}

async function onAuthCallback({ serverUrl, callbackUri, useLicense }) {
    // Case: from plugin
    try {
        const stateData = JSON.parse(decodeURIComponent(new URLSearchParams(new URL(callbackUri).search).get('state') ?? '{}'));
        if (stateData?.from === 'plugin' && stateData?.redirectTo) {
            const pluginCallbackResp = await axios.get(`${stateData.redirectTo}?callbackUri=${callbackUri}`);
            showNotification({ level: 'success', message: 'Successfully authorized plugin.' });
            const { cachedPluginConfigFormData } = await chrome.storage.local.get('cachedPluginConfigFormData');
            const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ pluginId: cachedPluginConfigFormData.pluginId, plugin: cachedPluginConfigFormData.plugin });
            const pluginConfigurePageRender = getPluginConfigurePageRender({
                pluginId: cachedPluginConfigFormData.pluginId,
                pluginAccess: cachedPluginConfigFormData.access,
                plugin: cachedPluginConfigFormData.plugin,
                config: cachedPluginConfigFormData.config,
                isLoggedIn: true,
                hasValidLicense: licenseStatus,
                licenseStatusDescription
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: pluginConfigurePageRender
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${pluginConfigurePageRender.id}`
            }, '*');
            await chrome.storage.local.remove('cachedPluginConfigFormData');
            return;
        }
    }
    catch (e) {
        console.warn('Auth callback not from plugin');
    }
    // Case: connectors
    const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).owner_id;
    const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
    const rcInfo = await indexDB.get('keyvaluepairs', 'dataFetcherV2-storageData');
    const platformInfo = await chrome.storage.local.get('platform-info');
    const hostname = platformInfo['platform-info'].hostname;
    const manifest = await getManifest();
    const platform = manifest.platforms[platformInfo['platform-info'].platformName];
    const proxyId = platform.proxyId ? platform.proxyId : '';
    let params;
    // Unique: Bullhorn
    if (platformInfo['platform-info'].platformName === 'bullhorn') {
        const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
        const { crm_extension_bullhornUsername } = await chrome.storage.local.get({ crm_extension_bullhornUsername: null });
        params = new URLSearchParams({
            callbackUri,
            hostname,
            tokenUrl: crm_extension_bullhorn_user_urls.oauthUrl + '/token',
            apiUrl: crm_extension_bullhorn_user_urls.restUrl,
            username: crm_extension_bullhornUsername,
            rcAccountId: rcInfo.value.cachedData.extensionInfo.account.id,
            rcExtensionId: rcInfo.value.cachedData.extensionInfo.id
        });
    }
    else {
        params = new URLSearchParams({
            callbackUri,
            hostname,
            rcAccountId: rcInfo.value.cachedData.extensionInfo.account.id,
            proxyId,
            userEmail: rcInfo.value.cachedData.extensionInfo.contact.email,
            rcExtensionId: rcInfo.value.cachedData.extensionInfo.id
        });
    }
    const oauthCallbackUrl = `${serverUrl}/oauth-callback?${params.toString()}`;
    const res = await axios.get(oauthCallbackUrl);
    showNotification({ level: res.data.returnMessage?.messageType ?? 'success', message: res.data.returnMessage?.message ?? t('notifications.success.authorized'), ttl: res.data.returnMessage?.ttl ?? 3000 });
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

async function unAuthorize({ serverUrl, isShowNotification = true }) {
    try {
        const res = await axios.post(`${serverUrl}/unAuthorize`);
        if (isShowNotification) {
            showNotification({ level: res.data.returnMessage?.messageType ?? 'success', message: res.data.returnMessage?.message ?? t('notifications.success.unauthorized'), ttl: res.data.returnMessage?.ttl ?? 3000 });
        }
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
    setAuth(!!rcUnifiedCrmExtJwt, crmUserInfo?.name, isAdmin);
    return !!rcUnifiedCrmExtJwt;
}

function setAuth(auth, accountName, isAdmin = false) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-authorization-status',
        authorized: auth,
        authorizedAccount: accountName ? `${accountName} ${isAdmin ? '(Admin)' : ''}` : ''
    });
}

async function getLicenseStatus({ serverUrl }) {
    const res = await axios.get(`${serverUrl}/licenseStatus`);
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

exports.handleThirdPartyOAuthWindow = handleThirdPartyOAuthWindow;
exports.onUserClickConnectButton = onUserClickConnectButton;
exports.checkAndOpenPlatformSelectionPage = checkAndOpenPlatformSelectionPage;
exports.apiKeyLogin = apiKeyLogin;
exports.getManagedAuthState = getManagedAuthState;
exports.onAuthCallback = onAuthCallback;
exports.unAuthorize = unAuthorize;
exports.checkAuth = checkAuth;
exports.setAuth = setAuth;
exports.getLicenseStatus = getLicenseStatus;
exports.refreshLicenseStatus = refreshLicenseStatus;
