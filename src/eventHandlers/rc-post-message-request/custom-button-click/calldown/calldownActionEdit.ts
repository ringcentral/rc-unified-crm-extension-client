import contactCore from '../../../../core/contact';
import { getSchedulePageRender } from '../../../../components/schedulePage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
  listButtonItemId?: unknown;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  void data;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');

  const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] }) as { calldownListCache?: UnknownRecord[] };
  const rowId = listButtonItemId ?? '';
  const item = (calldownListCache || []).find(i => i.id === rowId);

  if (!item) {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    return;
  }

  const phoneNumber = item.phoneNumber;
  const scheduledAt = item.scheduledAt;
  const existingContactId = item.contactId;

  // Resolve contacts for the phone number
  const res = await contactCore.getContact({
    serverUrl: manifest.serverUrl,
    phoneNumber,
    platformName,
    isForceRefresh: true,
    isToTriggerContactMatch: true,
  });

  const contacts = (res?.contactInfo || []).filter((c: UnknownRecord) => !c.isNewContact);
  const contactOptions = contacts.map((c: UnknownRecord) => ({ const: c.id, title: c.name }));
  const newContactOption = { const: 'newContact', title: 'Create new contact' };
  const listOneOf = [...contactOptions, newContactOption];

  // Pre-select existing contact if it exists in the contacts list
  let preselect = 'newContact';
  if (existingContactId) {
    const existingContact = contacts.find((c: UnknownRecord) => c.id === existingContactId);
    if (existingContact) {
      preselect = existingContactId;
    }
  } else if (contacts.length > 0) {
    preselect = contacts[0].const;
  }

  const isDefaultNew = preselect === 'newContact';

  const schedulePage = getSchedulePageRender({
    phoneNumber,
    listOneOf,
    isDefaultNew,
    preselect,
    contactTypes: manifest.platforms[platformName as string]?.contactTypes || [],
  });

  // Update title for edit mode
  schedulePage.title = 'Edit scheduled call';

  // Update submit button text
  schedulePage.schema.properties.scheduleSubmit.title = 'Update Schedule';

  // Pre-fill the scheduled datetime if it exists
  if (scheduledAt) {
    schedulePage.formData.callbackDateTime = new Date(scheduledAt).toISOString().slice(0, 16);
  }

  // Pre-fill contact name if editing existing contact
  if (item.contactName && isDefaultNew) {
    schedulePage.formData.newContactName = item.contactName;
  }

  // Store the original record ID so we can update it instead of creating new
  schedulePage.formData.editingRecordId = rowId;

  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: schedulePage,
  }, '*');

  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${schedulePage.id}`,
  }, '*');

  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
