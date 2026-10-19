import autoLogPreferencesPage from '../../../../../components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };
  const autoLogPreferencesPageRender = autoLogPreferencesPage.getAutoLogPreferenceSettingPageRender({ adminUserSettings: adminSettings?.userSettings, contactTypes: (platform.contactTypes && platform.contactTypes.length > 0) ? platform.contactTypes : [{ value: 'contact', display: 'Contact' }] });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: autoLogPreferencesPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${autoLogPreferencesPageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
