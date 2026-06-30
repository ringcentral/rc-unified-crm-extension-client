const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installAdapterFrame(postedMessages) {
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            postedMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };
}

test('log.addLog posts call log payload with RingCentral metadata and triggers matcher', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    userSettings: {
      overridingPhoneNumberFormat: {
        value: 'E.164',
      },
      overridingPhoneNumberFormat2: {
        value: 'National',
      },
    },
    rcAdditionalSubmission: {
      rcField: 'account-level',
    },
  });
  global.chrome = storage.chrome;

  const postedMessages = [];
  const notifications = [];
  const posts = [];
  installAdapterFrame(postedMessages);

  const log = await loadBundledModule('src/core/log.js', {
    stubs: {
      axios: {
        async post(url, body) {
          posts.push({ url, body });
          return {
            data: {
              successful: true,
              logId: 'log-1',
              returnMessage: {
                messageType: 'success',
                message: 'Call logged',
                ttl: 3000,
              },
            },
          };
        },
      },
      '../lib/util': {
        getRcAccessToken() {
          return 'rc-access-token';
        },
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
        showNotification(notification) {
          notifications.push(notification);
        },
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
      },
      '../lib/analytics': {
        trackSyncCallLog() {},
        trackSyncMessageLog() {},
      },
      '../i18n': {
        t: (key) => key,
      },
    },
  });

  await log.addLog({
    serverUrl: 'https://server.example.com',
    logType: 'Call',
    logInfo: {
      sessionId: 'session-1',
      recording: {
        contentUri: 'https://rc.example.com/recording',
      },
    },
    isMain: true,
    subject: 'Inbound Call from Ada',
    note: 'Customer asked for follow up',
    aiNote: 'AI summary',
    transcript: 'Transcript text',
    additionalSubmission: {
      crmField: 'sales',
    },
    contactId: 'contact-1',
    contactType: 'Lead',
    contactName: 'Ada Lovelace',
  });

  assert.deepEqual(posts, [
    {
      url: 'https://server.example.com/callLog',
      body: {
        logInfo: {
          sessionId: 'session-1',
          recording: {
            contentUri: 'https://rc.example.com/recording',
            downloadUrl: 'https://rc.example.com/recording?accessToken=rc-access-token',
          },
          customSubject: 'Inbound Call from Ada',
        },
        note: 'Customer asked for follow up',
        aiNote: 'AI summary',
        transcript: 'Transcript text',
        additionalSubmission: {
          crmField: 'sales',
          rcField: 'account-level',
        },
        overridingFormat: ['E.164', 'National'],
        contactId: 'contact-1',
        contactType: 'Lead',
        contactName: 'Ada Lovelace',
        extensionNumber: '101',
      },
    },
  ]);
  assert.deepEqual(storage.store['rc-crm-call-log-session-1'], {
    contact: {
      id: 'contact-1',
    },
    logId: 'log-1',
  });
  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-1'],
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(notifications[0].message, 'Call logged');
});

test('log.addLog posts message log payload and caches conversation preference', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    userSettings: {
      overridingPhoneNumberFormat: {
        value: 'E.164',
      },
    },
    rcAdditionalSubmission: {
      rcField: 'account-level',
    },
  });
  global.chrome = storage.chrome;

  const posts = [];

  const log = await loadBundledModule('src/core/log.js', {
    stubs: {
      axios: {
        async post(url, body) {
          posts.push({ url, body });
          return {
            data: {
              successful: true,
              logIds: ['message-log-1'],
              returnMessage: {
                messageType: 'success',
                message: 'Message logged',
                ttl: 3000,
              },
            },
          };
        },
      },
      '../lib/util': {
        getRcAccessToken() {
          return 'rc-access-token';
        },
        async getRcInfo() {
          return {};
        },
        showNotification() {},
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
      },
      '../lib/analytics': {
        trackSyncCallLog() {},
        trackSyncMessageLog() {},
      },
      '../i18n': {
        t: (key) => key,
      },
    },
  });

  const conversation = {
    conversationLogId: 'conversation-log-1',
    type: 'SMS',
    messages: [
      {
        attachments: [],
      },
    ],
  };

  await log.addLog({
    serverUrl: 'https://server.example.com',
    logType: 'Message',
    logInfo: conversation,
    isMain: true,
    additionalSubmission: {
      crmField: 'sales',
    },
    contactId: 'contact-1',
    contactType: 'Lead',
    contactName: 'Ada Lovelace',
  });

  assert.deepEqual(posts, [
    {
      url: 'https://server.example.com/messageLog',
      body: {
        logInfo: conversation,
        additionalSubmission: {
          crmField: 'sales',
          rcField: 'account-level',
        },
        overridingFormat: ['E.164'],
        contactId: 'contact-1',
        contactType: 'Lead',
        contactName: 'Ada Lovelace',
      },
    },
  ]);
  assert.deepEqual(storage.store['rc-crm-conversation-pref-conversation-log-1'], {
    contact: {
      id: 'contact-1',
      type: 'Lead',
      name: 'Ada Lovelace',
    },
    additionalSubmission: {
      rcField: 'account-level',
    },
  });
  assert.deepEqual(storage.store['rc-crm-conversation-log-conversation-log-1'], {
    logged: true,
  });
});
