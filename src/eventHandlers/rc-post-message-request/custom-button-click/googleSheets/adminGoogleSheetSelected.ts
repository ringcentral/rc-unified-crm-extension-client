import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import adminGoogleSheetsPage from '../../../../components/admin/adminGoogleSheetsPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  void userCore;
  // Handle admin Google Sheet selection from file picker
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { pendingAdminGoogleSheetsSelection } = await chrome.storage.local.get('pendingAdminGoogleSheetsSelection') as { pendingAdminGoogleSheetsSelection?: UnknownRecord };
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };

  if (pendingAdminGoogleSheetsSelection && data.body.sheetName && data.body.sheetUrl) {
    // Check if selection is recent (within 5 minutes)
    const isRecentSelection = pendingAdminGoogleSheetsSelection.timestamp
      && (Date.now() - pendingAdminGoogleSheetsSelection.timestamp < 300000);

    if (isRecentSelection) {
      const isManaged = pendingAdminGoogleSheetsSelection.forceGoogleSheets || false;

      // Set admin settings for selected Google Sheet
      adminSettings.userSettings.googleSheetsName = {
        value: data.body.sheetName,
        customizable: !isManaged,
      };
      adminSettings.userSettings.googleSheetsUrl = {
        value: data.body.sheetUrl,
        customizable: !isManaged,
      };

      await chrome.storage.local.set({ adminSettings });
      await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });

      // Clear pending selection
      await chrome.storage.local.remove('pendingAdminGoogleSheetsSelection');

      showNotification({
        level: 'success',
        message: `Admin Google Sheet "${data.body.sheetName}" selected successfully${isManaged ? ' and enforced for all users' : ''}`,
        ttl: 5000,
      });

      // Re-render admin page to show the "sheet exists" UI
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings }),
      });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/customized/adminGoogleSheetsPage', // page id
      }, '*');
    } else {
      showNotification({ level: 'warning', message: 'Sheet selection expired, please try again', ttl: 3000 });
    }
  } else {
    showNotification({ level: 'warning', message: 'Failed to select sheet', ttl: 5000 });
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
