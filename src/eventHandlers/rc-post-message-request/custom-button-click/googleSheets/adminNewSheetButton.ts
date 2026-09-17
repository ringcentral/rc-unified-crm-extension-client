import axios from 'axios';
import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification, getRcAccessToken } from '../../../../lib/util';
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
  const rcAccessTokenNewSheet = getRcAccessToken();
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  const { rcUnifiedCrmExtJwt: jwtToken } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };

  try {
    const adminNewSheetResponse = await axios.post(`${manifest.serverUrl}/admin/googleSheets/sheet?jwtToken=${jwtToken}&rcAccessToken=${rcAccessTokenNewSheet}`,
      {
        name: data.body.button.formData.newSheetName,
      },
    );
    // Set admin settings for Google Sheets
    const isManaged = !(data.body.button.formData.forceGoogleSheets?.customizable ?? true);
    adminSettings.userSettings.googleSheetsName = {
      value: adminNewSheetResponse.data.name,
      customizable: !isManaged,
    };
    adminSettings.userSettings.googleSheetsUrl = {
      value: adminNewSheetResponse.data.url,
      customizable: !isManaged,
    };
    await chrome.storage.local.set({ adminSettings });
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });

    showNotification({
      level: 'success',
      message: `Admin Google Sheet "${adminNewSheetResponse.data.name}" created successfully${isManaged ? ' and enforced for all users' : ''}`,
      ttl: 5000,
    });
  } catch (error) {
    void error;
    showNotification({ level: 'warning', message: 'Failed to create new sheet', ttl: 5000 });
  }
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
