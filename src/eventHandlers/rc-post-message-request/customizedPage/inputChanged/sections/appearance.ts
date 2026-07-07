import appearancePage from '../../../../../components/admin/generalSettings/appearancePage';

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
  const appearancePageRender = appearancePage.getAppearancePageRender();
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: appearancePageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${appearancePageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
