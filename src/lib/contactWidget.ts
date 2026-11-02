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

const contactsWithWidgetByPhone = new Map<string, UnknownRecord[]>();
let latestPhoneNumber = '';
let selectedContactId = '';

function getWidgetFrameWindow(): Window | null {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')?.contentWindow ?? null;
}

// Embeddable only opens its widget panel for a call when an app is already registered as the call rings,
// so the app is registered at startup for platforms that returned a widget before, and again when one is found.
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

/**
 * Keeps the matched contacts that carry a widget for the duration of a call.
 * The widget app is registered the first time a widget is seen, so connectors without one never get an empty tab.
 */
export function rememberContactWidgets({ phoneNumber, contacts, platformName, crmName }: { phoneNumber?: string; contacts?: UnknownRecord[] | null; platformName?: string; crmName?: string }): boolean {
  if (!phoneNumber) {
    return false;
  }
  const withWidget = (contacts ?? []).filter(c => c?.widget?.schema);
  if (withWidget.length === 0) {
    contactsWithWidgetByPhone.delete(phoneNumber);
    return false;
  }
  contactsWithWidgetByPhone.set(phoneNumber, withWidget);
  if (!withWidget.some(c => String(c.id) === selectedContactId)) {
    selectedContactId = '';
  }
  latestPhoneNumber = phoneNumber;
  registerContactWidgetApp(crmName);
  if (platformName) {
    void chrome.storage.local.set({ [contactWidgetSeenKey(platformName)]: true });
  }
  return true;
}

function contactWidgetSeenKey(platformName: string): string {
  return `contactWidgetSeen-${platformName}`;
}

/** Called at startup so the app is already registered when the next call rings. */
export async function registerContactWidgetAppIfSeen(platformName?: string, crmName?: string): Promise<void> {
  if (!platformName) {
    return;
  }
  const key = contactWidgetSeenKey(platformName);
  const stored = await chrome.storage.local.get(key) as UnknownRecord;
  if (stored[key]) {
    registerContactWidgetApp(crmName);
  }
}

export function forgetContactWidgets(phoneNumber?: string): void {
  if (!phoneNumber) {
    return;
  }
  contactsWithWidgetByPhone.delete(phoneNumber);
  if (latestPhoneNumber === phoneNumber) {
    latestPhoneNumber = '';
    selectedContactId = '';
  }
}

/** Looks up by the phone number Embeddable sends; falls back to the most recent call's contacts. */
export function getContactsWithWidget(phoneNumber?: string): UnknownRecord[] {
  if (phoneNumber && contactsWithWidgetByPhone.has(phoneNumber)) {
    return contactsWithWidgetByPhone.get(phoneNumber)!;
  }
  return contactsWithWidgetByPhone.get(latestPhoneNumber) ?? [];
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

const WIDGET_PROBE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Local matched-contact cache entries written before widget support carry no widget, and a platform that never
 * returns one looks the same. Re-fetch from the server at most once a day per platform to tell them apart.
 */
export async function shouldProbeContactWidget({ platformName, contacts }: { platformName: string; contacts?: UnknownRecord[] | null }): Promise<boolean> {
  if (!platformName || !contacts?.some(c => !c.isNewContact)) {
    return false;
  }
  const key = `contactWidgetProbeAt-${platformName}`;
  const stored = await chrome.storage.local.get(key) as UnknownRecord;
  if (Date.now() - (stored[key] ?? 0) < WIDGET_PROBE_INTERVAL_MS) {
    return false;
  }
  await chrome.storage.local.set({ [key]: Date.now() });
  return true;
}

export function resetContactWidgetsForTest(): void {
  contactsWithWidgetByPhone.clear();
  latestPhoneNumber = '';
  selectedContactId = '';
}
