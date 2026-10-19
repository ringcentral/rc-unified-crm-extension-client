import contactCore from '../core/contact';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import { getSchedulePageRender } from '../components/schedulePage';
import axios from 'axios';
import calldownPage from '../components/calldownPage';
import { cacheCalldownContact } from '../lib/util';

type UnknownRecord = Record<string, any>;

type MessageHandlerOptions = {
  request: UnknownRecord;
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo() as UnknownRecord | null | undefined;
  const platformName = platformInfo?.platformName ?? '';
  // resolve contacts for the number and show dropdown
  const phoneNumber = request.phoneNumber;
  const res = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName, isForceRefresh: true, isToTriggerContactMatch: true });
  const contacts = (res?.contactInfo || []).filter((c: UnknownRecord) => !c.isNewContact);
  const contactOptions = contacts.map((c: UnknownRecord) => ({ const: c.id, title: c.name }));
  const newContactOption = { const: 'newContact', title: 'Create new contact' };
  const listOneOf = [...contactOptions, newContactOption];
  const isDefaultNew = contacts.length === 0;
  const preselect = isDefaultNew ? 'newContact' : (contactOptions[0]?.const ?? '');
  const schedulePage = getSchedulePageRender({
    phoneNumber,
    listOneOf,
    isDefaultNew,
    preselect,
    contactTypes: manifest.platforms[platformName]?.contactTypes || [],
  });
  getWidgetFrameWindow().postMessage({ type: 'rc-adapter-register-customized-page', page: schedulePage }, '*');
  getWidgetFrameWindow().postMessage({ type: 'rc-adapter-navigate-to', path: `/customized/${schedulePage.id}` }, '*');
  const onSchedulePageMessage = async (e: MessageEvent): Promise<void> => {
    const data = e.data;
    if (!data) return;
    if (data.type === 'rc-post-message-request' && data.path === '/custom-button-click' && data.body?.page?.id === 'c2dSchedulePage') {
      getWidgetFrameWindow().postMessage({ type: 'rc-post-message-response', responseId: data.requestId, response: { data: 'ok' } }, '*');
      try {
        const rcUserInfo = ((await chrome.storage.local.get('rcUserInfo')) as UnknownRecord).rcUserInfo;
        const rcAccountId = rcUserInfo?.rcAccountId ?? '';
        const { phone, note, callbackDateTime } = data.body?.formData || {};
        if (!callbackDateTime) return;
        await axios.post(`${manifest.serverUrl}/calldown${rcAccountId ? `?rcAccountId=${rcAccountId}` : ''}`, { phoneNumber: phone, scheduledAt: callbackDateTime, contactId: data.body?.formData?.contact, note });

        // Cache contact information for c2schedule flow
        try {
          const selectedContactId = data.body?.formData?.contact;
          if (selectedContactId && selectedContactId !== 'newContact') {
            // Find the contact from the original contacts array that was resolved
            const selectedContact = contacts.find((c: UnknownRecord) => c.id === selectedContactId);
            if (selectedContact) {
              await cacheCalldownContact({
                contactId: selectedContactId,
                contactName: selectedContact.name,
                phoneNumber: phone,
                contactType: selectedContact.type || 'Contact',
              });
            }
          }
        } catch (e) {
          console.warn('Failed to cache c2schedule contact info:', e);
        }

        const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
        const calldownPageRender = await calldownPage.getCalldownPageWithRecords({ manifest, filterStatus: 'All', userSettings });
        getWidgetFrameWindow().postMessage({ type: 'rc-adapter-register-customized-page', page: calldownPageRender }, '*');
        getWidgetFrameWindow().postMessage({ type: 'rc-adapter-navigate-to', path: 'goBack' }, '*');
        window.removeEventListener('message', onSchedulePageMessage);
      }
      catch (err) { console.log(err); }
    }
  };
  window.addEventListener('message', onSchedulePageMessage);
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
};
