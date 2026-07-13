import contactCore from '../core/contact';
import { getPlatformInfo } from '../service/platformService';

type MessageHandlerOptions = {
  request: {
    phoneNumber?: string;
    [key: string]: unknown;
  };
  sendResponse: (response: { result: string }) => void;
};

type PickSharedSenderNumberOptions = {
  senderNumbers: unknown;
  directNumber?: string | null;
};

type StoredSmsSettings = {
  userSettings: Record<string, any>;
  smsSenderNumbers: string[];
  smsDefaultSenderNumber: string | null;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export function pickSharedSenderNumber({ senderNumbers, directNumber }: PickSharedSenderNumberOptions): string | null {
  if (!Array.isArray(senderNumbers)) {
    return null;
  }

  const shared = senderNumbers.find((number): number is string => (
    typeof number === 'string' && !!number && number !== directNumber
  ));
  return shared ?? null;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';
  const cachedContacts = contactCore.getLocalCachedContact({ phoneNumber: request.phoneNumber, platformName });
  const recipient = cachedContacts?.length > 0 ? { name: cachedContacts[0].name } : {};
  const widgetFrameWindow = getWidgetFrameWindow();

  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as Pick<StoredSmsSettings, 'userSettings'>;
  if (userSettings?.clickToSMSFromSharedNumber?.value === true) {
    const { smsSenderNumbers, smsDefaultSenderNumber } = await chrome.storage.local.get({
      smsSenderNumbers: [],
      smsDefaultSenderNumber: null,
    }) as Pick<StoredSmsSettings, 'smsSenderNumbers' | 'smsDefaultSenderNumber'>;
    const sharedSenderNumber = pickSharedSenderNumber({
      senderNumbers: smsSenderNumbers,
      directNumber: smsDefaultSenderNumber,
    });
    if (sharedSenderNumber) {
      widgetFrameWindow.postMessage({
        type: 'rc-sms-settings-update',
        senderNumber: sharedSenderNumber,
      }, '*');
    }
  }

  widgetFrameWindow.postMessage({
    type: 'rc-adapter-new-sms',
    phoneNumber: request.phoneNumber,
    conversation: true, // will go to conversation page if conversation existed
    recipient,
  }, '*');
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
  pickSharedSenderNumber,
};
