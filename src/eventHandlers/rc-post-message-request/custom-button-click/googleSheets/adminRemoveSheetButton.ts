import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import adminGoogleSheetsPage from '../../../../components/admin/adminGoogleSheetsPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };

  // Remove admin Google Sheets settings
  adminSettings.userSettings.googleSheetsName = {
    value: '',
    customizable: true,
  };
  adminSettings.userSettings.googleSheetsUrl = {
    value: '',
    customizable: true,
  };

  await chrome.storage.local.set({ adminSettings });
  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
  await userCore.refreshUserSettings({
    changedSettings: {
      googleSheetsName: {
        value: '',
      },
      googleSheetsUrl: {
        value: '',
      },
    },
  });

  showNotification({ level: 'success', message: 'Admin Google Sheet removed successfully', ttl: 3000 });

  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings }),
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/adminGoogleSheetsPage', // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
