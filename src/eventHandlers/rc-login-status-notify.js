import { getPlatformInfo } from '../service/platformService';
import { getManifest, getPlatformList } from '../service/manifestService';
import authCore from '../core/auth';
import userCore from '../core/user';
import { showNotification, getRcAccessToken, getRcInfo } from '../lib/util';
import reportPage from '../components/reportPage/reportPage';
import calldownPage from '../components/calldownPage';
import appointmentsPage from '../components/appointmentsPage/appointmentsPage';
import { triggerPendingRecordingCheck } from '../lib/logUtil';
import { bullhornHeartbeat } from '../misc/bullhorn';
import axios from 'axios';
import { reset, identify, group, trackRcLogin, trackRcLogout } from '../lib/analytics';
import releaseNotesPage from '../components/releaseNotesPage';
import adminCore from '../core/admin';
import logService from '../service/logService';
import { RcAPI } from '../lib/rcAPI';
import pluginService from '../service/pluginService';

let firstTimeLogoutAbsorbed = false;

async function onEvent({ data }) {
    // ------------------------------
    // ------Process CRM login-------
    // ------------------------------

    // 1. Get meta info
    const platformInfo = await getPlatformInfo();
    const manifest = await getManifest();
    const platformName = platformInfo?.platformName ?? '';
    const platform = manifest?.platforms[platformName];
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    // get login status from widget
    const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} });
    if (data.loggedIn) {
        userPermissions.aiNote = data.features && data.features.smartNote;
        userPermissions.ringSenseInsights = data.features && data.features.ringSenseInsights;
        userPermissions.ringCX = data.features && data.features.ringCX;
        userPermissions.sms = data.features && data.features.sms;
        const rcInfo = await getRcInfo();
        const smsSendingEnabled = rcInfo?.value?.cachedData?.extensionFeatures?.records?.find(ef => ef.id === 'SMSSending')?.available ?? false;
        if (smsSendingEnabled) {
            userPermissions.c2sms = true;
        }
        await chrome.storage.local.set({ userPermissions });
    }
    console.log('rc-login-status-notify:', data.loggedIn, data.loginNumber, data.contractedCountryCode);

    let crmAuthed = !!rcUnifiedCrmExtJwt;
    // 2. If logged in
    if (data.loggedIn) {
        const { rcUserInfo } = await chrome.storage.local.get('rcUserInfo');
        // 2.1. If no platform info, show platform selection page
        if (!platformInfo) {
            const platformList = await getPlatformList();
            await authCore.checkAndOpenPlatformSelectionPage({ platformList });
        }
        document.getElementById('rc-widget').style.zIndex = 0;
        await chrome.storage.local.set({ crmAuthed })
        // 2.2. Manifest case: use RC login to login CRM as well
        if (!crmAuthed && !!platform?.autoLoginCRMWithRingCentralLogin) {
            if (manifest) {
                const returnedToken = await authCore.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: getRcAccessToken(), useLicense: platform.useLicense });
                try {
                    await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
                }
                catch (e) {
                    console.log(e);
                }
                crmAuthed = !!returnedToken;
                await chrome.storage.local.set({ crmAuthed })
            }
        }
        // 2.3. If CRM authenticated
        if (crmAuthed) {
            let userSettings = {};
            // 2.3.1. Set every 15min, user settings will refresh
            setInterval(async function () {
                userSettings = await userCore.refreshUserSettings({});
                await chrome.storage.local.set({ userSettings });
            }, 900000);
            // 2.3.2. init report tab
            const userReportStats = await userCore.getUserReportStats({ dateRange: 'Last 24 hours' });
            if (userCore.getShowUserReportTabSetting(userSettings).value) {
                const reportPageRender = reportPage.getReportsPageRender({ userStats: userReportStats, userSettings });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: reportPageRender,
                }, '*');
            }
            // 2.3.3. init calldown tab
            // Call Back tab (register only if enabled by admin)
            if (userCore.getShowCalldownTabSetting(userSettings).value) {
                const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: calldownPageRender,
                }, '*');
            }

            // 2.3.3.b init appointments tab
            // Register a placeholder tab immediately so it shows up without requiring reload,
            // then attempt to load records (which may fail transiently right after login).
            // Only register if the CRM manifest has not explicitly disabled appointment support.
            try {
                const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
                if (apptCfg.supported) {
                    // Read persisted user settings so the hidden flag reflects the user's saved preference,
                    // rather than the empty {} default (which would always default showAppointmentsTab to true).
                    const { userSettings: storedUserSettings } = await chrome.storage.local.get({ userSettings: {} });
                    const placeholder = appointmentsPage.getAppointmentsPageRender({
                        manifest,
                        platformName,
                        selectedTab: 'upcoming',
                        appointmentTitle: apptCfg?.title ?? 'Appointments',
                        showConfirm: apptCfg?.showConfirm !== false,
                        userSettings: storedUserSettings,
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: placeholder,
                    }, '*');
                }
            } catch (e) { /* ignore */ }
            // Do NOT fetch appointments here. List API will run only when user opens the tab or refreshes.

            // 2.3.4. Set every 5min, check if there's any pending recording link
            setInterval(async function () {
                await triggerPendingRecordingCheck({ serverUrl: manifest.serverUrl });
            }, 300000);

            // Unique: Bullhorn
            if (platform?.name === 'bullhorn') {
                bullhornHeartbeat({ platform });
                // every 30 min, 
                setInterval(function () {
                    bullhornHeartbeat({ platform });
                }, 1800000);
            }
        }
        // 2.4. If CRM not authed
        else if (!rcUnifiedCrmExtJwt) {
            // Unique: Pipedrive
            if (platform?.name === 'pipedrive') {
                chrome.runtime.sendMessage(
                    {
                        type: 'popupWindowRequestPipedriveCallbackUri'
                    }
                );
            }
            // Others
            else {
                authCore.setAuth(false);
            }
        }

        try {
            const rcInfo = await getRcInfo();
            const rcAdditionalSubmission = {};
            if (platform?.rcAdditionalSubmission) {
                for (const ras of platform.rcAdditionalSubmission) {
                    const pathSegments = ras.path.split('.');
                    let rcInfoSubmissionValue = null;
                    for (const ps of pathSegments) {
                        if (rcAdditionalSubmission === undefined) {
                            break;
                        }
                        if (rcInfoSubmissionValue === null) {
                            rcInfoSubmissionValue = rcInfo.value[ps];
                        }
                        else {
                            rcInfoSubmissionValue = rcInfoSubmissionValue[ps];
                        }
                    }

                    if (rcInfoSubmissionValue) {
                        rcAdditionalSubmission[ras.id] = rcInfoSubmissionValue;
                    }
                }
            }
            await chrome.storage.local.set({ rcAdditionalSubmission });
            if (manifest?.serverUrl) {
                const rcAPI = new RcAPI();
                const userInfoResponse = await rcAPI.getUserInfo({
                    serverUrl: manifest.serverUrl,
                    extensionId: rcInfo.value.cachedData.extensionInfo.id,
                    accountId: rcInfo.value.cachedData.extensionInfo.account.id
                });
                const rcUserInfo = {
                    rcUserName: rcInfo.value.cachedData.extensionInfo.name,
                    rcUserEmail: rcInfo.value.cachedData.extensionInfo.contact.email,
                    rcAccountId: userInfoResponse.accountId,
                    rcExtensionId: userInfoResponse.extensionId
                };
                await chrome.storage.local.set({ ['rcUserInfo']: rcUserInfo });
                reset();
                identify({ extensionId: rcUserInfo?.rcExtensionId, rcAccountId: rcUserInfo?.rcAccountId, platformName });
                group({ rcAccountId: rcUserInfo?.rcAccountId });
                // setup headers for server side analytics
                axios.defaults.headers.common['rc-extension-id'] = rcUserInfo?.rcExtensionId;
                axios.defaults.headers.common['rc-account-id'] = rcUserInfo?.rcAccountId;
                axios.defaults.headers.common['developer-author-name'] = manifest?.author?.name ?? "";
            }
            if (platformInfo && platform && authCore.isAdminManagedOAuthEnabled(platform)) {
                await authCore.checkManagedOAuthBeforeCrmVisible({ manifest, platformName, platform });
            }
        }
        catch (e) {
            reset();
            console.error(e);
        }
    }

    // ------------------------------
    // -------Process RC login-------
    // ------------------------------
    let { rcLoginStatus } = await chrome.storage.local.get('rcLoginStatus');
    // case 1: fresh login
    if (rcLoginStatus === undefined) {
        if (data.loggedIn) {
            trackRcLogin();
            rcLoginStatus = true;
            await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
            if (manifest?.serverUrl) {
                const userSettingsByAdmin = await userCore.preloadUserSettingsFromAdmin({ serverUrl: manifest.serverUrl });
            }
        }
    }
    // case 2: login status changed
    else {
        // case 2.1: logged in
        if (data.loggedIn && !rcLoginStatus) {
            trackRcLogin();
            rcLoginStatus = true;
            await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
        }
        // case 2.2: logged out
        if (!data.loggedIn && rcLoginStatus) {
            // first time open the extension, it'll somehow send a logout event anyway
            if (!firstTimeLogoutAbsorbed) {
                firstTimeLogoutAbsorbed = true;
            }
            else {
                trackRcLogout();
                rcLoginStatus = false;
                await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
            }
        }
    }
    // Check version and show release notes
    const registeredVersionInfo = await chrome.storage.local.get('rc-crm-extension-version');
    if (registeredVersionInfo[['rc-crm-extension-version']]) {
        const releaseNotesPageRender = await releaseNotesPage.getReleaseNotesPageRender({ manifest, platformName, registeredVersion: registeredVersionInfo['rc-crm-extension-version'] });
        if (releaseNotesPageRender) {
            await chrome.storage.local.set({ 'rc-crm-extension-version': manifest.version });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: releaseNotesPageRender
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${releaseNotesPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
            }, '*');
            showNotification({ level: 'success', message: `Updated to the latest version ${manifest.version}`, ttl: 60000 });
        }
    }

    // ------------------------------
    // --------Sync settings---------
    // ------------------------------

    if (crmAuthed && data.loggedIn) {
        await adminCore.refreshAdminSettings();
        const changedSettings = await pluginService.checkAndUpdatePluginVersion();
        await userCore.refreshUserSettings({ changedSettings });
        await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: rcUnifiedCrmExtJwt });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-update-authorization-status',
            authorized: crmAuthed
        }, '*');
        setInterval(function () {
            logService.forceCallLogMatcherCheck();
        }, 600000) // 10min
    }
}

exports.onEvent = onEvent;
