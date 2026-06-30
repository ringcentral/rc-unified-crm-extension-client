const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function isObjectEmpty(value) {
  return !value || Object.values(value).every((item) => typeof item === 'undefined');
}

test('call logger viewLog opens the CRM log page when the platform supports log deep links', async () => {
  const openLogCalls = [];
  const openContactPageCalls = [];

  const viewLog = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/viewLog.js', {
    stubs: {
      '../../../core/log': {
        openLog(args) {
          openLogCalls.push(args);
        },
      },
      '../../../core/contact': {
        async openContactPage(args) {
          openContactPageCalls.push(args);
        },
      },
      '../../../core/user': {
        getCallPopMultiMatchBehavior() {
          throw new Error('multi-match behavior is not needed when opening a log page');
        },
      },
      '../../../lib/util': {
        responseMessage() {},
      },
    },
  });

  const manifest = {
    platforms: {
      acme: {
        canOpenLogPage: true,
      },
    },
  };

  await viewLog.onEvent({
    data: {
      body: {
        call: {
          sessionId: 'session-1',
          direction: 'Inbound',
        },
        fromEntity: {
          id: 'contact-from',
          contactType: 'Lead',
        },
        toEntity: {
          id: 'contact-to',
          contactType: 'Account',
        },
      },
    },
    manifest,
    platformInfo: {
      hostname: 'crm.example.com',
    },
    platformName: 'acme',
    platform: manifest.platforms.acme,
    existingCalls: [
      {
        sessionId: 'session-1',
        logId: 'log-1',
      },
    ],
    contactPhoneNumber: '+15550100',
    userSettings: {},
  });

  assert.deepEqual(openLogCalls, [
    {
      manifest,
      platformName: 'acme',
      hostname: 'crm.example.com',
      logId: 'log-1',
      contactType: 'Lead',
      contactId: 'contact-from',
    },
  ]);
  assert.deepEqual(openContactPageCalls, []);
});

test('call logger viewLog falls back to opening the matched contact page', async () => {
  const openLogCalls = [];
  const openContactPageCalls = [];

  const viewLog = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/viewLog.js', {
    stubs: {
      '../../../core/log': {
        openLog(args) {
          openLogCalls.push(args);
        },
      },
      '../../../core/contact': {
        async openContactPage(args) {
          openContactPageCalls.push(args);
        },
      },
      '../../../core/user': {
        getCallPopMultiMatchBehavior(userSettings) {
          assert.deepEqual(userSettings, { callPopMultiMatchBehavior: 'prompt' });
          return {
            value: 'prompt',
          };
        },
      },
      '../../../lib/util': {
        responseMessage() {},
      },
    },
  });

  const manifest = {
    platforms: {
      acme: {
        canOpenLogPage: false,
      },
    },
  };

  await viewLog.onEvent({
    data: {
      body: {
        call: {
          sessionId: 'session-2',
          direction: 'Outbound',
        },
        fromEntity: {
          id: 'contact-from',
          contactType: 'Lead',
        },
        toEntity: {
          id: 'contact-to',
          contactType: 'Account',
        },
      },
    },
    manifest,
    platformInfo: {
      hostname: 'crm.example.com',
    },
    platformName: 'acme',
    platform: manifest.platforms.acme,
    existingCalls: [],
    contactPhoneNumber: '+15550101',
    userSettings: {
      callPopMultiMatchBehavior: 'prompt',
    },
  });

  assert.deepEqual(openLogCalls, []);
  assert.deepEqual(openContactPageCalls, [
    {
      manifest,
      platformName: 'acme',
      phoneNumber: '+15550101',
      contactId: 'contact-to',
      contactType: 'Account',
      multiContactMatchBehavior: 'prompt',
    },
  ]);
});

test('/callLogger/match returns local and server call log matches and caches remote matches', async () => {
  const storage = createChromeStorage({
    userSettings: {},
    'rc-crm-call-log-local-1': {
      contact: {
        id: 'contact-local',
      },
    },
  });
  global.chrome = storage.chrome;

  const getLogCalls = [];
  const getCachedNoteCalls = [];
  const updateLogCalls = [];
  const responses = [];

  const match = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/match/index.js', {
    stubs: {
      '../../../../core/log': {
        async getLog(args) {
          getLogCalls.push(args);
          return {
            successful: true,
            callLogs: [
              {
                sessionId: 'remote-1',
                matched: true,
                logId: 'log-remote',
                telephonySessionId: 'telephony-remote',
                contact: {
                  id: 'contact-remote',
                },
              },
            ],
          };
        },
        async getCachedNote(args) {
          getCachedNoteCalls.push(args);
          return 'cached remote note';
        },
        async updateLog(args) {
          updateLogCalls.push(args);
        },
      },
      '../../../../core/user': {
        getOneTimeLogSetting() {
          return {
            value: false,
          };
        },
      },
      '../../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
        isObjectEmpty,
      },
    },
  });

  await match.onEvent({
    data: {
      requestId: 'req-call-match',
      body: {
        sessionIds: ['local-1', 'remote-1'],
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(getLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      sessionIds: 'remote-1',
      requireDetails: false,
    },
  ]);
  assert.deepEqual(getCachedNoteCalls, [
    {
      sessionId: 'remote-1',
    },
  ]);
  assert.deepEqual(updateLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      telephonySessionId: 'telephony-remote',
      sessionId: 'remote-1',
      note: 'cached remote note',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-call-match',
      payload: {
        data: {
          'local-1': [
            {
              id: 'local-1',
              note: '',
              contact: {
                id: 'contact-local',
              },
            },
          ],
          'remote-1': [
            {
              id: 'remote-1',
              note: 'cached remote note',
            },
          ],
        },
      },
    },
  ]);
  assert.deepEqual(storage.store['rc-crm-call-log-remote-1'], {
    logId: 'log-remote',
    contact: {
      id: 'contact-remote',
    },
  });
});

test('/callLogger/match reports queue warnings and one-time logging readiness status', async () => {
  const storage = createChromeStorage({
    userSettings: {},
    'is-call-queue-queue-1': {
      isQueue: true,
      warning: 'Answered by someone else',
    },
    'call-log-data-ready-pending-1': {
      isReady: false,
    },
  });
  global.chrome = storage.chrome;

  const responses = [];

  const match = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/match/index.js', {
    stubs: {
      '../../../../core/log': {
        async getLog(args) {
          assert.deepEqual(args, {
            serverUrl: 'https://server.example.com',
            logType: 'Call',
            sessionIds: 'queue-1,pending-1',
            requireDetails: false,
          });
          return {
            successful: true,
            callLogs: [],
          };
        },
        async getCachedNote() {
          throw new Error('cached notes are only needed for matched server logs');
        },
        async updateLog() {
          throw new Error('unmatched or warned sessions should not update logs');
        },
      },
      '../../../../core/user': {
        getOneTimeLogSetting() {
          return {
            value: true,
          };
        },
      },
      '../../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
        isObjectEmpty,
      },
    },
  });

  await match.onEvent({
    data: {
      requestId: 'req-call-match-status',
      body: {
        sessionIds: ['queue-1', 'pending-1'],
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(responses, [
    {
      requestId: 'req-call-match-status',
      payload: {
        data: {
          'queue-1': [
            {
              type: 'status',
              status: 'failed',
              message: 'Answered by someone else',
            },
          ],
          'pending-1': [
            {
              type: 'status',
              status: 'failed',
              message: 'preparing data...',
            },
          ],
        },
      },
    },
  ]);
});