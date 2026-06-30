const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function createHandlerStub(calls, name) {
  return {
    async onEvent() {
      calls.push(name);
    },
  };
}

test('/callLogger blocks extension number logging and responds to the widget', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const notifications = [];
  const responses = [];
  const handlerCalls = [];

  const callLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/index.js', {
    stubs: {
      '../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
        isObjectEmpty(value) {
          return !value || Object.values(value).every((item) => typeof item === 'undefined');
        },
        showNotification(notification) {
          notifications.push(notification);
        },
      },
      '../../../core/log': {
        async getLog() {
          throw new Error('getLog should not be called for blocked extension numbers');
        },
        async getCachedNote() {
          throw new Error('getCachedNote should not be called for blocked extension numbers');
        },
      },
      '../../../core/user': {
        getOneTimeLogSetting() {
          return { value: false };
        },
        getCallPopSetting() {
          return { value: false };
        },
        getAutoLogCallSetting() {
          return { value: false };
        },
      },
      '../../../components/tempLogNotePage': {},
      './logForm': createHandlerStub(handlerCalls, 'logForm'),
      './callLogSync': createHandlerStub(handlerCalls, 'callLogSync'),
      './viewLog': createHandlerStub(handlerCalls, 'viewLog'),
      './createLog': createHandlerStub(handlerCalls, 'createLog'),
    },
  });

  await callLogger.onEvent({
    data: {
      requestId: 'req-call-extension',
      body: {
        triggerType: 'createLog',
        redirect: false,
        call: {
          sessionId: 'session-1',
          direction: 'Inbound',
          result: 'Disconnected',
          queueCall: false,
          from: {
            extensionNumber: '101',
          },
          to: {
            phoneNumber: '+15550100',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(handlerCalls, []);
  assert.deepEqual(responses, [
    {
      requestId: 'req-call-extension',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Extension numbers cannot be logged',
      ttl: 3000,
    },
  ]);
  assert.equal(storage.store['call-log-data-ready-session-1'].isReady, false);
});

test('/callLogger flags queue calls answered elsewhere and does not enter log flow', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

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

  const notifications = [];
  const responses = [];
  const handlerCalls = [];

  const callLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/index.js', {
    stubs: {
      '../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
        isObjectEmpty() {
          throw new Error('recording readiness should not be checked for calls answered elsewhere');
        },
        showNotification(notification) {
          notifications.push(notification);
        },
      },
      '../../../core/log': {
        async getLog() {
          throw new Error('getLog should not be called for calls answered elsewhere');
        },
        async getCachedNote() {
          throw new Error('getCachedNote should not be called for calls answered elsewhere');
        },
      },
      '../../../core/user': {},
      '../../../components/tempLogNotePage': {},
      './logForm': createHandlerStub(handlerCalls, 'logForm'),
      './callLogSync': createHandlerStub(handlerCalls, 'callLogSync'),
      './viewLog': createHandlerStub(handlerCalls, 'viewLog'),
      './createLog': createHandlerStub(handlerCalls, 'createLog'),
    },
  });

  await callLogger.onEvent({
    data: {
      requestId: 'req-call-queue',
      body: {
        triggerType: 'createLog',
        redirect: true,
        call: {
          sessionId: 'session-queue-1',
          action: 'Disconnected',
          direction: 'Inbound',
          result: 'Answered Elsewhere',
          delegationType: 'QueueForwarding',
          from: {
            phoneNumber: '+15550100',
          },
          to: {
            phoneNumber: '+15550101',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(handlerCalls, []);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-queue-1'],
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-call-queue',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Cannot log this call. It is answered by someone else.',
      ttl: 3000,
    },
  ]);
  assert.equal(storage.store['is-call-queue-session-queue-1'].isQueue, true);
  assert.equal(storage.store['is-call-queue-session-queue-1'].warning, 'Answered by someone else');
  assert.equal(typeof storage.store['is-call-queue-session-queue-1'].expiry, 'number');
});

test('/callLogger opens temporary note page when one-time logging waits for recording data', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

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

  const notifications = [];
  const responses = [];
  const cachedNoteCalls = [];
  const handlerCalls = [];

  const callLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/index.js', {
    stubs: {
      '../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
        isObjectEmpty(value) {
          return !value || Object.values(value).every((item) => typeof item === 'undefined');
        },
        showNotification(notification) {
          notifications.push(notification);
        },
      },
      '../../../core/log': {
        async getLog() {
          throw new Error('getLog should not be called while one-time logging waits for recording data');
        },
        async getCachedNote(args) {
          cachedNoteCalls.push(args);
          return 'Remember to mention contract terms';
        },
      },
      '../../../core/user': {
        getOneTimeLogSetting() {
          return { value: true };
        },
      },
      '../../../components/tempLogNotePage': {
        getTempLogNotePageRender(args) {
          return {
            id: 'tempLogNotePage',
            sessionId: args.sessionId,
            note: args.cachedNote,
          };
        },
      },
      './logForm': createHandlerStub(handlerCalls, 'logForm'),
      './callLogSync': createHandlerStub(handlerCalls, 'callLogSync'),
      './viewLog': createHandlerStub(handlerCalls, 'viewLog'),
      './createLog': createHandlerStub(handlerCalls, 'createLog'),
    },
  });

  await callLogger.onEvent({
    data: {
      requestId: 'req-call-temp-note',
      body: {
        triggerType: 'createLog',
        redirect: true,
        call: {
          sessionId: 'session-recording-1',
          action: 'Disconnected',
          direction: 'Inbound',
          result: 'Disconnected',
          queueCall: false,
          recording: {
            link: 'https://recordings.example.com/recording-1',
          },
          from: {
            phoneNumber: '+15550100',
          },
          to: {
            phoneNumber: '+15550101',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(handlerCalls, []);
  assert.deepEqual(cachedNoteCalls, [
    {
      sessionId: 'session-recording-1',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Call data is not yet ready. Please input your custom note while it is preparing data.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'tempLogNotePage',
          sessionId: 'session-recording-1',
          note: 'Remember to mention contract terms',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/tempLogNotePage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-call-temp-note',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.equal(storage.store['call-log-data-ready-session-recording-1'].isReady, false);
});
