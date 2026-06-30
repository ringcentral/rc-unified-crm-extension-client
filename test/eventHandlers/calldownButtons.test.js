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

test('call later blocks extension number scheduling and responds to the widget', async () => {
  const storage = createChromeStorage({});
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const notifications = [];
  const responses = [];

  const callLater = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLater.js',
    {
      stubs: {
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
        },
      },
    }
  );

  await callLater.onEvent({
    data: {
      requestId: 'req-call-later',
      body: {
        resource: {
          direction: 'Inbound',
          from: {
            extensionNumber: '101',
            phoneNumber: '+15550100',
          },
        },
      },
    },
  });

  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Extension numbers cannot be scheduled',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-call-later',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(runtimeMessages, []);
});

test('call later in contact uses a direct number when the selected phone is an extension', async () => {
  const runtimeMessages = [];
  global.chrome = {
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const callLaterInContact = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInContact.js'
  );

  await callLaterInContact.onEvent({
    data: {
      body: {
        resource: {
          phoneType: 'extension',
          phoneNumber: '101',
          phoneNumbers: [
            {
              phoneType: 'work',
              phoneNumber: '+15550100',
            },
            {
              phoneType: 'direct',
              phoneNumber: '+15550101',
            },
          ],
        },
      },
    },
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'c2schedule',
      phoneNumber: '+15550101',
    },
  ]);
});

test('calldown call action starts a widget call, marks the row called, and refreshes the filtered list', async () => {
  const storage = createChromeStorage({
    calldownListCache: [
      {
        id: 'callback-1',
        phoneNumber: '+15550100',
      },
    ],
    rcUserInfo: {
      rcAccountId: 'rc-account-1',
    },
    userSettings: {
      timezone: 'UTC',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const patchCalls = [];
  const pageCalls = [];

  const calldownActionCall = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionCall.js',
    {
      stubs: {
        axios: {
          async patch(url, body) {
            patchCalls.push({ url, body });
          },
        },
        '../../../../components/calldownPage': {
          async getCalldownPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'calldownPage',
              rows: [
                {
                  id: 'callback-1',
                },
              ],
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await calldownActionCall.onEvent({
    data: {
      body: {
        page: {
          formData: {
            searchWithFilters: {
              search: 'Ada',
              filter: 'Open',
            },
          },
        },
        button: {
          formData: {
            recordId: 'callback-1',
          },
        },
      },
    },
    manifest,
  });

  assert.deepEqual(widgetMessages[0], {
    message: {
      type: 'rc-adapter-new-call',
      phoneNumber: '+15550100',
      toCall: true,
    },
    targetOrigin: '*',
  });
  assert.equal(patchCalls[0].url, 'https://server.example.com/calldown/callback-1?rcAccountId=rc-account-1');
  assert.equal(patchCalls[0].body.status, 'called');
  assert.match(patchCalls[0].body.lastCallAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      filterStatus: 'Open',
      searchWithFilters: {
        search: 'Ada',
        filter: 'Open',
      },
      userSettings: {
        timezone: 'UTC',
      },
    },
  ]);
  assert.deepEqual(widgetMessages[1], {
    message: {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'calldownPage',
        rows: [
          {
            id: 'callback-1',
          },
        ],
      },
    },
    targetOrigin: '*',
  });
  assert.deepEqual(windowMessages, []);
});

test('calldown remove deletes the selected row and refreshes the current list in place', async () => {
  const storage = createChromeStorage({
    userSettings: {
      locale: 'en-US',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const deleteCalls = [];
  const pageCalls = [];

  const calldownActionRemove = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionRemove.js',
    {
      stubs: {
        axios: {
          async delete(url) {
            deleteCalls.push(url);
          },
        },
        '../../../../components/calldownPage': {
          async getCalldownPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'calldownPage',
              rows: [],
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await calldownActionRemove.onEvent({
    data: {
      body: {
        button: {
          formData: {
            records: 'callback-2',
            searchWithFilters: {
              search: 'Grace',
              filter: 'Overdue',
            },
          },
        },
      },
    },
    manifest,
  });

  assert.deepEqual(deleteCalls, ['https://server.example.com/calldown/callback-2']);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      searchWithFilters: {
        search: 'Grace',
        filter: 'Overdue',
      },
      filterStatus: 'Overdue',
      userSettings: {
        locale: 'en-US',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          rows: [],
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('schedule submit creates a new contact, creates a callback record, refreshes calldown, and navigates back', async () => {
  const storage = createChromeStorage({
    rcUserInfo: {
      rcAccountId: 'rc-account-1',
    },
    userSettings: {
      timezone: 'UTC',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const createContactCalls = [];
  const postCalls = [];
  const notifications = [];
  const cacheCalls = [];
  const pageCalls = [];

  const scheduleSubmit = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/scheduleSubmit.js',
    {
      stubs: {
        '../../../../core/contact': {
          async createContact(args) {
            createContactCalls.push(args);
            return {
              contactInfo: {
                id: 'crm-contact-1',
              },
            };
          },
        },
        axios: {
          async post(url, body) {
            postCalls.push({ url, body });
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
          async cacheCalldownContact(args) {
            cacheCalls.push(args);
          },
        },
        '../../../../components/calldownPage': {
          async getCalldownPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'calldownPage',
              rows: [
                {
                  id: 'callback-new',
                },
              ],
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      salesforce: {
        contactTypes: [
          {
            value: 'Lead',
          },
          {
            value: 'Contact',
          },
        ],
      },
    },
  };

  await scheduleSubmit.onEvent({
    data: {
      body: {
        button: {
          formData: {
            phone: '+15550100',
            callbackDateTime: '2026-07-01T10:30',
            note: 'Call back after demo',
            contact: 'newContact',
            newContactName: 'Ada Lovelace',
            newContactType: 'Lead',
          },
        },
      },
    },
    manifest,
    platformName: 'salesforce',
  });

  assert.deepEqual(createContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      newContactName: 'Ada Lovelace',
      newContactType: 'Lead',
      additionalSubmission: {},
    },
  ]);
  assert.deepEqual(postCalls, [
    {
      url: 'https://server.example.com/calldown?rcAccountId=rc-account-1',
      body: {
        phoneNumber: '+15550100',
        scheduledAt: '2026-07-01T10:30',
        contactId: 'crm-contact-1',
        contactType: 'Lead',
        note: 'Call back after demo',
      },
    },
  ]);
  assert.deepEqual(cacheCalls, [
    {
      contactId: 'crm-contact-1',
      contactName: 'Ada Lovelace',
      phoneNumber: '+15550100',
      contactType: 'Lead',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Contact created',
      ttl: 3000,
    },
    {
      level: 'success',
      message: 'Added to Call Back list',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      filterStatus: 'All',
      userSettings: {
        timezone: 'UTC',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-contact-match',
        phoneNumbers: ['+15550100'],
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          rows: [
            {
              id: 'callback-new',
            },
          ],
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('calldown complete marks the row called with account scope and refreshes the filtered list', async () => {
  const storage = createChromeStorage({
    rcUserInfo: {
      rcAccountId: 'rc-account-1',
    },
    userSettings: {
      theme: 'light',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const patchCalls = [];
  const pageCalls = [];

  const calldownActionComplete = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionComplete.js',
    {
      stubs: {
        axios: {
          async patch(url, body) {
            patchCalls.push({ url, body });
          },
        },
        '../../../../components/calldownPage': {
          async getCalldownPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'calldownPage',
              rows: [
                {
                  id: 'callback-3',
                  status: 'called',
                },
              ],
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await calldownActionComplete.onEvent({
    data: {
      body: {
        button: {
          formData: {
            recordId: 'callback-3',
            searchWithFilters: {
              search: 'Lin',
              filter: 'Today',
            },
          },
        },
      },
    },
    manifest,
  });

  assert.equal(patchCalls[0].url, 'https://server.example.com/calldown/callback-3?rcAccountId=rc-account-1');
  assert.equal(patchCalls[0].body.status, 'called');
  assert.match(patchCalls[0].body.lastCallAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      searchWithFilters: {
        search: 'Lin',
        filter: 'Today',
      },
      filterStatus: 'Today',
      userSettings: {
        theme: 'light',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          rows: [
            {
              id: 'callback-3',
              status: 'called',
            },
          ],
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('calldown edit builds an edit schedule page from the cached row and selected contact', async () => {
  const storage = createChromeStorage({
    calldownListCache: [
      {
        id: 'callback-4',
        phoneNumber: '+15550144',
        scheduledAt: '2026-07-02T12:45:00.000Z',
        contactId: 'crm-contact-4',
        contactType: 'Lead',
        contactName: 'Katherine Johnson',
      },
    ],
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const getContactCalls = [];
  const schedulePageCalls = [];

  const calldownActionEdit = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionEdit.js',
    {
      stubs: {
        '../../../../core/contact': {
          async getContact(args) {
            getContactCalls.push(args);
            return {
              matched: true,
              contactInfo: [
                {
                  id: 'crm-contact-4',
                  name: 'Katherine Johnson',
                  type: 'Lead',
                },
                {
                  id: 'new-contact-placeholder',
                  isNewContact: true,
                },
              ],
            };
          },
        },
        '../../../../components/schedulePage': {
          getSchedulePageRender(args) {
            schedulePageCalls.push(args);
            return {
              id: 'schedulePage',
              title: 'Schedule call',
              schema: {
                properties: {
                  scheduleSubmit: {
                    title: 'Schedule',
                  },
                },
              },
              formData: {},
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      salesforce: {
        contactTypes: [
          {
            value: 'Lead',
          },
        ],
      },
    },
  };

  await calldownActionEdit.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest,
    platformName: 'salesforce',
    listButtonItemId: 'callback-4',
  });

  assert.deepEqual(getContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550144',
      platformName: 'salesforce',
      isForceRefresh: true,
      isToTriggerContactMatch: true,
    },
  ]);
  assert.deepEqual(schedulePageCalls, [
    {
      phoneNumber: '+15550144',
      listOneOf: [
        {
          const: 'crm-contact-4',
          title: 'Katherine Johnson',
        },
        {
          const: 'newContact',
          title: 'Create new contact',
        },
      ],
      isDefaultNew: false,
      preselect: 'crm-contact-4',
      contactTypes: [
        {
          value: 'Lead',
        },
      ],
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'schedulePage',
          title: 'Edit scheduled call',
          schema: {
            properties: {
              scheduleSubmit: {
                title: 'Update Schedule',
              },
            },
          },
          formData: {
            callbackDateTime: '2026-07-02T12:45',
            editingRecordId: 'callback-4',
          },
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/schedulePage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('call later in message schedules an outbound message recipient when to is a single object', async () => {
  const runtimeMessages = [];
  global.chrome = {
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const callLaterInMessage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInMessage.js'
  );

  await callLaterInMessage.onEvent({
    data: {
      body: {
        resource: {
          direction: 'Outbound',
          to: {
            phoneNumber: '+15550102',
          },
        },
      },
    },
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'c2schedule',
      phoneNumber: '+15550102',
    },
  ]);
});
