import logPage from '../../../../components/logPage';
import contactSearch from '../../../../core/customContactSearch';
import { responseMessage } from '../../../../lib/util';

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
  void platformInfo;
  void platform;
  const updatedPage = logPage.getUpdatedLogPageRender({ manifest, logType: 'Message', platformName, updateData: data.body });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-update-messages-log-page',
    page: updatedPage,
  }, '*');
  if (data.body.keys?.includes('contact') && data.body.formData.contact === 'searchContact') {
    const contactSearchRender = contactSearch.getCustomContactSearch({ contactSearchAdapterButton: 'contactSearchAdapterButtonMessageLog', contactPhoneNumber: data.body.formData?.contactPhoneNumber });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: contactSearchRender,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${contactSearchRender.id}`,
    }, '*');
  }
  responseMessage(data.requestId, { data: 'ok' });
}

export default {
  onEvent,
};
