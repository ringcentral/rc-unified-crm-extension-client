import axios from 'axios';
import analytics from '../lib/analytics';
import { showNotification } from '../lib/util';
import multiContactPopPromptPage from '../components/multiContactPopPromptPage';
import { t } from '../i18n';
import { getManifest } from '../service/manifestService';
import { isSafeHttpUrl, renderUrlTemplate } from '../lib/urlTemplate';

type UnknownRecord = Record<string, any>;

let lastOpenedContactPageUrl: unknown = null;

function getWidgetFrameWindow(): Window & UnknownRecord {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow! as Window & UnknownRecord;
}

export function getLocalCachedContact({ phoneNumber, platformName }: UnknownRecord): UnknownRecord[] {
  const allCachedContacts = getWidgetFrameWindow().phone.contactMatcher.data;
  const result = [];
  if (!allCachedContacts) {
    return result;
  }
  const contact = allCachedContacts[phoneNumber];
  if (!contact) {
    return result;
  }
  const contactUnderCRM = contact[platformName]?.data;
  if (!contactUnderCRM) {
    return result;
  }
  for (const c of contactUnderCRM) {
    result.push({
      id: c.id,
      name: c.name,
      type: c.contactType,
      phone: phoneNumber,
      isNewContact: c.isNewContact,
      createdDate: c.createdDate,
      mostRecentActivityDate: c.mostRecentActivityDate,
      additionalInfo: c.additionalInfo,
    });
  }
  return result;
}

async function shouldForceRefreshAccountData({ platformName, isFromManual, isForceRefreshAccountData }: UnknownRecord): Promise<boolean> {
  if (isFromManual || isForceRefreshAccountData) {
    return true;
  }
  if (!platformName) {
    return false;
  }
  const manifest = await getManifest() as UnknownRecord;
  return manifest?.platforms?.[platformName]?.page?.disableContactCache ?? false;
}

export async function getContact({
  serverUrl,
  phoneNumber,
  platformName,
  isFromManual = false,
  isExtensionNumber = false,
  isForceRefresh = false,
  isForceRefreshAccountData = false,
  isToTriggerContactMatch = true,
}: UnknownRecord): Promise<UnknownRecord> {
  if (!isForceRefresh) {
    const cachedContact = getLocalCachedContact({ phoneNumber, platformName });
    if (cachedContact.length > 0) {
      return {
        matched: true,
        returnMessage: null,
        contactInfo: cachedContact,
      };
    }
  }
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  const overridingFormats = [];
  const { userSettings } = await chrome.storage.local.get('userSettings') as UnknownRecord;
  if (userSettings?.overridingPhoneNumberFormat?.value) {
    overridingFormats.push(userSettings.overridingPhoneNumberFormat.value);
  }
  if (userSettings?.overridingPhoneNumberFormat2?.value) {
    overridingFormats.push(userSettings.overridingPhoneNumberFormat2.value);
  }
  if (userSettings?.overridingPhoneNumberFormat3?.value) {
    overridingFormats.push(userSettings.overridingPhoneNumberFormat3.value);
  }
  const forceRefreshAccountData = await shouldForceRefreshAccountData({ platformName, isFromManual, isForceRefreshAccountData });

  if (rcUnifiedCrmExtJwt) {
    const contactRes = await axios.get(`${serverUrl}/contact?phoneNumber=${phoneNumber}&overridingFormat=${encodeURIComponent(overridingFormats.toString())}&isExtension=${isExtensionNumber}&isForceRefreshAccountData=${forceRefreshAccountData ? 'true' : 'false'}`);
    if (!contactRes.data.contact) {
      return {
        matched: false,
        returnMessage: contactRes.data.returnMessage ?? {
          message: t('notifications.warning.noContactFound'),
          messageType: 'warning',
          ttl: 3000,
        },
        contactInfo: null,
      };
    }
    if (isToTriggerContactMatch) {
      const tempContactMatchTask: UnknownRecord = {};
      tempContactMatchTask[`tempContactMatchTask-${phoneNumber}`] = [...contactRes.data.contact.filter((c: UnknownRecord) => !c.isNewContact)];
      await chrome.storage.local.set({ ...tempContactMatchTask });
      // force trigger contact matcher
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-trigger-contact-match',
        phoneNumbers: [phoneNumber],
      }, '*');
    }
    const cachedSearchContactKey = `rc-crm-search-contact-${phoneNumber}`;
    const storageObj = await chrome.storage.local.get(cachedSearchContactKey) as UnknownRecord;
    const cachedContacts = storageObj[cachedSearchContactKey] || [];
    for (const cachedContact of cachedContacts) {
      if (!contactRes.data.contact.some((c: UnknownRecord) => c.id === cachedContact.id)) {
        contactRes.data.contact.unshift(cachedContact);
      }
    }
    return {
      matched: contactRes.data.successful,
      returnMessage: contactRes.data.returnMessage,
      contactInfo: contactRes.data.contact,
    };
  }
  else {
    return {
      matched: false,
      returnMessage:
      {
        message: t('notifications.warning.connectToCrm'),
        messageType: 'warning',
        ttl: 3000,
      },
      contactInfo: null,
    };
  }
}

export async function createContact({ serverUrl, phoneNumber, newContactName, newContactType, additionalSubmission }: UnknownRecord): Promise<UnknownRecord> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  if (rcUnifiedCrmExtJwt) {
    const contactRes = await axios.post(
      `${serverUrl}/contact`,
      {
        phoneNumber,
        newContactName,
        newContactType,
        additionalSubmission,
      },
    );
    const tempContactMatchTask: UnknownRecord = {};
    tempContactMatchTask[`tempContactMatchTask-${phoneNumber}`] = [
      {
        id: contactRes.data.contact.id,
        phone: phoneNumber,
        name: newContactName,
        type: newContactType,
        additionalInfo: contactRes.data.contact.additionalInfo ?? null,
      }];
    await chrome.storage.local.set({ ...tempContactMatchTask });
    // force trigger contact matcher
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-trigger-contact-match',
      phoneNumbers: [phoneNumber],
    }, '*');
    analytics.createNewContact();
    return {
      matched: contactRes.data.successful,
      contactInfo: contactRes.data.contact,
      returnMessage: contactRes.data.returnMessage,
    };
  }
  else {
    return {
      matched: false,
      returnMessage: {
        message: t('notifications.warning.connectToCrm'),
        messageType: 'warning',
        ttl: 3000,
      },
      contactInfo: null,
    };
  }
}

function renderContactPageUrl({ manifest, platformName, hostname, contactId, contactType, fromCallPop, userSettings }: UnknownRecord): unknown {
  let targetUrlTemplate = manifest.platforms[platformName].contactPageUrl;
  if (fromCallPop && !!manifest.platforms[platformName].callPopUrl) {
    targetUrlTemplate = manifest.platforms[platformName].callPopUrl;
  }
  return renderUrlTemplate({
    template: targetUrlTemplate,
    values: {
      hostname,
      contactId,
      contactType,
    },
    userSettings,
  }).url;
}

function openFallbackContactPage({ manifest, platformName, hostname, fromCallPop, userSettings }: UnknownRecord): boolean {
  const platform = manifest?.platforms?.[platformName];
  if (
    !fromCallPop ||
    !platform?.enableFallbackContactPageUrl ||
    typeof platform?.fallbackContactPageUrl !== 'string' ||
    !platform.fallbackContactPageUrl
  ) {
    return false;
  }
  const fallbackContactPageUrl = renderUrlTemplate({
    template: platform.fallbackContactPageUrl,
    values: {
      hostname,
    },
    userSettings,
  }).url;
  if (!isSafeHttpUrl(fallbackContactPageUrl)) {
    return false;
  }
  showNotification({ level: 'success', message: t('notifications.success.openingContactPage'), ttl: 5000 });
  window.open(fallbackContactPageUrl);
  return true;
}

export async function openContactPage({
  manifest,
  platformName,
  phoneNumber,
  contactId,
  contactType,
  multiContactMatchBehavior,
  fromCallPop = false,
}: UnknownRecord): Promise<void> {
  const platformInfo = await chrome.storage.local.get('platform-info') as UnknownRecord;
  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as UnknownRecord;
  if (platformInfo['platform-info'].hostname === 'temp') {
    const hostnameRes = await axios.get(`${manifest.serverUrl}/hostname`);
    platformInfo['platform-info'].hostname = hostnameRes.data;
    await chrome.storage.local.set(platformInfo);
  }
  analytics.contactPop();
  const hostname = platformInfo['platform-info'].hostname;
  const isContactIdProvidedDirectly = !!contactId;
  let cachedContacts = [];
  let contactIdInUse = contactId;
  let contactTypeInUse = contactType;
  if (!contactIdInUse) {
    cachedContacts = getLocalCachedContact({ phoneNumber, platformName });
    if (cachedContacts.length > 0) {
      contactIdInUse = cachedContacts[0].id;
      contactTypeInUse = cachedContacts[0].type;
    }
  }
  // case: single contact with id
  if (isContactIdProvidedDirectly || (cachedContacts.length == 1 && !!contactIdInUse)) {
    showNotification({ level: 'success', message: t('notifications.success.openingContactPage'), ttl: 5000 });
    // Unique: Bullhorn
    if (platformName === 'bullhorn') {
      const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null }) as UnknownRecord;
      if (crm_extension_bullhorn_user_urls?.atsUrl) {
        const newTab = window.open(`${crm_extension_bullhorn_user_urls.atsUrl}/BullhornStaffing/OpenWindow.cfm?Entity=${contactTypeInUse}&id=${contactIdInUse}&view=Overview`, '_blank', 'popup')!;
        newTab.blur();
        window.focus();
      }
      return;
    }
    else {
      const contactPageUrl = renderContactPageUrl({ manifest, platformName, hostname, contactId: contactIdInUse, contactType: contactTypeInUse, fromCallPop, userSettings });
      if (lastOpenedContactPageUrl === contactPageUrl) {
        return;
      }
      lastOpenedContactPageUrl = contactPageUrl;
      // timer to set lastOpenedContactPageUrl to null after 10 seconds
      setTimeout(() => {
        lastOpenedContactPageUrl = null;
      }, 10000);
      window.open(contactPageUrl as string);
      return;
    }
  }
  // case: unknown contact OR multi matches
  else {
    const { matched: contactMatched, contactInfo } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber, platformName });
    if (!contactMatched) {
      openFallbackContactPage({ manifest, platformName, hostname, fromCallPop, userSettings });
      return;
    }
    const existingContacts = (contactInfo || []).filter((c: UnknownRecord) => !c.isNewContact);
    if (existingContacts.length === 0) {
      openFallbackContactPage({ manifest, platformName, hostname, fromCallPop, userSettings });
      return;
    }
    // case: multi contacts
    const isMultipleContact = existingContacts.length > 1;
    if (isMultipleContact) {
      if (!multiContactMatchBehavior) {
        return;
      }
      switch (multiContactMatchBehavior) {
        case 'disabled':
          // do nothing
          return;
        case 'openAllMatches':
          // proceed and open all matches
          // Unique: Bullhorn
          if (platformName === 'bullhorn') {
            const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null }) as UnknownRecord;
            if (crm_extension_bullhorn_user_urls?.atsUrl) {
              for (const c of existingContacts) {
                const newTab = window.open(`${crm_extension_bullhorn_user_urls.atsUrl}/BullhornStaffing/OpenWindow.cfm?Entity=${c.type}&id=${c.id}&view=Overview`, '_blank', 'popup')!;
                newTab.blur();
                window.focus();
              }
            }
          }
          else {
            for (const c of existingContacts) {
              const hostname = platformInfo['platform-info'].hostname;
              const contactPageUrl = renderContactPageUrl({ manifest, platformName, hostname, contactId: c.id, contactType: c.type, fromCallPop: false, userSettings });
              window.open(contactPageUrl as string);
            }
          }
          break;
        case 'promptToSelect':
          {
            // open prompt page
            const multiContactPopPromptPageRender = multiContactPopPromptPage.getMultiContactPopPromptPageRender({ contactInfo: existingContacts });
            getWidgetFrameWindow().postMessage({
              type: 'rc-adapter-register-customized-page',
              page: multiContactPopPromptPageRender,
            });
            getWidgetFrameWindow().postMessage({
              type: 'rc-adapter-navigate-to',
              path: `/customized/${multiContactPopPromptPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
            }, '*');
            // minimize inbound call modal if in Ringing state if exist
            getWidgetFrameWindow().postMessage({
              type: 'rc-adapter-control-call',
              callAction: 'toggleRingingDialog',
            }, '*');
          }
          break;
      }
    }
    //This is the case where there is only one contact and it is not a new contact
    if (existingContacts.length == 1) {
      if (platformName === 'bullhorn') {
        const { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null }) as UnknownRecord;
        if (crm_extension_bullhorn_user_urls?.atsUrl) {
          for (const c of existingContacts) {
            const newTab = window.open(`${crm_extension_bullhorn_user_urls.atsUrl}/BullhornStaffing/OpenWindow.cfm?Entity=${c.type}&id=${c.id}&view=Overview`, '_blank', 'popup')!;
            newTab.blur();
            window.focus();
          }
        }
      }
      else {
        for (const c of existingContacts) {
          const hostname = platformInfo['platform-info'].hostname;
          const contactPageUrl = renderContactPageUrl({ manifest, platformName, hostname, contactId: c.id, contactType: c.type, fromCallPop: false, userSettings });
          if (lastOpenedContactPageUrl === contactPageUrl) {
            return;
          }
          lastOpenedContactPageUrl = contactPageUrl;
          // timer to set lastOpenedContactPageUrl to null after 10 seconds
          setTimeout(() => {
            lastOpenedContactPageUrl = null;
          }, 10000);
          window.open(contactPageUrl as string);
        }
      }
    }
    showNotification({ level: 'success', message: t('notifications.success.openingContactPage'), ttl: 5000 });
  }
}

export function refreshContactPromptPage({ contactInfo, searchWord }: UnknownRecord): void {
  // refresh prompt page
  const multiContactPopPromptPageRender = multiContactPopPromptPage.getMultiContactPopPromptPageRender({ contactInfo, searchWord });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: multiContactPopPromptPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${multiContactPopPromptPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
  }, '*');
}

const contactCore = {
  getContact,
  createContact,
  openContactPage,
  refreshContactPromptPage,
  getLocalCachedContact,
};

export default contactCore;
