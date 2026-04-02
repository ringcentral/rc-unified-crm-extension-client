import authCore from '../core/auth';
import userCore from '../core/user';
import adminCore from '../core/admin';
import reportPage from '../components/reportPage/reportPage';
import calldownPage from '../components/calldownPage';
import adminPage from '../components/admin/adminPage';
import { getPlatformInfo } from '../service/platformService';
import { getManifest } from '../service/manifestService';

async function onMessage({ request, sendResponse }) {
    if((await authCore.checkAuth())){
        sendResponse({ result: 'ok' });
        return;
    }
    const manifest = await getManifest();
    const platformInfo = await getPlatformInfo();
    const platform = manifest.platforms[platformInfo.platformName];
    const returnedToken = await authCore.onAuthCallback({ serverUrl: manifest.serverUrl, callbackUri: `${request.pipedriveCallbackUri}&state=platform=pipedrive`, useLicense: platform.useLicense });
    try {
      await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
    }
    catch (e) {
      console.log(e);
    }
    const crmAuthed = true;
    await chrome.storage.local.set({ crmAuthed });
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
    try {
      if (userCore.getShowCalldownTabSetting(userSettings).value) {
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
        const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, jwtToken: rcUnifiedCrmExtJwt, filterStatus: 'All', userSettings });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
          type: 'rc-adapter-register-customized-page',
          page: calldownPageRender,
        }, '*');
      }
    }
    catch (e) { /* ignore */ }
    // admin tab
    await chrome.storage.local.set({ crmAuthed });
    const adminSettingResults = await adminCore.refreshAdminSettings();
    if (adminSettingResults.adminSettings) {
      const adminPageRender = adminPage.getAdminPageRender({ platform });
      await userCore.refreshUserSettings({});
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminPageRender,
      }, '*');
      await adminCore.authAppConnectServer({ serverUrl: manifest.serverUrl, jwtToken: returnedToken });
    }
    // TODO: dismiss notification
    console.log('pipedriveAltAuthDone')
    chrome.runtime.sendMessage(
      {
        type: 'pipedriveAltAuthDone'
      }
    );
}

exports.onMessage = onMessage;