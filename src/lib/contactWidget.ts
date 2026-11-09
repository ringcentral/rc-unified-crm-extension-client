import contactWidgetIcon from '../images/contactWidgetIcon.png';
import { isSafeHttpUrl } from './urlTemplate';

type UnknownRecord = Record<string, any>;

export const CONTACT_WIDGET_APP_ID = 'app-connect-contact';
export const CONTACT_WIDGET_APP_NAME = 'App Connect Contact';

/** The side panel tab is named after the connected CRM, e.g. "Clio Contact". */
export function getContactWidgetAppName(crmName?: string): string {
  return crmName ? `${crmName} Contact` : CONTACT_WIDGET_APP_NAME;
}
export const CONTACT_WIDGET_PAGE_PATH = '/sidebarApps/app-connect-contact';
export const CONTACT_WIDGET_INPUT_CHANGED_PATH = '/sidebarApps/app-connect-contact/inputChanged';
export const CONTACT_WIDGET_BUTTON_CLICK_PATH = '/sidebarApps/app-connect-contact/button-click';

// Matched contacts (from findContact) of the calls in progress, and the contacts that came back with a widget.
// The widget content is never kept across requests: opening or refreshing the app asks the connector again.
const matchedContactsByPhone = new Map<string, UnknownRecord[]>();
const contactsWithWidgetByPhone = new Map<string, UnknownRecord[]>();
let latestPhoneNumber = '';
let selectedContactId = '';

function getWidgetFrameWindow(): Window | null {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')?.contentWindow ?? null;
}

// Registering twice is harmless: Embeddable merges by app id.
export function registerContactWidgetApp(crmName?: string): void {
  const frameWindow = getWidgetFrameWindow();
  if (!frameWindow) {
    return;
  }
  frameWindow.postMessage({
    type: 'rc-adapter-register-widget-app',
    app: {
      id: CONTACT_WIDGET_APP_ID,
      name: getContactWidgetAppName(crmName),
      iconUri: contactWidgetIcon,
      pagePath: CONTACT_WIDGET_PAGE_PATH,
      inputChangedPath: CONTACT_WIDGET_INPUT_CHANGED_PATH,
      buttonEventPath: CONTACT_WIDGET_BUTTON_CLICK_PATH,
    },
  }, '*');
}

async function isContactWidgetImplemented(): Promise<boolean> {
  const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as {
    implementedInterfaces: UnknownRecord | null;
  };
  return implementedInterfaces?.getContactWidget === true;
}

/**
 * Keeps the matched contacts of a call and registers the contact widget app, when the connector implements
 * getContactWidget and at least one real contact matched. The widget itself is fetched when the user opens the app.
 */
export async function rememberMatchedContacts({ phoneNumber, contacts, platformName, crmName }: { phoneNumber?: string; contacts?: UnknownRecord[] | null; platformName?: string; crmName?: string }): Promise<boolean> {
  void platformName;
  if (!phoneNumber) {
    return false;
  }
  const matched = (contacts ?? []).filter(c => c && !c.isNewContact);
  if (matched.length === 0 || !await isContactWidgetImplemented()) {
    matchedContactsByPhone.delete(phoneNumber);
    return false;
  }
  matchedContactsByPhone.set(phoneNumber, matched);
  latestPhoneNumber = phoneNumber;
  registerContactWidgetApp(crmName);
  return true;
}

export function forgetContactWidgets(phoneNumber?: string): void {
  if (!phoneNumber) {
    return;
  }
  matchedContactsByPhone.delete(phoneNumber);
  contactsWithWidgetByPhone.delete(phoneNumber);
  if (latestPhoneNumber === phoneNumber) {
    latestPhoneNumber = '';
    selectedContactId = '';
  }
}

/** Looks up by the phone number Embeddable sends; falls back to the most recent call's contacts. */
function getByPhone(map: Map<string, UnknownRecord[]>, phoneNumber?: string): UnknownRecord[] {
  if (phoneNumber && map.has(phoneNumber)) {
    return map.get(phoneNumber)!;
  }
  return map.get(latestPhoneNumber) ?? [];
}

export function getMatchedContacts(phoneNumber?: string): UnknownRecord[] {
  return getByPhone(matchedContactsByPhone, phoneNumber);
}

export function getContactsWithWidget(phoneNumber?: string): UnknownRecord[] {
  return getByPhone(contactsWithWidgetByPhone, phoneNumber);
}

/**
 * Pairs each matched contact with the widget the connector returned for it and stores the result for the
 * call. Contacts without a widget are left out. Resets the dropdown selection if that contact is gone.
 */
export function setContactWidgets({ phoneNumber, contacts, widgets }: { phoneNumber: string; contacts: UnknownRecord[]; widgets: { contactId?: unknown; widget?: UnknownRecord }[] }): UnknownRecord[] {
  const widgetById = new Map<string, UnknownRecord>(widgets.filter(w => w?.widget?.schema).map(w => [String(w.contactId), w.widget!] as [string, UnknownRecord]));
  const withWidget: UnknownRecord[] = contacts
    .filter(c => widgetById.has(String(c.id)))
    .map(c => ({ ...c, widget: widgetById.get(String(c.id)) }));
  contactsWithWidgetByPhone.set(phoneNumber, withWidget);
  latestPhoneNumber = phoneNumber;
  if (!withWidget.some(c => String(c.id) === selectedContactId)) {
    selectedContactId = '';
  }
  return withWidget;
}

/** A page with one line of text, for "nothing to show" and error states. */
export function buildContactWidgetMessagePage(message: string, severity: 'info' | 'warning' | 'error' = 'info'): UnknownRecord {
  return {
    data: {
      page: {
        type: 'json-schema',
        schema: { type: 'object', properties: { message: { type: 'string', description: message } } },
        uiSchema: { message: { 'ui:field': 'admonition', 'ui:severity': severity } },
        formData: {},
      },
      actions: [],
    },
  };
}

/** Property name of the contact dropdown shown when several matched contacts have a widget. */
export const CONTACT_SELECT_KEY = 'contactSelect';

export function selectContactWidget(contactId?: unknown): void {
  selectedContactId = contactId === undefined || contactId === null ? '' : String(contactId);
}

/** The contact whose widget is shown: the one picked in the dropdown, otherwise the first. */
export function getSelectedContact(contacts: UnknownRecord[]): UnknownRecord | undefined {
  return contacts.find(c => String(c.id) === selectedContactId) ?? contacts[0];
}

/** Contacts with the selected one first, so a link id shared by several widgets resolves to the visible one. */
export function orderContactsBySelection(contacts: UnknownRecord[]): UnknownRecord[] {
  const selected = getSelectedContact(contacts);
  return selected ? [selected, ...contacts.filter(c => c !== selected)] : contacts;
}

/** Puts the dropdown first without dropping the connector's own `ui:order`; `*` covers any property not listed. */
function withSelectFirst(order: unknown): string[] {
  const rest = Array.isArray(order) ? order.filter(key => key !== CONTACT_SELECT_KEY) : ['*'];
  return [CONTACT_SELECT_KEY, ...rest];
}

export function buildContactWidgetPage(contacts: UnknownRecord[]): UnknownRecord {
  const selected = getSelectedContact(contacts);
  if (!selected) {
    return { data: { page: { type: 'json-schema', schema: { type: 'object', properties: {} }, uiSchema: {}, formData: {} }, actions: [] } };
  }
  const { schema, uiSchema, formData, actions } = selected.widget;
  if (contacts.length === 1) {
    return { data: { page: { type: 'json-schema', schema, uiSchema: uiSchema ?? {}, formData: formData ?? {} }, actions: actions ?? [] } };
  }
  // Several matched contacts: a dropdown to pick one, then that contact's widget below it.
  return {
    data: {
      page: {
        type: 'json-schema',
        schema: {
          ...schema,
          type: 'object',
          properties: {
            [CONTACT_SELECT_KEY]: {
              type: 'string',
              title: 'Contact',
              oneOf: contacts.map(c => ({ const: String(c.id), title: c.name ?? String(c.id) })),
            },
            ...schema.properties,
          },
        },
        uiSchema: { ...(uiSchema ?? {}), 'ui:order': withSelectFirst(uiSchema?.['ui:order']) },
        formData: { [CONTACT_SELECT_KEY]: String(selected.id), ...(formData ?? {}) },
      },
      actions: actions ?? [],
    },
  };
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  }
  else if (value && typeof value === 'object') {
    Object.values(value).forEach(v => collectStrings(v, out));
  }
  return out;
}

/**
 * Finds the connector-supplied URL for a click. `ids` are candidates in priority order:
 * an action id, a button property name, or a selected list item value.
 */
export function resolveContactWidgetLink({ contacts, ids }: { contacts: UnknownRecord[]; ids: string[] }): string | null {
  for (const id of ids) {
    for (const contact of contacts) {
      const url = contact.widget?.links?.[id];
      if (isSafeHttpUrl(url)) {
        return url;
      }
    }
  }
  return null;
}

export function getChangedValueIds({ changedKeys, formData }: { changedKeys?: string[]; formData?: UnknownRecord }): string[] {
  const ids: string[] = [];
  for (const key of changedKeys ?? []) {
    ids.push(key);
    collectStrings(formData?.[key], ids);
  }
  return ids;
}

export function openContactWidgetLink(url: string): void {
  window.open(url, '_blank', 'noopener');
}

export function resetContactWidgetsForTest(): void {
  matchedContactsByPhone.clear();
  contactsWithWidgetByPhone.clear();
  latestPhoneNumber = '';
  selectedContactId = '';
}
