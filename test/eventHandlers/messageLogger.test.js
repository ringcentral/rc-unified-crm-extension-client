const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

const messageLoggerBaseStubs = {
  '../../../core/user': {},
  '../../../core/log': {
    async addLog() {
      throw new Error('addLog should not be called for blocked extension numbers');
    },
    getConflictContentFromUnresolvedLog() {
      throw new Error('getConflictContentFromUnresolvedLog should not be called for blocked extension numbers');
    },
  },
  '../../../core/contact': {
    async getContact() {
      throw new Error('getContact should not be called for blocked extension numbers');
    },
    async createContact() {
      throw new Error('createContact should not be called for blocked extension numbers');
    },
    async openContactPage() {
      throw new Error('openContactPage should not be called for blocked extension numbers');
    },
  },
  '../../../lib/logUtil': {},
  moment: () => ({
    format() {
      return '01/01/2026';
    },
  }),
  '../../../components/logPage': {},
  '../../../components/groupLogPage': {},
};

test('/messageLogger blocks extension number logging and responds to the widget', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const notifications = [];
  const responses = [];

  const messageLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/index.js', {
    stubs: {
      ...messageLoggerBaseStubs,
      '../../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  await messageLogger.onEvent({
    data: {
      requestId: 'req-message-extension',
      body: {
        triggerType: 'auto',
        conversation: {
          conversationId: 'conversation-1',
          conversationLogId: 'conversation-log-1',
          type: 'SMS',
          correspondents: [
            {
              extensionNumber: '101',
            },
          ],
          messages: [],
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(responses, [
    {
      requestId: 'req-message-extension',
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
  assert.equal(storage.store.autoPopupMainConverastionId, 'conversation-1');
});

test('/messageLogger auto-logs with cached conversation preference without contact matching', async () => {
  const conversation = {
    conversationId: 'conversation-2',
    conversationLogId: 'conversation-log-2',
    type: 'SMS',
    correspondents: [
      {
        phoneNumber: '+15550100',
      },
    ],
    messages: [
      {
        creationTime: '2026-06-01T00:00:00Z',
        attachments: [],
      },
    ],
  };
  const storage = createChromeStorage({
    userSettings: {},
    'rc-crm-conversation-pref-conversation-log-2': {
      contact: {
        id: 'contact-1',
        type: 'Lead',
        name: 'Ada Lovelace',
      },
      additionalSubmission: {
        source: 'cached-pref',
      },
    },
  });
  global.chrome = storage.chrome;

  const addLogCalls = [];
  const responses = [];

  const messageLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/index.js', {
    stubs: {
      ...messageLoggerBaseStubs,
      '../../../core/user': {
        getSMSPopSetting() {
          return { value: false };
        },
      },
      '../../../core/log': {
        async addLog(args) {
          addLogCalls.push(args);
        },
        getConflictContentFromUnresolvedLog() {
          throw new Error('conflict content should not be needed when cached preference is used and auto SMS is off');
        },
      },
      '../../../core/contact': {
        async getContact() {
          throw new Error('getContact should not be called when cached conversation preference exists');
        },
        async createContact() {
          throw new Error('createContact should not be called when cached conversation preference exists');
        },
        async openContactPage() {
          throw new Error('openContactPage should not be called when cached conversation preference exists');
        },
      },
      '../../../lib/util': {
        showNotification() {},
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  await messageLogger.onEvent({
    data: {
      requestId: 'req-message-pref',
      body: {
        triggerType: 'auto',
        conversation,
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(addLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Message',
      logInfo: conversation,
      isMain: true,
      note: '',
      additionalSubmission: {
        source: 'cached-pref',
      },
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Ada Lovelace',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-message-pref',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('/messageLogger warns and skips auto logging for group SMS', async () => {
  const storage = createChromeStorage({
    userSettings: {
      autoLogSMS: {
        value: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const notifications = [];
  const responses = [];

  const messageLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/index.js', {
    stubs: {
      ...messageLoggerBaseStubs,
      '../../../core/user': {
        getSMSPopSetting() {
          return { value: false };
        },
      },
      '../../../core/log': {
        async addLog() {
          throw new Error('addLog should not run for group SMS auto log');
        },
        getConflictContentFromUnresolvedLog() {
          throw new Error('conflict content should not be needed for group SMS auto log skip');
        },
      },
      '../../../core/contact': {
        async getContact() {
          throw new Error('getContact should not run for group SMS auto log skip');
        },
        async createContact() {
          throw new Error('createContact should not run for group SMS auto log skip');
        },
        async openContactPage() {
          throw new Error('openContactPage should not run for group SMS auto log skip');
        },
      },
      '../../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  await messageLogger.onEvent({
    data: {
      requestId: 'req-group-sms-auto',
      body: {
        triggerType: 'auto',
        conversation: {
          conversationId: 'conversation-group-1',
          conversationLogId: 'conversation-log-group-1',
          type: 'SMS',
          correspondents: [
            {
              phoneNumber: '+15550100',
            },
            {
              phoneNumber: '+15550101',
            },
          ],
          messages: [
            {
              creationTime: '2026-06-01T00:00:00Z',
            },
          ],
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Group SMS is not supported for auto log. Please log manually.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-group-sms-auto',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.equal(storage.store.autoPopupMainConverastionId, 'conversation-group-1');
});

test('/messageLogger manual form creates a new contact before logging the message', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const createContactCalls = [];
  const openContactPageCalls = [];
  const addLogCalls = [];
  const responses = [];

  const messageLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/index.js', {
    stubs: {
      ...messageLoggerBaseStubs,
      '../../../core/user': {
        getSMSPopSetting() {
          return { value: false };
        },
        getopenContactPageAfterCreationSetting() {
          return { value: true };
        },
      },
      '../../../core/log': {
        async addLog(args) {
          addLogCalls.push(args);
        },
        getConflictContentFromUnresolvedLog() {
          throw new Error('conflict content should not be needed for manual message log form submit');
        },
      },
      '../../../core/contact': {
        async getContact() {
          throw new Error('getContact should not run for direct manual form submit');
        },
        async createContact(args) {
          createContactCalls.push(args);
          return {
            contactInfo: {
              id: 'new-contact-1',
              name: 'Ada Lovelace',
              type: 'Lead',
            },
          };
        },
        async openContactPage(args) {
          openContactPageCalls.push(args);
        },
      },
      '../../../lib/util': {
        showNotification() {},
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  const conversation = {
    conversationId: 'conversation-manual-1',
    conversationLogId: 'conversation-log-manual-1',
    type: 'SMS',
    correspondents: [
      {
        phoneNumber: '+15550100',
      },
    ],
    messages: [
      {
        creationTime: '2026-06-01T00:00:00Z',
      },
    ],
  };
  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        page: {
          messageLog: {
            additionalFields: [
              {
                const: 'messageOutcome',
              },
            ],
          },
          newContact: {
            additionalFields: [
              {
                const: 'leadSource',
              },
            ],
          },
        },
      },
    },
  };

  await messageLogger.onEvent({
    data: {
      requestId: 'req-message-manual',
      body: {
        triggerType: 'logForm',
        redirect: true,
        conversation,
        formData: {
          contact: 'createNewContact',
          newContactName: 'Ada Lovelace',
          newContactType: 'Lead',
          contactType: '',
          contactName: '',
          messageOutcome: 'Interested',
          leadSource: 'SMS',
        },
      },
    },
    manifest,
    platformName: 'acme',
  });

  assert.deepEqual(createContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      newContactName: 'Ada Lovelace',
      newContactType: 'Lead',
      additionalSubmission: {
        messageOutcome: 'Interested',
        leadSource: 'SMS',
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
      logType: 'Message',
      logInfo: conversation,
      isMain: true,
      note: '',
      additionalSubmission: {
        messageOutcome: 'Interested',
        leadSource: 'SMS',
      },
      contactId: 'new-contact-1',
      contactType: 'Lead',
      contactName: 'Ada Lovelace',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-message-manual',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('/messageLogger opens group message log page with matched correspondents', async () => {
  const storage = createChromeStorage({
    userSettings: {},
    implementedInterfaces: {
      findContactWithName: true,
    },
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

  const getContactCalls = [];
  const cacheLogPageDataCalls = [];
  const groupLogPageCalls = [];
  const defaultingCalls = [];
  const responses = [];

  const messageLogger = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/index.js', {
    stubs: {
      ...messageLoggerBaseStubs,
      '../../../core/user': {
        getSMSPopSetting() {
          return { value: false };
        },
      },
      '../../../core/log': {
        async addLog() {
          throw new Error('addLog should not run when opening manual group message log page');
        },
        getConflictContentFromUnresolvedLog() {
          throw new Error('conflict content should not be needed when opening manual group message log page');
        },
      },
      '../../../core/contact': {
        async getContact(args) {
          getContactCalls.push(args);
          return {
            contactInfo: [
              {
                id: `contact-${args.phoneNumber.slice(-2)}`,
                name: `Contact ${args.phoneNumber.slice(-2)}`,
                type: 'Lead',
              },
            ],
          };
        },
        async createContact() {
          throw new Error('createContact should not run when opening manual group message log page');
        },
        async openContactPage() {
          throw new Error('openContactPage should not run when opening manual group message log page');
        },
      },
      '../../../lib/logUtil': {
        async cacheLogPageData(args) {
          cacheLogPageDataCalls.push(args);
        },
        async logPageFormDataDefaulting(args) {
          defaultingCalls.push(args);
          return {
            ...args.targetPage,
            defaulted: args.caseType,
          };
        },
      },
      '../../../components/groupLogPage': {
        getGroupLogPageRender(args) {
          groupLogPageCalls.push(args);
          return {
            id: 'groupMessageLogPage',
            correspondentsData: args.correspondentsData,
            useContactSearch: args.useContactSearch,
          };
        },
      },
      '../../../components/logPage': {},
      '../../../lib/util': {
        showNotification() {},
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  const conversation = {
    conversationId: 'conversation-group-manual-1',
    conversationLogId: 'conversation-log-group-manual-1',
    type: 'SMS',
    correspondents: [
      {
        phoneNumber: '+15550100',
      },
      {
        phoneNumber: '+15550101',
      },
    ],
    messages: [
      {
        creationTime: '2026-06-01T00:00:00Z',
      },
    ],
  };
  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {},
    },
  };
  const platform = {
    name: 'acme',
  };

  await messageLogger.onEvent({
    data: {
      requestId: 'req-group-message-open',
      body: {
        triggerType: 'manual',
        redirect: true,
        conversation,
      },
    },
    manifest,
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(getContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      platformName: 'acme',
    },
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550101',
      platformName: 'acme',
    },
  ]);
  const expectedCorrespondentsData = {
    '+15550100': [
      {
        id: 'contact-00',
        name: 'Contact 00',
        type: 'Lead',
      },
    ],
    '+15550101': [
      {
        id: 'contact-01',
        name: 'Contact 01',
        type: 'Lead',
      },
    ],
  };
  assert.deepEqual(cacheLogPageDataCalls, [
    {
      id: 'conversation-group-manual-1',
      manifest,
      logType: 'Message',
      triggerType: 'manual',
      platformName: 'acme',
      direction: '',
      contactInfo: [],
      getContactMatchResult: expectedCorrespondentsData,
    },
  ]);
  assert.deepEqual(groupLogPageCalls, [
    {
      id: 'conversation-group-manual-1',
      manifest,
      platformName: 'acme',
      correspondentsData: expectedCorrespondentsData,
      useContactSearch: true,
    },
  ]);
  assert.deepEqual(defaultingCalls, [
    {
      platform,
      targetPage: {
        id: 'groupMessageLogPage',
        correspondentsData: expectedCorrespondentsData,
        useContactSearch: true,
      },
      caseType: 'message',
      logType: 'messageLog',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-messages-log-page',
        page: {
          id: 'groupMessageLogPage',
          correspondentsData: expectedCorrespondentsData,
          useContactSearch: true,
          defaulted: 'message',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/log/messages/conversation-group-manual-1',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-group-message-open',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

