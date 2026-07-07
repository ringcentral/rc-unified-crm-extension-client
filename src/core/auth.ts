import axios from 'axios';
import { getRcAccessToken, getRcInfo, showNotification, setRcAdditionalSubmission } from '../lib/util';
import { getPlatformInfo } from '../service/platformService';
import { getManifest as getManifestBase } from '../service/manifestService';
import { trackCrmLogin, trackCrmLogout } from '../lib/analytics';
import { openDB } from 'idb';
import platformSelectionPage from '../components/platformSelectionPage';
import embeddableServices from '../service/embeddableServices';
import authPage from '../components/authPage';
import managedOAuthSetupPage from '../components/managedOAuthSetupPage';
import managedOAuthMissingPage from '../components/managedOAuthMissingPage';
import { tryConnectToBullhorn } from '../misc/bullhorn';
import { t } from '../i18n';
import { getMergedPluginConfigFromFormData, getPluginConfigurePageRender } from '../components/pluginConfigurePage';
import pluginService from '../service/pluginService';
import adminCore from './admin';
import userCore from './user';

type UnknownRecord = Record<string, any>;

const chromeStorageLocal = chrome.storage.local as any;

async function getManifest(forceReload?: boolean): Promise<UnknownRecord> {
    return (await getManifestBase(forceReload as any)) as UnknownRecord;
}

function getWidgetFrame(): UnknownRecord {
    return document.querySelector("#rc-widget-adapter-frame") as UnknownRecord;
}

function handleThirdPartyOAuthWindow(oAuthUri: string): void {
    chrome.runtime.sendMessage({
        type: 'openThirdPartyAuthWindow',
        oAuthUri
    });
}

function isAdminManagedOAuthEnabled(platform: UnknownRecord): boolean {
    return platform?.auth?.type === 'oauth' && platform?.auth?.oauth?.adminManaged?.enabled === true;
}

function buildOAuthUrl({ authorizationUri, clientId, redirectUri, scopes, customState, platformName }: UnknownRecord): string {
    const state = customState === '' || !customState ? `platform=${platformName}` : customState;
    const scopeQuery = scopes
        ? (scopes.includes('=') ? `&${scopes}` : `&scope=${encodeURIComponent(scopes)}`)
        : '';
    return `${authorizationUri}?` +
        'response_type=code' +
        `&client_id=${encodeURIComponent(clientId)}` +
        scopeQuery +
        `&state=${state}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

async function onUserClickConnectButton({ platform, platformName, manifest }: UnknownRecord): Promise<any> {
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
            if (isAdminManagedOAuthEnabled(platform)) {
                const managedOAuthState = await getManagedOAuthState({
                    serverUrl: manifest.serverUrl,
                    platformName
                });
                const managedOAuthValues = managedOAuthState?.oauthValues ?? managedOAuthState?.pendingValues;
                if (!managedOAuthValues) {
                    showNotification({ level: 'warning', message: 'Authorization information is not provided. Please contact the admin user.', ttl: 60000 });
                    return;
                }
                authUri = buildOAuthUrl({
                    authorizationUri: managedOAuthValues.authorizationUri,
                    clientId: managedOAuthValues.clientId,
                    redirectUri: managedOAuthValues.redirectUri,
                    scopes: managedOAuthValues.scopes,
                    customState,
                    platformName: platform.name
                });
                handleThirdPartyOAuthWindow(authUri);
            }
            // Unique: Pipedrive
            else if (platformName === 'pipedrive') {
                authUri = manifest.platforms.pipedrive.auth.oauth.redirectUri;
                handleThirdPartyOAuthWindow(authUri);
            }
            // Unique: Bullhorn
            else if (platformName === 'bullhorn') {
                await tryConnectToBullhorn({ platform });
            }
            else {
                authUri = buildOAuthUrl({
                    authorizationUri: platform.auth.oauth.authUrl,
                    clientId: platform.auth.oauth.clientId,
                    redirectUri: platform.auth.oauth.redirectUri ?? 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html',
                    scopes: platform.auth.oauth.scope,
                    customState,
                    platformName: platform.name
                });
                handleThirdPartyOAuthWindow(authUri);
            }
            break;
        case 'apiKey':
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            const storedPlatformInfo = await chromeStorageLocal.get('platform-info');
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
                        await adminCore.authAppConnectServer({ serverUrl: manifest.serverUrl, jwtToken: returnedToken });
                    }
                }
                // exit from platform selection page
                getWidgetFrame().contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                }, '*');
                window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                return;
            }
            const rcInfo = await getRcInfo();
            const isAdmin = !!rcInfo?.value?.cachedData?.extensionInfo?.permissions?.admin?.enabled;
            const authPageRender = authPage.getAuthPageRender({
                manifest,
                platformName,
                visibleFieldConsts: managedAuthState?.visibleFieldConsts ?? null,
                isAdmin
            });
            getWidgetFrame().contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: authPageRender
            });
            getWidgetFrame().contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${authPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
            }, '*');
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            break;
    }
}

async function getManagedOAuthState({ serverUrl, platformName }: UnknownRecord): Promise<any> {
    try {
        const rcAccessToken = getRcAccessToken();
        const response = await axios.get(
            `${serverUrl}/oauthManagedAuthState?platform=${encodeURIComponent(platformName)}&rcAccessToken=${encodeURIComponent(rcAccessToken ?? '')}`
        );
        return response.data;
    }
    catch (error) {
        return null;
    }
}

async function saveManagedOAuthPendingValues({ serverUrl, values }: UnknownRecord): Promise<any> {
    const rcAccessToken = getRcAccessToken();
    const response = await axios.post(
        `${serverUrl}/admin/managedOAuth/cache?rcAccessToken=${encodeURIComponent(rcAccessToken ?? '')}`,
        { values }
    );
    return response.data;
}

async function checkManagedOAuthBeforeCrmVisible({ manifest, platformName, platform }: UnknownRecord): Promise<any> {
    if (!isAdminManagedOAuthEnabled(platform)) {
        return {
            blocked: false
        };
    }
    const managedOAuthState = await getManagedOAuthState({
        serverUrl: manifest.serverUrl,
        platformName
    });
    if (managedOAuthState?.hasAccountOAuth) {
        return {
            blocked: false,
            state: managedOAuthState
        };
    }
    const page = managedOAuthState?.isAdmin
        ? managedOAuthSetupPage.getManagedOAuthSetupPageRender({
            platform,
            pendingValues: managedOAuthState?.pendingValues ?? {}
        })
        : managedOAuthMissingPage.getManagedOAuthMissingPageRender();
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page
    }, '*');
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${page.id}`,
    }, '*');
    return {
        blocked: true,
        state: managedOAuthState
    };
}

async function getManagedAuthState({ serverUrl, platformName, connectorId = null, isPrivate = false, rcInfo = null, rcExtensionId = null, rcAccountId = null }: UnknownRecord): Promise<any> {
    try {
        const rcAccessToken = getRcAccessToken();
        const resolvedRcInfo = rcInfo ?? await getRcInfo();
        const resolvedRcAccountId = rcAccountId ?? resolvedRcInfo?.value?.cachedData?.extensionInfo?.account?.id;
        const resolvedRcExtensionId = rcExtensionId ?? resolvedRcInfo?.value?.cachedData?.extensionInfo?.id;
        const response = await axios.get(
            `${serverUrl}/apiKeyManagedAuthState?platform=${encodeURIComponent(platformName)}&connectorId=${encodeURIComponent(connectorId ?? '')}&isPrivate=${encodeURIComponent(isPrivate ? 'true' : 'false')}&rcAccountId=${encodeURIComponent(resolvedRcAccountId ?? '')}&rcExtensionId=${encodeURIComponent(resolvedRcExtensionId ?? '')}&rcAccessToken=${encodeURIComponent(rcAccessToken ?? '')}`
        );
        return response.data;
    }
    catch (error) {
        return null;
    }
}

async function checkAndOpenPlatformSelectionPage({ platformList }: UnknownRecord): Promise<any> {
    const platformInfo = await getPlatformInfo();
    if (!platformInfo) {
        await embeddableServices.preconfigureServiceManifest();
        const platformSelectionPageRender = platformSelectionPage.getPlatformSelectionPageRender({ platformList });
        getWidgetFrame().contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: platformSelectionPageRender,
        }, '*');
        getWidgetFrame().contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/customized/${platformSelectionPageRender.id}`
        }, '*');
    }
}

// apiUrl: Insightly
// username, password: Redtail
async function apiKeyLogin({ serverUrl, apiKey, formData, useLicense }: UnknownRecord): Promise<any> {
    try {
        const platformInfo = await chromeStorageLocal.get('platform-info');
        const platformName = platformInfo['platform-info'].platformName;
        const hostname = platformInfo['platform-info'].hostname;
        const connectorId = platformInfo['platform-info'].connectorId;
        const isPrivate = !!platformInfo['platform-info'].isPrivate;
        const manifest = await getManifest();
        const platform = manifest?.platforms[platformName];
        const proxyId = platform.proxyId ? platform.proxyId : '';
        const rcInfo = await getRcInfo();
        const rcAccessToken = getRcAccessToken();
        const rcAdditionalSubmission = await setRcAdditionalSubmission({ rcInfo, platform });
        const res = await axios.post(`${serverUrl}/apiKeyLogin?state=platform=${platformName}`, {
            apiKey,
            platform: platformName,
            hostname,
            proxyId,
            rcAccessToken,
            connectorId,
            isPrivate,
            rcAccountId: rcInfo.value.cachedData.extensionInfo.account.id,
            rcExtensionId: rcInfo.value.cachedData.extensionInfo.id,
            userEmail: rcInfo.value.cachedData.extensionInfo.contact.email,
            additionalInfo: {
                ...formData,
                ...rcAdditionalSubmission
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
        getWidgetFrame().contentWindow.postMessage({
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

async function onAuthCallback({ serverUrl, callbackUri, useLicense }: UnknownRecord): Promise<any> {
    // Case: from plugin
    try {
        const stateData = JSON.parse(decodeURIComponent(new URLSearchParams(new URL(callbackUri).search).get('state') ?? '{}'));
        if (stateData?.from === 'plugin' && stateData?.redirectTo) {
            const { rcUserInfo } = await chromeStorageLocal.get({ rcUserInfo: null });
            const hashedExtensionId = rcUserInfo?.rcExtensionId ?? '';
            const pluginCallbackResp = await axios.get(`${stateData.redirectTo}?hashedExtensionId=${hashedExtensionId}&callbackUri=${callbackUri}`);
            showNotification({ level: 'success', message: 'Successfully authorized plugin.' });
            const { cachedPluginConfigFormData } = await chromeStorageLocal.get('cachedPluginConfigFormData');
            const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ pluginId: cachedPluginConfigFormData.pluginId, plugin: cachedPluginConfigFormData.plugin });
            const pluginConfigurePageRender = getPluginConfigurePageRender({
                pluginId: cachedPluginConfigFormData.pluginId,
                pluginAccess: cachedPluginConfigFormData.access,
                plugin: cachedPluginConfigFormData.plugin,
                config: getMergedPluginConfigFromFormData(cachedPluginConfigFormData),
                isLoggedIn: true,
                hasValidLicense: licenseStatus,
                licenseStatusDescription
            });
            getWidgetFrame().contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: pluginConfigurePageRender
            });
            getWidgetFrame().contentWindow.postMessage({
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
    const platformInfo = await chromeStorageLocal.get('platform-info');
    const hostname = platformInfo['platform-info'].hostname;
    const manifest = await getManifest();
    const platform = manifest.platforms[platformInfo['platform-info'].platformName];
    const proxyId = platform.proxyId ? platform.proxyId : '';
    let params;
    // Unique: Bullhorn
    if (platformInfo['platform-info'].platformName === 'bullhorn') {
        const { crm_extension_bullhorn_user_urls } = await chromeStorageLocal.get({ crm_extension_bullhorn_user_urls: null });
        const { crm_extension_bullhornUsername } = await chromeStorageLocal.get({ crm_extension_bullhornUsername: null });
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

async function clearLocalCrmAuthState(): Promise<boolean> {
    const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get('rcUnifiedCrmExtJwt');
    const hadJwt = !!rcUnifiedCrmExtJwt;
    const platformInfo = await chromeStorageLocal.get('platform-info');
    const platformName = platformInfo['platform-info']?.platformName;
    if (platformName === 'bullhorn') {
        await chrome.storage.local.remove('crm_extension_bullhornUsername');
        await chrome.storage.local.remove('crm_extension_bullhorn_user_urls');
    }
    await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
    await chrome.storage.local.remove('serverSideLoggingToken');
    await chrome.storage.local.remove('isAdmin');
    await chrome.storage.local.remove('crmAuthed');
    setAuth(false);
    return hadJwt;
}

async function syncCrmAuthedFromStorage(): Promise<boolean> {
    const { rcUnifiedCrmExtJwt, crmAuthed } = await chromeStorageLocal.get(['rcUnifiedCrmExtJwt', 'crmAuthed']);
    const isAuthed = !!rcUnifiedCrmExtJwt;
    if (isAuthed !== !!crmAuthed) {
        await chrome.storage.local.set({ crmAuthed: isAuthed });
    }
    return isAuthed;
}

async function unAuthorize({ serverUrl, isShowNotification = true }: UnknownRecord): Promise<any> {
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
    await clearLocalCrmAuthState();
}

async function checkAuth(): Promise<boolean> {
    const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get('rcUnifiedCrmExtJwt');
    // get crm user info
    const { crmUserInfo } = (await chromeStorageLocal.get({ crmUserInfo: null }));
    const { isAdmin } = (await chromeStorageLocal.get({ isAdmin: null }));
    setAuth(!!rcUnifiedCrmExtJwt, crmUserInfo?.name, isAdmin);
    return !!rcUnifiedCrmExtJwt;
}

function setAuth(auth: boolean, accountName?: string, isAdmin = false): void {
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-update-authorization-status',
        authorized: auth,
        authorizedAccount: accountName ? `${accountName} ${isAdmin ? '(Admin)' : ''}` : ''
    });
}

async function getLicenseStatus({ serverUrl }: UnknownRecord): Promise<any> {
    const res = await axios.get(`${serverUrl}/licenseStatus`);
    const licenseStatusColor = res.data.isLicenseValid ? 'inherit' : 'danger.b04';

    return {
        licenseStatus: res.data.licenseStatus,
        licenseStatusColor,
        licenseStatusDescription: res.data.licenseStatusDescription
    };
}

async function refreshLicenseStatus({ serverUrl }: UnknownRecord): Promise<any> {
    const licenseStatusResponse = await getLicenseStatus({ serverUrl });
    getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-refresh-license-status',
        licenseStatus: `License: ${licenseStatusResponse.licenseStatus}`,
        licenseStatusColor: licenseStatusResponse.licenseStatusColor,
        licenseDescription: licenseStatusResponse.licenseStatusDescription
    }, '*');
}

const authCore = {
    handleThirdPartyOAuthWindow,
    onUserClickConnectButton,
    checkAndOpenPlatformSelectionPage,
    isAdminManagedOAuthEnabled,
    buildOAuthUrl,
    getManagedOAuthState,
    saveManagedOAuthPendingValues,
    checkManagedOAuthBeforeCrmVisible,
    apiKeyLogin,
    getManagedAuthState,
    onAuthCallback,
    unAuthorize,
    clearLocalCrmAuthState,
    syncCrmAuthedFromStorage,
    checkAuth,
    setAuth,
    getLicenseStatus,
    refreshLicenseStatus,
};

export {
    handleThirdPartyOAuthWindow,
    onUserClickConnectButton,
    checkAndOpenPlatformSelectionPage,
    isAdminManagedOAuthEnabled,
    buildOAuthUrl,
    getManagedOAuthState,
    saveManagedOAuthPendingValues,
    checkManagedOAuthBeforeCrmVisible,
    apiKeyLogin,
    getManagedAuthState,
    onAuthCallback,
    unAuthorize,
    clearLocalCrmAuthState,
    syncCrmAuthedFromStorage,
    checkAuth,
    setAuth,
    getLicenseStatus,
    refreshLicenseStatus,
};

export default authCore;
