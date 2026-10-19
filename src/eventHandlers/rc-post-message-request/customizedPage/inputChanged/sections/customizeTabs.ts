import customizeTabsSettingPage from '../../../../../components/admin/generalSettings/customizeTabsSettingPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platform;
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };
  const customizeTabsSettingPageRender = customizeTabsSettingPage.getCustomizeTabsSettingPageRender({ adminUserSettings: adminSettings?.userSettings, manifest, platformName });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: customizeTabsSettingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${customizeTabsSettingPageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
