import authCore from '../core/auth';
import userCore from '../core/user';
import adminCore from '../core/admin';
import reportPage from '../components/reportPage/reportPage';
import calldownPage from '../components/calldownPage';
import appointmentsPage from '../components/appointmentsPage/appointmentsPage';
import adminPage from '../components/admin/adminPage';
import { getPlatformInfo } from '../service/platformService';
import { getManifest } from '../service/manifestService';

type UnknownRecord = Record<string, any>;

type MessageHandlerOptions = {
  request: UnknownRecord;
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  switch (request.platform) {
    case 'rc':
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-authorization-code',
        callbackUri: request.callbackUri,
      }, '*');
      // remove previous crm auth if existing
      await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
      break;
    case 'thirdParty': {
      window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
      const manifest = await getManifest() as UnknownRecord;
      const platformInfo = await getPlatformInfo() as UnknownRecord | null | undefined;
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
        // Call Back tab (register only if enabled by admin)
        if (userCore.getShowCalldownTabSetting(userSettings).value) {
          const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
          getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-register-customized-page',
            page: calldownPageRender,
          }, '*');
        }

        // Register a placeholder tab immediately so it shows up without requiring reload,
        // then attempt to load records (which may fail transiently right after auth).
        // Only register if the CRM manifest has explicitly enabled appointment support.
        try {
          const platformName = platformInfo?.platformName ?? '';
          const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
          if (apptCfg.supported) {
            const placeholder = appointmentsPage.getAppointmentsPageRender({
              manifest,
              platformName: platformInfo?.platformName ?? '',
              selectedTab: 'upcoming',
              appointmentTitle: apptCfg?.title ?? 'Appointments',
              showConfirm: apptCfg?.showConfirm !== false,
              userSettings,
            });
            getWidgetFrameWindow().postMessage({
              type: 'rc-adapter-register-customized-page',
              page: placeholder,
            }, '*');
          }
        } catch (e) { void e; /* ignore */ }
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
      break;
    }
  }
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
};
