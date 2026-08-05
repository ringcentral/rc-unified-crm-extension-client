import contactCore from '../core/contact';
import { getPlatformInfo } from '../service/platformService';
import { getManifest } from '../service/manifestService';
import { getSchedulePageRender } from '../components/schedulePage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: {
    ready?: boolean;
  };
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';
  if (data.ready) {
    // check for Click-To-Dial or Click-To-SMS cached action
    const cachedClickToXRequest = await chrome.runtime.sendMessage(
      {
        type: 'checkForClickToXCache',
      },
    ) as UnknownRecord | undefined;
    if (cachedClickToXRequest) {
      if (cachedClickToXRequest.type === 'c2d') {
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-new-call',
          phoneNumber: cachedClickToXRequest.phoneNumber,
          toCall: true,
        }, '*');
      }
      else if (cachedClickToXRequest.type === 'c2sms') {
        const cachedContacts = contactCore.getLocalCachedContact({ phoneNumber: cachedClickToXRequest.phoneNumber, platformName });
        const recipient = cachedContacts?.length > 0 ? { name: cachedContacts[0].name } : {};
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-new-sms',
          phoneNumber: cachedClickToXRequest.phoneNumber,
          conversation: true, // will go to conversation page if conversation existed
          recipient,
        }, '*');
      }
      else if (cachedClickToXRequest.type === 'c2schedule') {
        try {
          const phoneNumber = cachedClickToXRequest.phoneNumber;
          const res = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName, isForceRefresh: true, isToTriggerContactMatch: true });
          const contacts = (res?.contactInfo || []).filter((c: UnknownRecord) => !c.isNewContact);
          const contactOptions = contacts.map((c: UnknownRecord) => ({ const: c.id, title: c.name }));
          const newContactOption = { const: 'newContact', title: 'Create new contact' };
          const listOneOf = [...contactOptions, newContactOption];
          // Default to Create new contact when there is no match
          const isDefaultNew = contacts.length === 0;
          const preselect = isDefaultNew ? 'newContact' : (contactOptions[0]?.const ?? '');
          const ct = manifest.platforms[platformName]?.contactTypes || [];
          const schedulePage = getSchedulePageRender({
            phoneNumber,
            listOneOf,
            isDefaultNew,
            preselect,
            contactTypes: ct,
          });
          getWidgetFrameWindow().postMessage({ type: 'rc-adapter-register-customized-page', page: schedulePage }, '*');
          getWidgetFrameWindow().postMessage({ type: 'rc-adapter-navigate-to', path: `/customized/${schedulePage.id}` }, '*');

        } catch (e) { console.log(e); }
      }
    }
  }
}

export default {
  onEvent,
};
