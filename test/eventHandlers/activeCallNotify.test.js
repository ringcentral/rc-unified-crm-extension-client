const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
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
}

function createUserCoreStub(overrides = {}) {
  return {
    getIncomingCallPop() {
      return {
        value: overrides.incomingCallPop ?? 'off',
      };
    },
    getOutgoingCallPop() {
      return {
        value: overrides.outgoingCallPop ?? 'off',
      };
    },
    getCallPopMultiMatchBehavior() {
      return {
        value: overrides.multiMatchBehavior ?? 'prompt',
      };
    },
    getCallPopSetting() {
      return {
        value: overrides.callAutoPopup ?? false,
      };
    },
  };
}

async function loadActiveCallNotify({
  userCore = createUserCoreStub(),
  contactInfo = [
    {
      id: 'crm-contact-1',
      name: 'Ada Lovelace',
    },
  ],
  contactCalls = [],
  openContactCalls = [],
  cacheCalls = [],
  responseCalls = [],
  logCalls = [],
  defaultingCalls = [],
} = {}) {
  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        name: 'acme',
      },
    },
  };

  const activeCall = await loadBundledModule('src/eventHandlers/rc-active-call-notify.js', {
    stubs: {
      '../core/user': userCore,
      '../core/contact': {
        async getContact(args) {
          contactCalls.push(args);
          return {
            matched: contactInfo.length > 0,
            contactInfo,
          };
        },
        async openContactPage(args) {
          openContactCalls.push(args);
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return manifest;
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      '../core/log': {
        async uploadCacheNote(args) {
          logCalls.push({
            type: 'uploadCacheNote',
            args,
          });
        },
        async getCachedNote(args) {
          logCalls.push({
            type: 'getCachedNote',
            args,
          });
          return 'Remember pricing detail';
        },
      },
      '../components/logPage': {
        getLogPageRender(args) {
          logCalls.push({
            type: 'getLogPageRender',
            args,
          });
          return {
            id: args.id,
            note: args.logInfo.note,
            contactPhoneNumber: args.contactPhoneNumber,
          };
        },
      },
      '../lib/logUtil': {
        async cacheLogPageData(args) {
          cacheCalls.push(args);
        },
        async logPageFormDataDefaulting(args) {
          defaultingCalls.push(args);
          return {
            ...args.targetPage,
            defaultedCaseType: args.caseType,
          };
        },
      },
      '../lib/util': {
        responseMessage(requestId, payload) {
          responseCalls.push({ requestId, payload });
        },
      },
    },
  });

  return {
    activeCall,
    manifest,
  };
}

test('active call notify handles inbound ringing by storing ongoing state, notifying service worker, and opening contact on first ring', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const contactCalls = [];
  const openContactCalls = [];
  const { activeCall, manifest } = await loadActiveCallNotify({
    userCore: createUserCoreStub({
      incomingCallPop: 'onFirstRing',
      multiMatchBehavior: 'prompt',
    }),
    contactCalls,
    openContactCalls,
  });

  await activeCall.onEvent({
    data: {
      call: {
        sessionId: 'call-session-1',
        telephonySessionId: 'telephony-1',
        telephonyStatus: 'Ringing',
        direction: 'Inbound',
        from: {
          phoneNumber: '+15550100',
        },
        to: {
          phoneNumber: '+15550199',
        },
      },
    },
    popupContext: {},
  });

  assert.equal(storage.store.hasOngoingCall, true);
  assert.deepEqual(contactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      platformName: 'acme',
      isExtensionNumber: false,
    },
  ]);
  assert.deepEqual(runtimeMessages, [
    {
      type: 'incomingCallRinging',
      callId: 'telephony-1',
      telephonySessionId: 'telephony-1',
      sessionId: 'call-session-1',
      phoneNumber: '+15550100',
      callerName: 'Ada Lovelace',
    },
  ]);
  assert.deepEqual(openContactCalls, [
    {
      manifest,
      platformName: 'acme',
      phoneNumber: '+15550100',
      multiContactMatchBehavior: 'prompt',
      fromCallPop: true,
    },
  ]);
  assert.deepEqual(windowMessages, []);
  assert.deepEqual(widgetMessages, []);
});

test('active call notify handles connected outbound calls by opening expandable note, popping contact, and caching log page data', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const openContactCalls = [];
  const cacheCalls = [];
  const { activeCall, manifest } = await loadActiveCallNotify({
    userCore: createUserCoreStub({
      outgoingCallPop: 'onAnswer',
      multiMatchBehavior: 'openFirst',
    }),
    openContactCalls,
    cacheCalls,
  });

  await activeCall.onEvent({
    data: {
      call: {
        sessionId: 'call-session-2',
        telephonySessionId: 'telephony-2',
        telephonyStatus: 'CallConnected',
        direction: 'Outbound',
        from: {
          phoneNumber: '+15550199',
        },
        to: {
          phoneNumber: '+15550101',
        },
      },
    },
    popupContext: {},
  });

  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-expandable-call-note-open',
        sessionId: 'call-session-2',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(runtimeMessages, []);
  assert.deepEqual(openContactCalls, [
    {
      manifest,
      platformName: 'acme',
      phoneNumber: '+15550101',
      multiContactMatchBehavior: 'openFirst',
      fromCallPop: true,
    },
  ]);
  assert.deepEqual(cacheCalls, [
    {
      id: 'call-session-2',
      manifest,
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'acme',
      direction: 'Outbound',
      contactInfo: [
        {
          id: 'crm-contact-1',
          name: 'Ada Lovelace',
        },
      ],
      logInfo: {
        subject: 'Outbound Call to Ada Lovelace',
        note: '',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, []);
});

test('active call notify opens call log page on final ended call and triggers call logger match', async () => {
  const storage = createChromeStorage({
    userSettings: {},
    implementedInterfaces: {
      cacheCallNote: true,
      findContactWithName: true,
    },
  });
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const cacheCalls = [];
  const logCalls = [];
  const defaultingCalls = [];
  const { activeCall, manifest } = await loadActiveCallNotify({
    userCore: createUserCoreStub({
      callAutoPopup: true,
    }),
    cacheCalls,
    logCalls,
    defaultingCalls,
  });

  await activeCall.onEvent({
    data: {
      call: {
        sessionId: 'call-session-3',
        telephonySessionId: 'telephony-3',
        telephonyStatus: 'NoCall',
        terminationType: 'final',
        direction: 'Inbound',
        from: {
          phoneNumber: '+15550102',
        },
        to: {
          phoneNumber: '+15550199',
        },
      },
    },
    popupContext: {},
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'incomingCallResolved',
      callId: 'telephony-3',
      telephonySessionId: 'telephony-3',
      sessionId: 'call-session-3',
      phoneNumber: '+15550102',
      callerName: 'Ada Lovelace',
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-expandable-call-note-terminate',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(logCalls.map((call) => call.type), [
    'uploadCacheNote',
    'getCachedNote',
    'getLogPageRender',
  ]);
  assert.deepEqual(logCalls[0].args, {
    serverUrl: 'https://server.example.com',
    sessionId: 'call-session-3',
  });
  assert.deepEqual(logCalls[1].args, {
    sessionId: 'call-session-3',
  });
  assert.deepEqual(cacheCalls, [
    {
      id: 'call-session-3',
      manifest,
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'acme',
      direction: 'Inbound',
      contactInfo: [
        {
          id: 'crm-contact-1',
          name: 'Ada Lovelace',
        },
      ],
      logInfo: {
        note: 'Remember pricing detail',
        subject: 'Inbound Call from Ada Lovelace',
      },
      loggedContactId: null,
      isUnresolved: undefined,
    },
  ]);
  assert.equal(defaultingCalls.length, 1);
  assert.equal(defaultingCalls[0].caseType, 'inboundCall');
  assert.equal(defaultingCalls[0].logType, 'callLog');
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-call-log-page',
        page: {
          id: 'call-session-3',
          note: 'Remember pricing detail',
          contactPhoneNumber: '+15550102',
          defaultedCaseType: 'inboundCall',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/log/call/call-session-3',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['call-session-3'],
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(storage.store['call-log-data-ready-call-session-3'].isReady, false);
  assert.equal(typeof storage.store['call-log-data-ready-call-session-3'].expiry, 'number');
});

test('active call notify blocks final auto-popup log page for extension-only calls when extension logging is disabled', async () => {
  const storage = createChromeStorage({
    userSettings: {
      allowExtensionNumberLogging: {
        value: false,
      },
    },
  });
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const responseCalls = [];
  const { activeCall } = await loadActiveCallNotify({
    userCore: createUserCoreStub({
      callAutoPopup: true,
    }),
    contactInfo: [],
    responseCalls,
  });

  await activeCall.onEvent({
    data: {
      requestId: 'req-extension-final',
      call: {
        sessionId: 'call-session-extension',
        telephonySessionId: 'telephony-extension',
        telephonyStatus: 'NoCall',
        terminationType: 'final',
        direction: 'Inbound',
        from: {
          extensionNumber: '101',
        },
        to: {
          phoneNumber: '+15550199',
        },
      },
    },
    popupContext: {},
  });

  assert.deepEqual(responseCalls, [
    {
      requestId: 'req-extension-final',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(runtimeMessages, [
    {
      type: 'incomingCallResolved',
      callId: 'telephony-extension',
      telephonySessionId: 'telephony-extension',
      sessionId: 'call-session-extension',
      phoneNumber: '101',
      callerName: undefined,
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-expandable-call-note-terminate',
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(storage.store['call-log-data-ready-call-session-extension'], undefined);
  assert.deepEqual(widgetMessages, []);
});
