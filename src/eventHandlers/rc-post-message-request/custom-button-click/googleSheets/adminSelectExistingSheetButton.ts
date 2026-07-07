import { getRcAccessToken } from '../../../../lib/util';

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
  const rcAccessToken = getRcAccessToken();
  const { rcUnifiedCrmExtJwt: adminTokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };

  // Store current form data to preserve forceGoogleSheets state
  await chrome.storage.local.set({
    pendingAdminGoogleSheetsSelection: {
      forceGoogleSheets: !(data.body.button.formData.forceGoogleSheets?.customizable ?? true),
      timestamp: Date.now(),
    },
  });

  window.open(`${manifest.serverUrl}/admin/googleSheets/filePicker?jwtToken=${adminTokenForExistingSheet}&rcAccessToken=${rcAccessToken}`, '_blank');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack', // page id
  }, '*');
}

export default {
  onEvent,
};
