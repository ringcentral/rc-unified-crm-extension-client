import phoneNumberFormatPage from '../../../../../components/admin/generalSettings/phoneNumberFormatPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };
  const phoneNumberFormatPageRender = phoneNumberFormatPage.getPhoneNumberFormatPageRender({ adminUserSettings: adminSettings?.userSettings });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: phoneNumberFormatPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${phoneNumberFormatPageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
