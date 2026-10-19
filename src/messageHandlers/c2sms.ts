import contactCore from '../core/contact';
import { getPlatformInfo } from '../service/platformService';

type MessageHandlerOptions = {
  request: {
    phoneNumber?: string;
    [key: string]: unknown;
  };
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';
  const cachedContacts = contactCore.getLocalCachedContact({ phoneNumber: request.phoneNumber, platformName });
  const recipient = cachedContacts?.length > 0 ? { name: cachedContacts[0].name } : {};
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-new-sms',
    phoneNumber: request.phoneNumber,
    conversation: true, // will go to conversation page if conversation existed
    recipient,
  }, '*');
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
};
