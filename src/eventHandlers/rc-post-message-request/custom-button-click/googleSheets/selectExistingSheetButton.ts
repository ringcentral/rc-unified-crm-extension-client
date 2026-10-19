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
  const { rcUnifiedCrmExtJwt: tokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
  // Store timestamp for user selection
  await chrome.storage.local.set({
    pendingUserGoogleSheetsSelection: {
      timestamp: Date.now(),
    },
  });
  window.open(`${manifest.serverUrl}/googleSheets/filePicker?token=${tokenForExistingSheet}`, '_blank');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack', // page id
  }, '*');
}

export default {
  onEvent,
};
