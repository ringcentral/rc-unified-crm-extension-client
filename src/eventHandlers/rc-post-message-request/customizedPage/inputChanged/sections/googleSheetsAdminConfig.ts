import adminCore from '../../../../../core/admin';
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
  void data;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const adminSettingsResults = await adminCore.refreshAdminSettings();
  const adminSettings = adminSettingsResults.adminSettings;

  const adminGoogleSheetsPageRender = adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: adminGoogleSheetsPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${adminGoogleSheetsPageRender.id}`, // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
