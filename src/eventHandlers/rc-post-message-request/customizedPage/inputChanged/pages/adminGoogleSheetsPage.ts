import adminCore from '../../../../../core/admin';
import { showNotification } from '../../../../../lib/util';
import adminGoogleSheetsPage from '../../../../../components/admin/adminGoogleSheetsPage';

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
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };

  if (data.body.keys && data.body.keys.includes('forceGoogleSheets')) {
    const isManaged = !(data.body.formData.forceGoogleSheets?.customizable ?? true);
    if (adminSettings?.userSettings?.googleSheetsName) {
      adminSettings.userSettings.googleSheetsName.customizable = !isManaged;
    }
    if (adminSettings?.userSettings?.googleSheetsUrl) {
      adminSettings.userSettings.googleSheetsUrl.customizable = !isManaged;
    }
    await chrome.storage.local.set({ adminSettings });
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });

    showNotification({
      level: 'success',
      message: `Google Sheets setting ${isManaged ? 'enforced for all users' : 'made customizable for users'}`,
      ttl: 3000,
    });
  }

  const updatedAdminGoogleSheetsPage = adminGoogleSheetsPage.getUpdatedAdminGoogleSheetsPage({ page: data.body.page, formData: data.body.formData });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: updatedAdminGoogleSheetsPage,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${updatedAdminGoogleSheetsPage.id}`, // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
