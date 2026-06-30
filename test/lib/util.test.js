const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

async function loadUtil({ openDB } = {}) {
  return loadBundledModule('src/lib/util.js', {
    stubs: {
      idb: {
        openDB: openDB ?? (async () => ({ get: async () => undefined })),
      },
      '../i18n': {
        t(key) {
          return key;
        },
      },
    },
  });
}

test('util formats seconds into hour minute second string', async () => {
  const util = await loadUtil();

  assert.equal(util.secondsToHourMinuteSecondString(0), '0h0m0s');
  assert.equal(util.secondsToHourMinuteSecondString(3661), '1h1m1s');
  assert.equal(util.secondsToHourMinuteSecondString(86399), '23h59m59s');
});

test('util showNotification respects notification level settings and default warning level', async () => {
  const storage = createChromeStorage({
    notificationLevelSetting: ['warning', 'error'],
  });
  global.chrome = storage.chrome;

  const alerts = [];
  global.RCAdapter = {
    async alertMessage(payload) {
      alerts.push(payload);
      return `notification-${alerts.length}`;
    },
  };

  const util = await loadUtil();

  assert.equal(await util.showNotification({ message: 'CRM auth expired', ttl: 5000 }), 'notification-1');
  assert.equal(await util.showNotification({ level: 'success', message: 'Saved', ttl: 3000 }), undefined);
  assert.equal(await util.showNotification({ level: 'warning', message: {}, ttl: 3000 }), undefined);

  assert.deepEqual(alerts, [
    {
      level: 'warning',
      message: 'CRM auth expired',
      ttl: 5000,
      details: null,
    },
  ]);
});

test('util responseMessage posts widget response to the adapter iframe', async () => {
  const widgetMessages = [];
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            widgetMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };

  const util = await loadUtil();

  util.responseMessage('request-1', { data: 'ok' });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-post-message-response',
        responseId: 'request-1',
        response: { data: 'ok' },
      },
      targetOrigin: '*',
    },
  ]);
});

test('util createDebounceHandler executes only the latest request for a handler key', async () => {
  const util = await loadUtil();
  const handled = [];

  const debounce = util.createDebounceHandler('platformSearch', 10);
  debounce({ requestId: 'old', value: 'sales' }, async (request) => {
    handled.push(request);
  });
  debounce({ requestId: 'new', value: 'salesforce' }, async (request) => {
    handled.push(request);
  });

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.deepEqual(handled, [
    { requestId: 'new', value: 'salesforce' },
  ]);
});

test('util cacheCalldownContact stores complete callback contact data by contact id', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const util = await loadUtil();

  await util.cacheCalldownContact({
    contactId: 123,
    contactName: 'Ada Lovelace',
    phoneNumber: '+15550100',
    contactType: 'Lead',
  });
  await util.cacheCalldownContact({
    contactId: 456,
    contactName: '',
    phoneNumber: '+15550101',
    contactType: 'Contact',
  });

  assert.equal(storage.store.calldownContactCache['123'].contactName, 'Ada Lovelace');
  assert.equal(storage.store.calldownContactCache['123'].phoneNumber, '+15550100');
  assert.equal(storage.store.calldownContactCache['123'].contactType, 'Lead');
  assert.equal(typeof storage.store.calldownContactCache['123'].cachedAt, 'number');
  assert.equal(storage.store.calldownContactCache['456'], undefined);
});

test('util setRcAdditionalSubmission maps configured RingCentral info paths and skips missing paths', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const util = await loadUtil();

  const rcAdditionalSubmission = await util.setRcAdditionalSubmission({
    rcInfo: {
      value: {
        account: {
          id: 'rc-account-1',
        },
        extension: {
          number: '101',
        },
      },
    },
    platform: {
      rcAdditionalSubmission: [
        { id: 'rcAccountId', path: 'account.id' },
        { id: 'extensionNumber', path: 'extension.number' },
        { id: 'missingNestedValue', path: 'extension.profile.email' },
      ],
    },
  });

  assert.deepEqual(rcAdditionalSubmission, {
    rcAccountId: 'rc-account-1',
    extensionNumber: '101',
  });
  assert.deepEqual(storage.store.rcAdditionalSubmission, rcAdditionalSubmission);
});