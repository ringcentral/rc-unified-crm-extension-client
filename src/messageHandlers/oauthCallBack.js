import authCore from '../core/auth';
import userCore from '../core/user';
import adminCore from '../core/admin';
import reportPage from '../components/reportPage/reportPage';
import calldownPage from '../components/calldownPage';
import adminPage from '../components/admin/adminPage';
import { getPlatformInfo } from '../service/platformService';
import { getManifest } from '../service/manifestService';

async function onMessage({ request, sendResponse }) {
    switch (request.platform) {
        case 'rc':
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-authorization-code',
                callbackUri: request.callbackUri,
            }, '*');
            // remove previous crm auth if existing
            await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
            break;
        case 'thirdParty':
            window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
            const manifest = await getManifest();
            const platformInfo = await getPlatformInfo();
            const platform = manifest?.platforms[platformInfo?.platformName ?? ''];
            const returnedToken = await authCore.onAuthCallback({ serverUrl: manifest.serverUrl, callbackUri: request.callbackUri, useLicense: platform.useLicense });
            window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
            if (!returnedToken) {
                sendResponse({ result: 'error' });
                break;
            }
            try {
                await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
            }
            catch (e) {
                console.log(e);
            }
            const crmAuthed = !!returnedToken;
            await chrome.storage.local.set({ crmAuthed });
            if (crmAuthed) {
                const { userSettings } = await chrome.storage.local.get('userSettings');
                // report tab
                if (userCore.getShowUserReportTabSetting(userSettings).value) {
                    const userReportStats = await userCore.getUserReportStats({ dateRange: 'Last 24 hours' });
                    const reportPageRender = reportPage.getReportsPageRender({ userStats: userReportStats, userSettings });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: reportPageRender,
                    }, '*');
                }
                // Call Back tab (register only if enabled by admin)
                if (userCore.getShowCalldownTabSetting(userSettings).value) {
                    const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: calldownPageRender,
                    }, '*');
                }

                // admin tab
                const adminSettingResults = await adminCore.refreshAdminSettings();
                if (adminSettingResults.adminSettings) {
                    const adminPageRender = adminPage.getAdminPageRender({ platform });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: adminPageRender,
                    }, '*');
                    await adminCore.authAppConnectServer({ serverUrl: manifest.serverUrl, jwtToken: returnedToken });
                }
                await userCore.refreshUserSettings({});
            }
            break;
    }
    sendResponse({ result: 'ok' });
}

exports.onMessage = onMessage;
