import developerSettingsPage from '../../../../components/developerSettingsPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
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
  const { isAdmin } = await chrome.storage.local.get('isAdmin') as { isAdmin?: boolean };
  const developerSettingsPageRender = developerSettingsPage.getDeveloperSettingsPageRender({ isAdmin });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: developerSettingsPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/developerSettingsPage', // page id
  }, '*');
}

export default {
  onEvent,
};
