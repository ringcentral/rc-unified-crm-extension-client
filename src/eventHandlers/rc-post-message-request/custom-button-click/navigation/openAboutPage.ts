import aboutPage from '../../../../components/aboutPage';

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
  void platform;
  const aboutPageRender = aboutPage.getAboutPageRender({ platformName, manifest });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: aboutPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/aboutPage', // page id
  }, '*');
}

export default {
  onEvent,
};
