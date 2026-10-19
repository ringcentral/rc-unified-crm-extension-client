import { openDB } from 'idb';
import { t } from '../i18n';

type UnknownRecord = Record<string, any>;

/** Matches the widget's storage `prefix`, which localforage uses as the database name. */
const WIDGET_STORAGE_DB_NAME = 'rc-widget';
const WIDGET_STORAGE_STORE_NAME = 'keyvaluepairs';
const WIDGET_SDK_PLATFORM_KEY = 'sdk-rc-widgetplatform';
const WIDGET_DATA_FETCHER_MODULE = 'DataFetcher';
const WIDGET_CACHE_WAIT_TIMEOUT_MS = 3000;
const WIDGET_CACHE_POLL_INTERVAL_MS = 100;

declare const RCAdapter: {
  alertMessage(options: UnknownRecord): Promise<string> | string;
  dismissMessage(notificationId: unknown): Promise<unknown> | unknown;
  refreshLoginSession(force: boolean): Promise<void>;
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

async function refreshRCToken(force: boolean = false): Promise<void> {
  await RCAdapter.refreshLoginSession(force);
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

/**
 * Reads one entry from the widget's storage.
 *
 * The widget keeps its module state and its SDK cache in a single localforage
 * database named after its storage prefix. Returns `undefined` instead of
 * throwing when the widget has not created the store yet, because callers run
 * on widget events that must not be aborted.
 */
async function readWidgetStorage(key: string): Promise<unknown> {
  const databases = await indexedDB.databases();
  if (!databases.some((database) => database.name === WIDGET_STORAGE_DB_NAME)) {
    return undefined;
  }
  const database = await openDB(WIDGET_STORAGE_DB_NAME);
  try {
    if (!database.objectStoreNames.contains(WIDGET_STORAGE_STORE_NAME)) {
      return undefined;
    }
    return await database.get(WIDGET_STORAGE_STORE_NAME, key);
  } finally {
    database.close();
  }
}

/** Module state is persisted with each field held as its own JSON-encoded string. */
function parseStoredJson<T>(raw: unknown): T | undefined {
  if (raw && typeof raw === 'object') {
    return raw as T;
  }
  if (typeof raw !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); });
}

async function readWidgetDataFetcherCache(): Promise<UnknownRecord | undefined> {
  const dataFetcher = await readWidgetStorage(`persist:${WIDGET_DATA_FETCHER_MODULE}`);
  return parseStoredJson<UnknownRecord>(parseStoredJson<UnknownRecord>(dataFetcher)?.storageData);
}

/** Polls until the widget has flushed its cache, or the deadline passes. */
async function waitForWidgetDataFetcherCache(): Promise<UnknownRecord | undefined> {
  const deadline = Date.now() + WIDGET_CACHE_WAIT_TIMEOUT_MS;
  let storageData: UnknownRecord | undefined;
  while (Date.now() < deadline) {
    await delay(WIDGET_CACHE_POLL_INTERVAL_MS);
    storageData = await readWidgetDataFetcherCache();
    if (storageData?.cachedData) {
      return storageData;
    }
  }
  return storageData;
}

/**
 * Reads the widget's cached RingCentral account data.
 *
 * The widget persists this cache asynchronously after it authenticates, so a
 * host event can arrive before the write lands. While a widget session exists,
 * wait briefly for the cache instead of reporting it as empty. The `value`
 * wrapper is preserved so callers can keep reading
 * `rcInfo.value.cachedData.extensionInfo` as they did with the previous
 * per-user widget database.
 */
async function getRcInfo(): Promise<UnknownRecord> {
  let storageData = await readWidgetDataFetcherCache();
  if (!storageData?.cachedData && await getRcAccessToken()) {
    storageData = await waitForWidgetDataFetcherCache();
  }
  return { value: storageData ?? {} };
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

/**
 * Reads the access token from the widget's SDK cache.
 *
 * The widget backs its SDK cache with the same IndexedDB store as its modules,
 * so this value is no longer available synchronously from `localStorage`.
 */
async function getRcAccessToken(): Promise<string> {
  const platformData = await readWidgetStorage(WIDGET_SDK_PLATFORM_KEY);
  return parseStoredJson<UnknownRecord>(platformData)?.access_token ?? '';
}

async function getRcAccessTokenHeaderConfig(config: UnknownRecord = {}): Promise<UnknownRecord> {
  const rcAccessToken = await getRcAccessToken();
  return {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      'X-RC-Access-Token': rcAccessToken,
    },
  };
}

async function getRcContactInfo(): Promise<UnknownRecord[]> {
  const rcInfo = await getRcInfo();
  const companyContacts = rcInfo.value?.cachedData?.companyContacts;
  return Array.isArray(companyContacts) ? companyContacts : [];
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
  return function <Request>(request: Request, handlerFunction: (request: Request) => unknown | Promise<unknown>): void {
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
  refreshRCToken,
  responseMessage,
  isObjectEmpty,
  getRcInfo,
  getRcUserInfo,
  getRcCallLogIdentity,
  getRcAccessToken,
  getRcAccessTokenHeaderConfig,
  getRcContactInfo,
  checkC2DCollision,
  downloadTextFile,
  cleanUpExpiredStorage,
  createDebounceHandler,
  cacheCalldownContact,
  setRcAdditionalSubmission,
};
