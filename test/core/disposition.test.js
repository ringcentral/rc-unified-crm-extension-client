const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

async function loadDisposition({ axiosPut, getRcInfo, notifications = [] }) {
  return loadBundledModule('src/core/disposition.js', {
    stubs: {
      axios: {
        async put(url, body) {
          return axiosPut(url, body);
        },
      },
      '../lib/util': {
        async getRcInfo() {
          return getRcInfo();
        },
        showNotification(notification) {
          notifications.push(notification);
        },
      },
    },
  });
}

test('disposition upsert writes call disposition with RingCentral account context and shows the server message', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    rcAdditionalSubmission: {
      rcAccountId: 'rc-account-1',
    },
  });
  global.chrome = storage.chrome;

  const axiosPuts = [];
  const notifications = [];

  const disposition = await loadDisposition({
    notifications,
    async getRcInfo() {
      return {
        value: {
          cachedData: {
            extensionInfo: {
              extensionNumber: '101',
            },
          },
        },
      };
    },
    async axiosPut(url, body) {
      axiosPuts.push({ url, body });
      return {
        data: {
          returnMessage: {
            messageType: 'success',
            message: 'Call disposition updated',
            ttl: 4000,
            details: {
              disposition: 'Connected',
            },
          },
        },
      };
    },
  });

  await disposition.upsertDisposition({
    serverUrl: 'https://server.example.com',
    logType: 'Call',
    sessionId: 'session-1',
    dispositions: {
      disposition: 'Connected',
      note: 'Followed up',
    },
  });

  assert.deepEqual(axiosPuts, [
    {
      url: 'https://server.example.com/callDisposition',
      body: {
        sessionId: 'session-1',
        dispositions: {
          disposition: 'Connected',
          note: 'Followed up',
        },
        additionalSubmission: {
          rcAccountId: 'rc-account-1',
        },
        extensionNumber: '101',
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Call disposition updated',
      ttl: 4000,
      details: {
        disposition: 'Connected',
      },
    },
  ]);
});

test('disposition upsert does not call the server without a CRM JWT', async () => {
  const storage = createChromeStorage({
    rcAdditionalSubmission: {
      rcAccountId: 'rc-account-1',
    },
  });
  global.chrome = storage.chrome;

  const axiosPuts = [];
  const notifications = [];

  const disposition = await loadDisposition({
    notifications,
    async getRcInfo() {
      return {
        value: {
          cachedData: {
            extensionInfo: {
              extensionNumber: '101',
            },
          },
        },
      };
    },
    async axiosPut(url, body) {
      axiosPuts.push({ url, body });
      return {
        data: {},
      };
    },
  });

  await disposition.upsertDisposition({
    serverUrl: 'https://server.example.com',
    logType: 'Call',
    sessionId: 'session-1',
    dispositions: {
      disposition: 'Connected',
    },
  });

  assert.deepEqual(axiosPuts, []);
  assert.deepEqual(notifications, []);
});
