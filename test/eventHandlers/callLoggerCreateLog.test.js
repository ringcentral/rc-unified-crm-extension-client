const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

test('call logger createLog auto-logs a matched call and upserts disposition when no conflict exists', async () => {
  const storage = createChromeStorage({
    implementedInterfaces: {
      upsertCallDisposition: true,
    },
  });
  global.chrome = storage.chrome;
  global.window = {
    postMessage() {
      throw new Error('loading state should not be changed for a clean auto-log path');
    },
  };

  const getContactCalls = [];
  const getCachedNoteCalls = [];
  const addLogCalls = [];
  const upsertDispositionCalls = [];
  const notifications = [];

  const createLog = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/createLog.js', {
    stubs: {
      '../../../core/contact': {
        async getContact(args) {
          getContactCalls.push(args);
          return {
            matched: true,
            returnMessage: null,
            contactInfo: [
              {
                id: 'contact-1',
                name: 'Ada Lovelace',
                type: 'Lead',
              },
            ],
          };
        },
        async createContact() {
          throw new Error('createContact should not run when contact match has no conflict');
        },
      },
      '../../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
        responseMessage() {
          throw new Error('createLog child handler should not respond directly on clean auto-log path');
        },
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
      },
      '../../../core/log': {
        async getCachedNote(args) {
          getCachedNoteCalls.push(args);
          return 'Cached call note';
        },
        async addLog(args) {
          addLogCalls.push(args);
        },
        async updateLog() {
          throw new Error('updateLog should not run when creating a new auto log');
        },
        getConflictContentFromUnresolvedLog() {
          throw new Error('conflict content should not be needed for no-conflict auto log');
        },
      },
      '../../../core/user': {
        getOneTimeLogSetting() {
          return {
            value: false,
          };
        },
      },
      moment: () => ({
        format() {
          return '06/01/2026';
        },
      }),
      '../../../components/logPage': {},
      '../../../core/disposition': {
        async upsertDisposition(args) {
          upsertDispositionCalls.push(args);
        },
      },
      '../../../lib/logUtil': {
        async getLogConflictInfo(args) {
          assert.equal(args.logType, 'callLog');
          assert.equal(args.isAutoLog, true);
          return {
            hasConflict: false,
            autoSelectAdditionalSubmission: {
              disposition: 'Connected',
            },
            requireManualDisposition: false,
            conflictType: null,
          };
        },
        async logPageFormDataDefaulting() {
          throw new Error('logPageFormDataDefaulting should not run for direct auto log');
        },
        async cacheLogPageData() {
          throw new Error('cacheLogPageData should not run for direct auto log');
        },
      },
      '../../../misc/constant': {
        CONSTANTS: {
          UNKNOWN_CONTACT_CONFLICT_TYPE: 'unknownContact',
          MULTIPLE_CONTACTS_CONFLICT_TYPE: 'multipleContacts',
        },
      },
    },
  });

  const call = {
    sessionId: 'session-1',
    telephonySessionId: 'telephony-1',
    direction: 'Inbound',
    result: 'Disconnected',
    startTime: '2026-06-01T10:00:00.000Z',
    duration: 60,
    from: {
      name: 'Ada Lovelace',
      phoneNumber: '+15550100',
    },
    to: {
      phoneNumber: '+15550101',
    },
  };
  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const platform = {
    name: 'acme',
    contactTypes: [
      {
        value: 'Lead',
      },
    ],
  };
  const userSettings = {};

  await createLog.onEvent({
    data: {
      requestId: 'req-auto-call-log',
      body: {
        call,
        aiNote: 'AI note',
        transcript: 'Transcript',
      },
    },
    triggerTypeInUse: 'createLog',
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform,
    contactPhoneNumber: '+15550100',
    userSettings,
    existingCalls: [],
    isAutoLog: true,
    isCallAutoPopup: false,
    isExtensionNumber: false,
  });

  assert.deepEqual(getContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      platformName: 'acme',
      isExtensionNumber: false,
    },
  ]);
  assert.deepEqual(getCachedNoteCalls, [
    {
      sessionId: 'session-1',
    },
  ]);
  assert.deepEqual(addLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      logInfo: call,
      isMain: true,
      note: 'Cached call note',
      aiNote: 'AI note',
      transcript: 'Transcript',
      subject: 'Inbound Call from Ada Lovelace',
      additionalSubmission: {
        disposition: 'Connected',
      },
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Ada Lovelace',
    },
  ]);
  assert.deepEqual(upsertDispositionCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      sessionId: 'session-1',
      dispositions: {
        disposition: 'Connected',
        note: 'Cached call note',
      },
    },
  ]);
  assert.deepEqual(notifications, []);
});
