import googleSheetsPage from '../../../../../components/platformSpecific/googleSheetsPage';

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
  const { userSettings } = await chrome.storage.local.get({ userSettings: null }) as { userSettings?: UnknownRecord | null };
  const updatedGoogleSheetsPage = googleSheetsPage.getUpdatedGoogleSheetsPage({ page: data.body.page, formData: data.body.formData, manifest, userSettings });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: updatedGoogleSheetsPage,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${updatedGoogleSheetsPage.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
