const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

test('telephony session notify stores pending recording marker and tracks pending recording session id', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const pendingRecordingCalls = [];

  const telephonySession = await loadBundledModule('src/eventHandlers/rc-telephony-session-notify.js', {
    stubs: {
      '../lib/logUtil': {
        async addPendingRecordingSessionId(args) {
          pendingRecordingCalls.push(args);
        },
      },
      '../core/contact': {
        async openContactPage() {
          throw new Error('recording marker event should not open contact page');
        },
      },
      '../core/user': {},
      '../service/manifestService': {
        async getManifest() {
          return {};
        },
      },
    },
  });

  await telephonySession.onEvent({
    data: {
      telephonySession: {
        sessionId: 'telephony-session-1',
        parties: [
          {
            recordings: [
              {
                id: 'recording-1',
              },
            ],
            status: {},
            direction: 'Inbound',
          },
        ],
      },
    },
    popupContext: {},
  });

  assert.equal(storage.store['rec-link-telephony-session-1'].link, '(pending...)');
  assert.equal(typeof storage.store['rec-link-telephony-session-1'].expiry, 'number');
  assert.deepEqual(pendingRecordingCalls, [
    {
      sessionId: 'telephony-session-1',
    },
  ]);
});

test('telephony session notify stores attended transfer hold session id and opens contact on warm transfer answer', async () => {
  const storage = createChromeStorage({
    'platform-info': {
      platformName: 'acme',
    },
    userSettings: {
      callPopMultiMatchBehavior: 'prompt',
    },
  });
  global.chrome = storage.chrome;

  const openContactCalls = [];

  const telephonySession = await loadBundledModule('src/eventHandlers/rc-telephony-session-notify.js', {
    stubs: {
      '../lib/logUtil': {
        async addPendingRecordingSessionId() {},
      },
      '../core/contact': {
        async openContactPage(args) {
          openContactCalls.push(args);
        },
      },
      '../core/user': {
        getCallPopMultiMatchBehavior() {
          return {
            value: 'prompt',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
            platforms: {
              acme: {},
            },
          };
        },
      },
    },
  });

  const popupContext = {};

  await telephonySession.onEvent({
    data: {
      telephonySession: {
        sessionId: 'telephony-session-transfer',
        parties: [
          {
            direction: 'Outbound',
            status: {
              code: 'Gone',
              reason: 'AttendedTransfer',
              peerId: {
                telephonySessionId: 'held-session-1',
              },
            },
          },
          {
            direction: 'Outbound',
            to: {
              phoneNumber: '+15550100',
            },
            status: {
              code: 'Answered',
              reason: 'AttendedTransfer',
            },
          },
        ],
      },
    },
    popupContext,
  });

  assert.equal(popupContext.transferOnHold, 'held-session-1');
  assert.deepEqual(openContactCalls, [
    {
      manifest: {
        serverUrl: 'https://server.example.com',
        platforms: {
          acme: {},
        },
      },
      platformName: 'acme',
      phoneNumber: '+15550100',
      multiContactMatchBehavior: 'prompt',
      fromCallPop: true,
    },
  ]);
});

test('call logger auto-log notify tracks setting edit and starts retro auto-log interval when CRM is authenticated', async () => {
  const storage = createChromeStorage({
    crmAuthed: true,
  });
  global.chrome = storage.chrome;

  const originalSetInterval = global.setInterval;
  const intervalCalls = [];
  global.setInterval = (handler, delay) => {
    intervalCalls.push({ handler, delay });
    handler();
    return 12345;
  };

  const analyticsCalls = [];
  const retroAutoLogCalls = [];

  try {
    const autoLogNotify = await loadBundledModule('src/eventHandlers/rc-callLogger-auto-log-notify.js', {
      stubs: {
        '../lib/analytics': {
          trackEditSettings(args) {
            analyticsCalls.push(args);
          },
        },
        '../service/logService': {
          retroAutoCallLog(args) {
            retroAutoLogCalls.push(args);
          },
        },
        '../service/manifestService': {
          async getManifest() {
            return {
              serverUrl: 'https://server.example.com',
              platforms: {
                acme: {
                  name: 'acme',
                },
              },
            };
          },
        },
        '../service/platformService': {
          async getPlatformInfo() {
            return {
              platformName: 'acme',
            };
          },
        },
      },
    });

    await autoLogNotify.onEvent({
      data: {
        autoLog: true,
      },
    });
  } finally {
    global.setInterval = originalSetInterval;
  }

  assert.deepEqual(analyticsCalls, [
    {
      changedItem: 'auto-call-log',
      status: true,
    },
  ]);
  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 10);
  assert.equal(storage.store.retroAutoCallLogIntervalId, 12345);
  assert.deepEqual(intervalCalls.map(({ delay }) => delay), [60000]);
  assert.deepEqual(retroAutoLogCalls, [
    {
      manifest: {
        serverUrl: 'https://server.example.com',
        platforms: {
          acme: {
            name: 'acme',
          },
        },
      },
      platformName: 'acme',
      platform: {
        name: 'acme',
      },
    },
  ]);
});

test('message logger auto-log notify tracks setting edit without storage side effects', async () => {
  const analyticsCalls = [];

  const messageAutoLog = await loadBundledModule('src/eventHandlers/rc-messageLogger-auto-log-notify.js', {
    stubs: {
      '../lib/analytics': {
        trackEditSettings(args) {
          analyticsCalls.push(args);
        },
      },
    },
  });

  await messageAutoLog.onEvent({
    data: {
      autoLog: false,
    },
  });

  assert.deepEqual(analyticsCalls, [
    {
      changedItem: 'auto-message-log',
      status: false,
    },
  ]);
});

test('webphone connected notify checks auth and registers feedback callback that opens support flow', async () => {
  const windowMessages = [];
  global.window = {
    postMessage(message) {
      windowMessages.push(message);
    },
  };

  const checkAuthCalls = [];
  const feedbackConfigs = [];
  global.RCAdapter = {
    showFeedback(config) {
      feedbackConfigs.push(config);
      config.onFeedback();
    },
  };

  const webphoneConnection = await loadBundledModule('src/eventHandlers/rc-webphone-connection-status-notify.js', {
    stubs: {
      '../core/auth': {
        async checkAuth() {
          checkAuthCalls.push({});
        },
      },
    },
  });

  await webphoneConnection.onEvent({
    data: {
      connectionStatus: 'connectionStatus-connected',
    },
  });

  assert.deepEqual(checkAuthCalls, [{}]);
  assert.equal(feedbackConfigs.length, 1);
  assert.deepEqual(windowMessages, [
    {
      path: '/custom-button-click',
      type: 'rc-post-message-request',
      body: {
        button: {
          id: 'openSupportPage',
        },
      },
    },
  ]);
});
