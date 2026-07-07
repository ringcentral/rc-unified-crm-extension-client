import { createDebounceHandler, responseMessage } from '../../../../../lib/util';
import contactCore from '../../../../../core/contact';

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

const debounceContactSearch = createDebounceHandler('contactSearch');

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  if (data.body.keys.some((k: unknown) => k === 'search')) {
    debounceContactSearch(data.requestId, async (request: unknown) => {
      void request;
      const searchWord = data.body.formData.search;
      contactCore.refreshContactPromptPage({ contactInfo: data.body.page.formData.contactInfo, searchWord });
    });
  }
  else if (data.body.keys.some((k: unknown) => k === 'contactList')) {
    const contactToOpen = data.body.formData.contactInfo.find((c: UnknownRecord) => c.id === data.body.formData.contactList);
    contactCore.openContactPage({ manifest, platformName, contactType: contactToOpen.type, contactId: contactToOpen.id });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: 'goBack',
    }, '*');
    // bring back inbound call modal if in Ringing state if exist
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-control-call',
      callAction: 'toggleRingingDialog',
    }, '*');
    responseMessage(data.requestId, { data: 'ok' });
  }
}

export default {
  onEvent,
};
