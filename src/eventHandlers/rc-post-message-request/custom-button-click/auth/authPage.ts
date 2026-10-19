import authCore from '../../../../core/auth';
import userCore from '../../../../core/user';
import reportPage from '../../../../components/reportPage/reportPage';
import calldownPage from '../../../../components/calldownPage';
import adminCore from '../../../../core/admin';
import adminPage from '../../../../components/admin/adminPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const returnedToken = await authCore.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: data.body.button.formData.apiKey, formData: data.body.button.formData, useLicense: platform.useLicense });
  const crmAuthed = !!returnedToken;
  await chrome.storage.local.set({ crmAuthed });
  await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
  if (crmAuthed) {
    const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings?: UnknownRecord };
    // report tab
    if (userCore.getShowUserReportTabSetting(userSettings).value) {
      const userReportStats = await userCore.getUserReportStats({ dateRange: 'Last 24 hours' });
      const reportPageRender = reportPage.getReportsPageRender({ userStats: userReportStats, userSettings });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: reportPageRender,
      }, '*');
    }
    // Call Back tab (register only if enabled by admin)
    if (userCore.getShowCalldownTabSetting(userSettings).value) {
      const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: calldownPageRender,
      }, '*');
    }
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
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
