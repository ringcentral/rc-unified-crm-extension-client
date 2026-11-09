import contactCore from '../../../core/contact';
import { responseMessage } from '../../../lib/util';
import {
  CONTACT_SELECT_KEY,
  CONTACT_WIDGET_BUTTON_CLICK_PATH,
  CONTACT_WIDGET_INPUT_CHANGED_PATH,
  buildContactWidgetMessagePage,
  buildContactWidgetPage,
  getChangedValueIds,
  getContactsWithWidget,
  getMatchedContacts,
  openContactWidgetLink,
  orderContactsBySelection,
  rememberMatchedContacts,
  resolveContactWidgetLink,
  selectContactWidget,
  setContactWidgets,
} from '../../../lib/contactWidget';
import { getContactWidgets } from '../../../service/contactWidgetService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformName?: string;
  crmName?: string;
};

// Embeddable can request the page as soon as the call rings, which can be before the call event handler has
// finished matching the contact. Match it here too rather than answering with an empty page.
async function loadMatchedContacts({ phoneNumber, manifest, platformName, crmName }: { phoneNumber?: string; manifest?: UnknownRecord; platformName?: string; crmName?: string }): Promise<UnknownRecord[]> {
  const stored = getMatchedContacts(phoneNumber);
  if (stored.length > 0 || !phoneNumber || !manifest?.serverUrl || !platformName) {
    return stored;
  }
  const { contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName, isExtensionNumber: !phoneNumber.startsWith('+') });
  await rememberMatchedContacts({ phoneNumber, contacts: contactInfo, platformName, crmName });
  return getMatchedContacts(phoneNumber);
}

// Opening or refreshing the app asks the connector for the widgets of the matched contacts. Nothing is cached.
async function buildPage({ phoneNumber, manifest, platformName, crmName }: { phoneNumber?: string; manifest?: UnknownRecord; platformName?: string; crmName?: string }): Promise<UnknownRecord> {
  try {
    const matched = await loadMatchedContacts({ phoneNumber, manifest, platformName, crmName });
    if (matched.length === 0 || !phoneNumber) {
      return buildContactWidgetMessagePage('No matched contact for this number.');
    }
    const { successful, returnMessage, widgets } = await getContactWidgets({ serverUrl: manifest!.serverUrl, phoneNumber, contacts: matched });
    if (!successful) {
      return buildContactWidgetMessagePage(returnMessage?.message ?? 'Unable to load the contact widget.', 'warning');
    }
    const contacts = setContactWidgets({ phoneNumber, contacts: matched, widgets });
    return contacts.length > 0 ? buildContactWidgetPage(contacts) : buildContactWidgetMessagePage('No contact widget to show for this number.');
  }
  catch (e) {
    console.error('[contact widget] failed to load', e);
    return buildContactWidgetMessagePage('Unable to load the contact widget. Please try again.', 'error');
  }
}

async function onEvent({ data, manifest, platformName, crmName }: EventOptions) {
  const phoneNumber = data.body?.contact?.phoneNumber;
  switch (data.path) {
    case CONTACT_WIDGET_BUTTON_CLICK_PATH: {
      const buttonId = data.body?.button?.id;
      const contacts = getContactsWithWidget(phoneNumber);
      const url = resolveContactWidgetLink({ contacts: orderContactsBySelection(contacts), ids: buttonId ? [buttonId] : [] });
      if (url) {
        openContactWidgetLink(url);
      }
      responseMessage(data.requestId, { data: 'ok' });
      break;
    }
    case CONTACT_WIDGET_INPUT_CHANGED_PATH: {
      const contacts = getContactsWithWidget(phoneNumber);
      const changedKeys: string[] = data.body?.changedKeys ?? [];
      if (changedKeys.includes(CONTACT_SELECT_KEY)) {
        // The contact dropdown changed: answer with the page of the newly selected contact.
        selectContactWidget(data.body?.formData?.[CONTACT_SELECT_KEY]);
        responseMessage(data.requestId, buildContactWidgetPage(contacts));
        break;
      }
      const url = resolveContactWidgetLink({
        contacts: orderContactsBySelection(contacts),
        ids: getChangedValueIds({ changedKeys, formData: data.body?.formData }),
      });
      if (url) {
        openContactWidgetLink(url);
      }
      responseMessage(data.requestId, { data: 'ok' });
      break;
    }
    default:
      responseMessage(data.requestId, await buildPage({ phoneNumber, manifest, platformName, crmName }));
      break;
  }
}

export { onEvent };
export default {
  onEvent,
};
