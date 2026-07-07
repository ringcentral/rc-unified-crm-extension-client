import logPage from '../../../../../components/logPage';

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

function withoutNewContact(contact: UnknownRecord): UnknownRecord {
  return { ...contact, isNewContact: undefined };
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  let selectedContact = data.body.page.formData.contactInfo.find((c: UnknownRecord) => c.id === data.body.formData.contactList);
  // Ensure isNewContact is not set for real contacts
  selectedContact = { ...selectedContact };
  delete selectedContact.isNewContact;
  const { cacheLogPageData } = await chrome.storage.local.get('cacheLogPageData') as { cacheLogPageData: UnknownRecord };
  const contactData = cacheLogPageData.contactInfo;
  if (!contactData.some((c: UnknownRecord) => c.id === selectedContact.id)) {
    contactData.push(selectedContact);
  }
  if (contactData.length > 0) {
    const cachedSearchContactKey = `rc-crm-search-contact-${data.body.formData?.contactPhoneNumber}`;
    const storageObj = await chrome.storage.local.get(cachedSearchContactKey) as UnknownRecord;
    const contactArr = storageObj[cachedSearchContactKey] || [];
    if (!contactArr.some((c: UnknownRecord) => c.id === selectedContact.id)) {
      contactArr.push(selectedContact);
    }
    await chrome.storage.local.set({ [cachedSearchContactKey]: contactArr });
  }
  // First get the initial log page
  const initialLogPage = logPage.getLogPageRender({
    ...cacheLogPageData,
    contactInfo: contactData.map(withoutNewContact),
  });

  // Then update it with the selected contact
  const cachedLogPage = logPage.getUpdatedLogPageRender({
    manifest,
    platformName,
    logType: 'Call',
    updateData: {
      page: initialLogPage,
      formData: {
        ...initialLogPage.formData,
        contact: selectedContact.id,
        contactType: selectedContact.type,
        contactName: selectedContact.name,
        contactInfo: contactData.map(withoutNewContact),
        returnToHistoryPage: true,
      },
      keys: ['contact'],
    },
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-trigger-contact-match',
    phoneNumbers: [data.body.formData?.contactPhoneNumber],
  }, '*');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-update-call-log-page',
    page: cachedLogPage,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/history',
  }, '*');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/log/call/${cacheLogPageData.id}`,
  }, '*');
}

export default {
  onEvent,
};
