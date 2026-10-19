import authCore from '../core/auth';
import userCore from '../core/user';
import adminCore from '../core/admin';
import reportPage from '../components/reportPage/reportPage';
import calldownPage from '../components/calldownPage';
import adminPage from '../components/admin/adminPage';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';

type UnknownRecord = Record<string, any>;

type MessageHandlerOptions = {
  request: UnknownRecord;
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  void sendResponse;
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo() as UnknownRecord | null | undefined;
  const platformName = platformInfo?.platformName ?? '';
  const platform = manifest?.platforms[platformName];
  const returnedToken = await authCore.apiKeyLogin({
    serverUrl: manifest.serverUrl,
    apiKey: request.apiKey,
    formData: {
      apiUrl: request.apiUrl,
    },
    useLicense: platform.useLicense,
  });
  try {
    await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
  }
  catch (e) {
    console.log(e);
  }
  const crmAuthed = !!returnedToken;
  await chrome.storage.local.set({ crmAuthed });
  if (crmAuthed) {
    const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
    // report tab
    if (userCore.getShowUserReportTabSetting(userSettings).value) {
      const userReportStats = await userCore.getUserReportStats({ dateRange: 'Last 24 hours' });
      const reportPageRender = reportPage.getReportsPageRender({ userStats: userReportStats, userSettings });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: reportPageRender,
      }, '*');
    }

    if (userCore.getShowCalldownTabSetting(userSettings).value) {
      const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: calldownPageRender,
      }, '*');
    }

    // Appointments tab (Automotive Connect)
    // Do NOT fetch appointments here. List API will run only when user opens the tab or refreshes.
    // admin tab
    const adminSettingResults = await adminCore.refreshAdminSettings();
    if (adminSettingResults.adminSettings) {
      const adminPageRender = adminPage.getAdminPageRender({ platform });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminPageRender,
      }, '*');
      await adminCore.authAppConnectServer({ serverUrl: manifest.serverUrl, jwtToken: returnedToken });
    }
    await userCore.refreshUserSettings({});
  }
  window.postMessage({ type: 'rc-apiKey-input-modal-close', platform: platform.name }, '*');
  chrome.runtime.sendMessage({
    type: 'openPopupWindow',
  });
}

export default {
  onMessage,
};
