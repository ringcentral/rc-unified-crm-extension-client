import contactCore from '../../../core/contact';
import { responseMessage } from '../../../lib/util';
import {
  CONTACT_SELECT_KEY,
  CONTACT_WIDGET_BUTTON_CLICK_PATH,
  CONTACT_WIDGET_INPUT_CHANGED_PATH,
  buildContactWidgetPage,
  getChangedValueIds,
  getContactsWithWidget,
  openContactWidgetLink,
  orderContactsBySelection,
  rememberContactWidgets,
  resolveContactWidgetLink,
  selectContactWidget,
} from '../../../lib/contactWidget';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformName?: string;
};

// Embeddable requests the page as soon as the call rings, which can be before the call event handler has
// finished looking the contact up. Look it up here too rather than answering with an empty page.
async function loadContactsWithWidget({ phoneNumber, manifest, platformName }: { phoneNumber?: string; manifest?: UnknownRecord; platformName?: string }): Promise<UnknownRecord[]> {
  const stored = getContactsWithWidget(phoneNumber);
  if (stored.length > 0 || !phoneNumber || !manifest?.serverUrl || !platformName) {
    return stored;
  }
  try {
    const { contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName, isExtensionNumber: !phoneNumber.startsWith('+') });
    rememberContactWidgets({ phoneNumber, contacts: contactInfo, platformName });
  }
  catch (e) {
    console.error('[contact widget] contact lookup failed', e);
  }
  return getContactsWithWidget(phoneNumber);
}

async function onEvent({ data, manifest, platformName }: EventOptions) {
  const phoneNumber = data.body?.contact?.phoneNumber;
  const isPageRequest = ![CONTACT_WIDGET_BUTTON_CLICK_PATH, CONTACT_WIDGET_INPUT_CHANGED_PATH].includes(data.path);
  const contacts = isPageRequest ? await loadContactsWithWidget({ phoneNumber, manifest, platformName }) : getContactsWithWidget(phoneNumber);
  console.log('[contact widget] request', { path: data.path, phoneNumber, contactsWithWidget: contacts.length });
  switch (data.path) {
    case CONTACT_WIDGET_BUTTON_CLICK_PATH: {
      const buttonId = data.body?.button?.id;
      const url = resolveContactWidgetLink({ contacts: orderContactsBySelection(contacts), ids: buttonId ? [buttonId] : [] });
      if (url) {
        openContactWidgetLink(url);
      }
      responseMessage(data.requestId, { data: 'ok' });
      break;
    }
    case CONTACT_WIDGET_INPUT_CHANGED_PATH: {
      const changedKeys: string[] = data.body?.changedKeys ?? [];
      if (changedKeys.includes(CONTACT_SELECT_KEY)) {
        // The contact dropdown changed: answer with the page of the newly selected contact.
        selectContactWidget(data.body?.formData?.[CONTACT_SELECT_KEY]);
        responseMessage(data.requestId, buildContactWidgetPage(contacts));
        break;
      }
      const url = resolveContactWidgetLink({
        contacts: orderContactsBySelection(contacts),
        ids: getChangedValueIds({ changedKeys: data.body?.changedKeys, formData: data.body?.formData }),
      });
      if (url) {
        openContactWidgetLink(url);
      }
      responseMessage(data.requestId, { data: 'ok' });
      break;
    }
    default:
      responseMessage(data.requestId, buildContactWidgetPage(contacts));
      break;
  }
}

export { onEvent };
export default {
  onEvent,
};
