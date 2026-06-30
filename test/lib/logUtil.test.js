const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

async function loadLogUtil(overrides = {}) {
  return loadBundledModule('src/lib/logUtil.js', {
    stubs: {
      '../core/user': overrides.userCore ?? {},
      '../service/logService': overrides.logService ?? {},
      '../service/manifestService': overrides.manifestService ?? {},
      '../service/platformService': overrides.platformService ?? {},
    },
  });
}

function createUserCoreStub() {
  return {
    getCustomSetting(userSettings, id, defaultValue) {
      return {
        value: userSettings[id]?.value ?? defaultValue,
      };
    },
  };
}

test('logUtil applies platform default settings to log page form data', async () => {
  const storage = createChromeStorage({
    userSettings: {
      callOutcomeDefault: {
        value: 'Interested',
      },
      followUpDefault: {
        value: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const logUtil = await loadLogUtil({
    userCore: createUserCoreStub(),
  });

  const targetPage = {
    schema: {
      properties: {
        callOutcome: {
          oneOf: [
            {
              const: 'interested',
              title: 'Interested',
            },
            {
              const: 'not_interested',
              title: 'Not Interested',
            },
          ],
        },
        needsFollowUp: {
          type: 'boolean',
        },
      },
    },
    formData: {},
  };

  const updatedPage = await logUtil.logPageFormDataDefaulting({
    platform: {
      name: 'acme',
      settings: [
        {
          id: 'logDefaults',
          items: [
            {
              id: 'callOutcomeDefault',
              defaultValue: 'Not Interested',
            },
            {
              id: 'followUpDefault',
              defaultValue: false,
            },
          ],
        },
      ],
      page: {
        callLog: {
          additionalFields: [
            {
              const: 'callOutcome',
              defaultSettingId: 'logDefaults',
              defaultSettingValues: {
                inboundCall: {
                  settingId: 'callOutcomeDefault',
                },
              },
            },
            {
              const: 'needsFollowUp',
              defaultSettingId: 'logDefaults',
              defaultSettingValues: {
                inboundCall: {
                  settingId: 'followUpDefault',
                },
              },
            },
          ],
        },
      },
    },
    targetPage,
    caseType: 'inboundCall',
    logType: 'callLog',
  });

  assert.deepEqual(updatedPage.formData, {
    callOutcome: 'interested',
    needsFollowUp: true,
  });
});

test('logUtil reports auto-log conflict when only new-contact placeholders are available', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const logUtil = await loadLogUtil({
    userCore: createUserCoreStub(),
  });

  const conflict = await logUtil.getLogConflictInfo({
    platform: {
      name: 'acme',
      page: {
        callLog: {
          additionalFields: [],
        },
      },
    },
    isAutoLog: true,
    contactInfo: [
      {
        id: 'newContact',
        isNewContact: true,
      },
    ],
    logType: 'callLog',
    direction: 'Inbound',
    isVoicemail: false,
  });

  assert.deepEqual(conflict, {
    hasConflict: true,
    autoSelectAdditionalSubmission: {},
    conflictType: 'Unknown contact',
  });
});

test('logUtil auto-selects additional submission defaults for matched contacts', async () => {
  const storage = createChromeStorage({
    userSettings: {
      dispositionDefault: {
        value: 'Connected',
      },
    },
  });
  global.chrome = storage.chrome;

  const logUtil = await loadLogUtil({
    userCore: createUserCoreStub(),
  });

  const conflict = await logUtil.getLogConflictInfo({
    platform: {
      name: 'acme',
      settings: [
        {
          id: 'logDefaults',
          items: [
            {
              id: 'dispositionDefault',
              defaultValue: 'Left Voicemail',
            },
          ],
        },
      ],
      page: {
        callLog: {
          additionalFields: [
            {
              const: 'disposition',
              defaultSettingId: 'logDefaults',
              defaultSettingValues: {
                outboundCall: {
                  settingId: 'dispositionDefault',
                },
              },
            },
          ],
        },
      },
    },
    isAutoLog: true,
    contactInfo: [
      {
        id: 'contact-1',
        additionalInfo: {
          disposition: [
            {
              const: 'connected',
              title: 'Connected',
            },
            {
              const: 'voicemail',
              title: 'Left Voicemail',
            },
          ],
        },
      },
    ],
    logType: 'callLog',
    direction: 'Outbound',
    isVoicemail: false,
  });

  assert.deepEqual(conflict, {
    hasConflict: false,
    autoSelectAdditionalSubmission: {
      disposition: 'connected',
    },
    conflictType: 'No conflict',
  });
});

test('logUtil removes only the matching pending recording session id', async () => {
  const storage = createChromeStorage({
    pendingRecordings: ['session-1', 'session-2', 'session-3'],
  });
  global.chrome = storage.chrome;

  const logUtil = await loadLogUtil();

  await logUtil.removePendingRecordingSessionId({
    sessionId: 'session-2',
  });

  assert.deepEqual(storage.store.pendingRecordings, ['session-1', 'session-3']);
});

test('logUtil adds pending recording session ids without duplicates', async () => {
  const storage = createChromeStorage({
    pendingRecordings: ['session-1'],
  });
  global.chrome = storage.chrome;

  const logUtil = await loadLogUtil();

  await logUtil.addPendingRecordingSessionId({
    sessionId: 'session-1',
  });
  await logUtil.addPendingRecordingSessionId({
    sessionId: 'session-2',
  });

  assert.deepEqual(storage.store.pendingRecordings, ['session-1', 'session-2']);
});

test('logUtil syncs available pending recordings and keeps unresolved sessions queued', async () => {
  const storage = createChromeStorage({
    pendingRecordings: ['session-ready', 'session-missing'],
  });
  global.chrome = storage.chrome;

  const syncCallDataCalls = [];
  global.RCAdapter = {
    async getCallLog({ sessionId }) {
      if (sessionId === 'session-ready') {
        return {
          call: {
            sessionId,
          },
        };
      }
      return null;
    },
  };

  const logUtil = await loadLogUtil({
    logService: {
      async syncCallData(args) {
        syncCallDataCalls.push(args);
      },
    },
  });

  await logUtil.triggerPendingRecordingCheck({
    serverUrl: 'https://server.example.com',
  });

  assert.deepEqual(syncCallDataCalls, [
    {
      serverUrl: 'https://server.example.com',
      dataBody: {
        call: {
          sessionId: 'session-ready',
        },
      },
    },
  ]);
  assert.deepEqual(storage.store.pendingRecordings, ['session-missing']);
});