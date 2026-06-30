const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installAdapterFrame(widgetMessages) {
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

test('call log form creates a new contact, logs the call, schedules callback, and updates disposition state', async () => {
  const storage = createChromeStorage({
    userSettings: {},
    rcUserInfo: {
      rcAccountId: 'rc-account-1',
    },
    implementedInterfaces: {
      upsertCallDisposition: true,
    },
    unloggedCallPageDataCache: [
      {
        sessionId: 'session-1',
      },
      {
        sessionId: 'session-2',
      },
    ],
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapterFrame(widgetMessages);

  const createContactCalls = [];
  const openContactPageCalls = [];
  const addLogCalls = [];
  const axiosPosts = [];
  const calldownPageCalls = [];
  const upsertDispositionCalls = [];
  const notifications = [];

  const logForm = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/logForm.js', {
    stubs: {
      '../../../core/contact': {
        async createContact(args) {
          createContactCalls.push(args);
          return {
            contactInfo: {
              id: 'new-contact-1',
              name: 'Ada Lovelace',
              type: 'Lead',
            },
            returnMessage: {
              messageType: 'success',
              message: 'Contact created',
              ttl: 3000,
              details: {
                id: 'new-contact-1',
              },
            },
          };
        },
        async openContactPage(args) {
          openContactPageCalls.push(args);
        },
      },
      '../../../core/user': {
        getopenContactPageAfterCreationSetting() {
          return {
            value: true,
          };
        },
        getOneTimeLogSetting() {
          return {
            value: false,
          };
        },
      },
      '../../../core/log': {
        async addLog(args) {
          addLogCalls.push(args);
        },
        async updateLog() {
          throw new Error('updateLog should not run for createLog form submission');
        },
      },
      '../../../components/calldownPage': {
        async getCalldownPageWithRecords(args) {
          calldownPageCalls.push(args);
          return {
            id: 'calldownPage',
            records: [
              {
                id: 'callback-1',
              },
            ],
          };
        },
      },
      '../../../lib/util': {
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
        showNotification(notification) {
          notifications.push(notification);
        },
      },
      axios: {
        async post(url, body) {
          axiosPosts.push({ url, body });
        },
      },
      '../../../core/disposition': {
        async upsertDisposition(args) {
          upsertDispositionCalls.push(args);
        },
      },
      '../../../components/logPage': {
        getUnloggedCallPageRender(args) {
          return {
            id: 'unloggedCallPage',
            unloggedCalls: args.unloggedCalls,
          };
        },
      },
    },
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        page: {
          callLog: {
            additionalFields: [
              {
                const: 'outcome',
              },
              {
                const: 'priority',
              },
            ],
          },
          newContact: {
            additionalFields: [
              {
                const: 'source',
              },
            ],
          },
        },
      },
    },
  };

  await logForm.onEvent({
    data: {
      body: {
        aiNote: 'AI summary',
        transcript: 'Call transcript',
        call: {
          sessionId: 'session-1',
          telephonySessionId: 'telephony-1',
          direction: 'Inbound',
          result: 'Disconnected',
          duration: 120,
          startTime: '2026-06-01T10:00:00.000Z',
          from: {
            phoneNumber: '+15550100',
          },
          to: {
            phoneNumber: '+15550101',
          },
        },
        formData: {
          triggerType: 'createLog',
          contact: 'createNewContact',
          newContactName: 'Ada Lovelace',
          newContactType: 'Lead',
          contactType: '',
          contactName: '',
          activityTitle: 'Inbound Call from Ada Lovelace',
          note: 'Discussed renewal',
          outcome: 'Interested',
          priority: 'none',
          source: 'Phone',
          scheduleCallback: true,
          callbackDateTime: '2026-07-01T10:00:00.000Z',
        },
      },
    },
    manifest,
    platformName: 'acme',
    contactPhoneNumber: '+15550100',
  });

  assert.deepEqual(createContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      newContactName: 'Ada Lovelace',
      newContactType: 'Lead',
      additionalSubmission: {
        outcome: 'Interested',
        source: 'Phone',
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Contact created',
      ttl: 3000,
      details: {
        id: 'new-contact-1',
      },
    },
  ]);
  assert.deepEqual(openContactPageCalls, [
    {
      manifest,
      platformName: 'acme',
      phoneNumber: '+15550100',
      contactId: 'new-contact-1',
      contactType: 'Lead',
    },
  ]);
  assert.deepEqual(addLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      logInfo: {
        sessionId: 'session-1',
        telephonySessionId: 'telephony-1',
        direction: 'Inbound',
        result: 'Disconnected',
        duration: 120,
        startTime: '2026-06-01T10:00:00.000Z',
        from: {
          phoneNumber: '+15550100',
        },
        to: {
          phoneNumber: '+15550101',
        },
      },
      isMain: true,
      note: 'Discussed renewal',
      aiNote: 'AI summary',
      transcript: 'Call transcript',
      subject: 'Inbound Call from Ada Lovelace',
      contactId: 'new-contact-1',
      contactType: 'Lead',
      contactName: 'Ada Lovelace',
      additionalSubmission: {
        outcome: 'Interested',
        source: 'Phone',
      },
    },
  ]);
  assert.deepEqual(axiosPosts, [
    {
      url: 'https://server.example.com/calldown?rcAccountId=rc-account-1',
      body: {
        contactId: 'new-contact-1',
        contactType: 'Lead',
        contactName: 'Ada Lovelace',
        phoneNumber: '+15550100',
        scheduledAt: '2026-07-01T10:00:00.000Z',
        note: 'Discussed renewal',
      },
    },
  ]);
  assert.deepEqual(calldownPageCalls, [
    {
      manifest,
      filterStatus: 'All',
      userSettings: {},
    },
  ]);
  assert.deepEqual(upsertDispositionCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      sessionId: 'session-1',
      dispositions: {
        outcome: 'Interested',
        source: 'Phone',
        note: 'Discussed renewal',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          records: [
            {
              id: 'callback-1',
            },
          ],
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'unloggedCallPage',
          unloggedCalls: [
            {
              sessionId: 'session-2',
            },
          ],
        },
      },
      targetOrigin: undefined,
    },
  ]);
  assert.deepEqual(storage.store.unloggedCallPageDataCache, [
    {
      sessionId: 'session-2',
    },
  ]);
});

test('call log form updates an existing call log and disposition without creating a contact', async () => {
  const storage = createChromeStorage({
    userSettings: {},
    implementedInterfaces: {
      upsertCallDisposition: true,
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapterFrame(widgetMessages);

  const updateLogCalls = [];
  const upsertDispositionCalls = [];

  const logForm = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/logForm.js', {
    stubs: {
      '../../../core/contact': {
        async createContact() {
          throw new Error('createContact should not run for editLog');
        },
        async openContactPage() {
          throw new Error('openContactPage should not run for editLog');
        },
      },
      '../../../core/user': {
        getOneTimeLogSetting() {
          return {
            value: false,
          };
        },
      },
      '../../../core/log': {
        async addLog() {
          throw new Error('addLog should not run for editLog');
        },
        async updateLog(args) {
          updateLogCalls.push(args);
        },
      },
      '../../../components/calldownPage': {},
      '../../../lib/util': {
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
        showNotification() {},
      },
      axios: {},
      '../../../core/disposition': {
        async upsertDisposition(args) {
          upsertDispositionCalls.push(args);
        },
      },
      '../../../components/logPage': {},
    },
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        page: {
          callLog: {
            additionalFields: [
              {
                const: 'outcome',
              },
            ],
          },
          newContact: {
            additionalFields: [],
          },
        },
      },
    },
  };

  await logForm.onEvent({
    data: {
      body: {
        aiNote: 'Updated AI summary',
        transcript: 'Updated transcript',
        call: {
          sessionId: 'session-3',
          telephonySessionId: 'telephony-3',
          direction: 'Outbound',
          result: 'Call connected',
          duration: 240,
          startTime: '2026-06-02T10:00:00.000Z',
          from: {
            phoneNumber: '+15550100',
          },
          to: {
            phoneNumber: '+15550102',
          },
        },
        formData: {
          triggerType: 'editLog',
          activityTitle: 'Updated outbound call',
          note: 'Updated notes',
          outcome: 'Won',
          contact: 'contact-1',
          newContactName: '',
          newContactType: '',
          contactType: 'Lead',
          contactName: 'Ada Lovelace',
        },
      },
    },
    manifest,
    platformName: 'acme',
    contactPhoneNumber: '+15550102',
  });

  assert.deepEqual(updateLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      telephonySessionId: 'telephony-3',
      sessionId: 'session-3',
      subject: 'Updated outbound call',
      note: 'Updated notes',
      aiNote: 'Updated AI summary',
      transcript: 'Updated transcript',
      startTime: '2026-06-02T10:00:00.000Z',
      duration: 240,
      result: 'Call connected',
      direction: 'Outbound',
      from: {
        phoneNumber: '+15550100',
      },
      to: {
        phoneNumber: '+15550102',
      },
      isShowNotification: true,
    },
  ]);
  assert.deepEqual(upsertDispositionCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      sessionId: 'session-3',
      dispositions: {
        outcome: 'Won',
        note: 'Updated notes',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, []);
});

