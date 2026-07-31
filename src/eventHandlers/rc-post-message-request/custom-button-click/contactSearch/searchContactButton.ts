import contactSearch from '../../../../core/customContactSearch';

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
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  const formData = data.body.button.formData;
  const contactSearchAdapterButton = formData.logType === 'Message'
    ? 'contactSearchAdapterButtonMessageLog'
    : 'contactSearchAdapterButtonCallLog';
  const contactSearchRender = contactSearch.getCustomContactSearch({
    contactSearchAdapterButton,
    contactPhoneNumber: formData.contactPhoneNumber,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: contactSearchRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${contactSearchRender.id}`,
  }, '*');
}

export default {
  onEvent,
};
