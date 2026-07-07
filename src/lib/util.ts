import { openDB } from 'idb';
import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

declare const RCAdapter: {
  alertMessage(options: UnknownRecord): Promise<string> | string;
  dismissMessage(notificationId: unknown): Promise<unknown> | unknown;
};

function secondsToHourMinuteSecondString(totalSeconds: number): string {
  const hours = parseInt(String(totalSeconds / 3600), 10);
  const minutes = parseInt(String((totalSeconds - 3600 * hours) / 60), 10);
  const seconds = parseInt(String(totalSeconds - 3600 * hours - 60 * minutes), 10);
  return `${hours}h${minutes}m${seconds}s`;
}

async function showNotification({ level, message, ttl, details = null }: UnknownRecord): Promise<string | undefined> {
  if (!message || isObjectEmpty(message)) {
    return;
  }
  if (!level) {
    // eslint-disable-next-line no-param-reassign
    level = 'warning';
  }
  const { notificationLevelSetting } = await chrome.storage.local.get({ notificationLevelSetting: ['success', 'warning', 'error'] }) as UnknownRecord;
  if (!notificationLevelSetting.includes(level)) {
    return;
  }
  const notificationId = await RCAdapter.alertMessage({ message, ttl, level, details });
  return notificationId;
}

async function dismissNotification({ notificationId }: UnknownRecord): Promise<void> {
  if (notificationId) {
    await RCAdapter.dismissMessage(notificationId);
  }
}


function responseMessage(responseId: unknown, response: unknown): void {
  (document.querySelector("#rc-widget-adapter-frame") as any).contentWindow.postMessage({
    type: 'rc-post-message-response',
    responseId,
    response,
  }, '*');
}

function isObjectEmpty(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function getRcInfo(): Promise<UnknownRecord> {
  const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform') ?? '{}').owner_id;
  const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
  const rcInfo = await indexDB.get('keyvaluepairs', 'dataFetcherV2-storageData');
  return rcInfo;
}

async function getRcUserInfo(): Promise<UnknownRecord> {
  const { rcUserInfo } = await chrome.storage.local.get({ rcUserInfo: null });
  return rcUserInfo;
}

async function getRcCallLogIdentity(): Promise<UnknownRecord> {
  const rcInfo = await getRcInfo();
  const rcUserInfo = await getRcUserInfo();
  return {
    extensionNumber: rcInfo?.value?.cachedData?.extensionInfo?.extensionNumber ?? '',
    hashedExtensionId: rcUserInfo?.rcExtensionId ?? '',
  };
}

function getRcAccessToken(): string {
  return JSON.parse(localStorage.getItem('sdk-rc-widgetplatform') ?? '{}').access_token;
}

async function getRcContactInfo(): Promise<UnknownRecord[]> {
  const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform') ?? '{}').owner_id;
  const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
  const rcContactInfo = await indexDB.get('keyvaluepairs', 'CompanyContacts-companyContactsData');
  return rcContactInfo?.value ?? [];
}

async function checkC2DCollision(): Promise<void> {
  try {
    const { rcForGoogleCollisionChecked } = await chrome.storage.local.get({ rcForGoogleCollisionChecked: false });
    const collidingC2DResponse = await fetch("chrome-extension://fddhonoimfhgiopglkiokmofecgdiedb/redirect.html");
    if (!rcForGoogleCollisionChecked && collidingC2DResponse.status === 200) {
      const c2dCollisionNotificationId = 'rc-c2d-collision';
      chrome.notifications.create(c2dCollisionNotificationId, {
        type: 'basic',
        iconUrl: '/images/logo32.png',
        title: t('misc.clickToDialCollisionTitle'),
        message: t('misc.clickToDialCollision'),
        priority: 1,
        buttons: [
          {
            title: t('misc.configure')
          }
        ]
      });
      chrome.notifications.onButtonClicked.addListener(
        (notificationId, buttonIndex) => {
          if (notificationId !== c2dCollisionNotificationId) {
            return;
          }
          window.open('https://youtu.be/tbCOM27GUbc');
        }
      )

      await chrome.storage.local.set({ rcForGoogleCollisionChecked: true });
    }
  }
  catch (e) {
    //ignore
  }
}

function downloadTextFile({ filename, text }: UnknownRecord): void {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function cleanUpExpiredStorage(): void {
  chrome.storage.local.get(null, function (items: UnknownRecord) {
    // 'items' is an object containing all key-value pairs
    // stored in chrome.storage.local.
    console.log("Start cleaning expired items");
    const keysToBeDeleted = [];
    // You can now process the 'items' object
    for (let key in items) {
      if (Object.prototype.hasOwnProperty.call(items, key)) {
        if (items[key].expiry && items[key].expiry < Date.now()) {
          keysToBeDeleted.push(key);
        }
      }
    }
    // Now you can delete the keys that are expired
    keysToBeDeleted.forEach(key => {
      chrome.storage.local.remove(key, function () {
        console.log(`Key ${key} removed`);
      });
    });
  });
}

// Debounce storage for different operations
const debounceStorage = new Map<string, UnknownRecord>();

function createDebounceHandler(handlerKey: string, delay = 300) {
  return function (request: unknown, handlerFunction: (request: unknown) => unknown | Promise<unknown>): void {
    // Get or create debounce object for this handler
    let debounceObj = debounceStorage.get(handlerKey);

    if (!debounceObj) {
      debounceObj = {};
      debounceStorage.set(handlerKey, debounceObj);
    } else {
      // Clear previous timeout
      const timeout = debounceObj.timeout;
      clearTimeout(timeout);
    }

    // Store current request
    debounceObj.request = request;

    // Set new timeout
    debounceObj.timeout = setTimeout(async () => {
      // Clear debounce object
      debounceStorage.delete(handlerKey);

      try {
        // Execute the handler function
        await handlerFunction(request);

      } catch (error) {
        console.error(`Debounced handler error for ${handlerKey}:`, error);
      }
    }, delay);
  };
}

// Hack: put it here temporarily as there's no better place to go
// Helper function to cache contact information for call back list
async function cacheCalldownContact({ contactId, contactName, phoneNumber, contactType }: UnknownRecord): Promise<void> {
  if (!contactId || !contactName || !phoneNumber) return;

  try {
    const { calldownContactCache = {} } = await chrome.storage.local.get('calldownContactCache');
    calldownContactCache[String(contactId)] = {
      contactName,
      phoneNumber,
      contactType,
      cachedAt: Date.now()
    };
    await chrome.storage.local.set({ calldownContactCache });
  } catch (error) {
    console.warn('Failed to cache calldown contact:', error);
  }
}

async function setRcAdditionalSubmission({ rcInfo, platform }: UnknownRecord): Promise<UnknownRecord> {
  const rcAdditionalSubmission: UnknownRecord = {};
  if (platform?.rcAdditionalSubmission) {
    for (const ras of platform.rcAdditionalSubmission) {
      const pathSegments = ras.path.split('.');
      let rcInfoSubmissionValue = null;
      for (const ps of pathSegments) {
        const source = rcInfoSubmissionValue === null ? rcInfo.value : rcInfoSubmissionValue;
        if (source === undefined || source === null) {
          rcInfoSubmissionValue = undefined;
          break;
        }
        rcInfoSubmissionValue = source[ps];
      }

      if (rcInfoSubmissionValue) {
        rcAdditionalSubmission[ras.id] = rcInfoSubmissionValue;
      }
    }
  }
  await chrome.storage.local.set({ rcAdditionalSubmission });
  return rcAdditionalSubmission;
}

export {
  secondsToHourMinuteSecondString,
  showNotification,
  dismissNotification,
  responseMessage,
  isObjectEmpty,
  getRcInfo,
  getRcUserInfo,
  getRcCallLogIdentity,
  getRcAccessToken,
  getRcContactInfo,
  checkC2DCollision,
  downloadTextFile,
  cleanUpExpiredStorage,
  createDebounceHandler,
  cacheCalldownContact,
  setRcAdditionalSubmission,
};
