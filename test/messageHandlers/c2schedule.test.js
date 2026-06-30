const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages, listeners) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
    addEventListener(eventName, listener) {
      listeners.push({ eventName, listener });
    },
    removeEventListener() {},
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

test('c2schedule opens a schedule page with matched contacts and a new-contact option', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  const listeners = [];
  const responses = [];
  installWindowAndAdapter(windowMessages, widgetMessages, listeners);

  const getContactCalls = [];
  const schedulePageCalls = [];
  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        contactTypes: [
          {
            value: 'Lead',
            display: 'Lead',
          },
        ],
      },
    },
  };

  const c2schedule = await loadBundledModule('src/messageHandlers/c2schedule.js', {
    stubs: {
      '../core/contact': {
        async getContact(args) {
          getContactCalls.push(args);
          return {
            contactInfo: [
              {
                id: 'contact-1',
                name: 'Ada Lovelace',
                type: 'Lead',
              },
              {
                id: 'new-contact-placeholder',
                name: 'Create new',
                isNewContact: true,
              },
            ],
          };
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
      '../components/schedulePage': {
        getSchedulePageRender(args) {
          schedulePageCalls.push(args);
          return {
            id: 'c2dSchedulePage',
            phoneNumber: args.phoneNumber,
            listOneOf: args.listOneOf,
            preselect: args.preselect,
            isDefaultNew: args.isDefaultNew,
            contactTypes: args.contactTypes,
          };
        },
      },
      axios: {
        async post() {
          throw new Error('c2schedule should not create a calldown record until the schedule page is submitted');
        },
      },
      '../components/calldownPage': {},
      '../lib/util': {
        async cacheCalldownContact() {},
      },
    },
  });

  await c2schedule.onMessage({
    request: {
      phoneNumber: '+15550100',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(getContactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      platformName: 'acme',
      isForceRefresh: true,
      isToTriggerContactMatch: true,
    },
  ]);
  assert.deepEqual(schedulePageCalls, [
    {
      phoneNumber: '+15550100',
      listOneOf: [
        {
          const: 'contact-1',
          title: 'Ada Lovelace',
        },
        {
          const: 'newContact',
          title: 'Create new contact',
        },
      ],
      isDefaultNew: false,
      preselect: 'contact-1',
      contactTypes: [
        {
          value: 'Lead',
          display: 'Lead',
        },
      ],
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'c2dSchedulePage',
          phoneNumber: '+15550100',
          listOneOf: [
            {
              const: 'contact-1',
              title: 'Ada Lovelace',
            },
            {
              const: 'newContact',
              title: 'Create new contact',
            },
          ],
          preselect: 'contact-1',
          isDefaultNew: false,
          contactTypes: [
            {
              value: 'Lead',
              display: 'Lead',
            },
          ],
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/c2dSchedulePage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-on',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].eventName, 'message');
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
});

test('c2schedule submission creates a calldown record and refreshes the calldown page', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  const listeners = [];
  const removedListeners = [];
  const responses = [];

  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
    addEventListener(eventName, listener) {
      listeners.push({ eventName, listener });
    },
    removeEventListener(eventName, listener) {
      removedListeners.push({ eventName, listener });
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
  global.chrome = {
    storage: {
      local: {
        async get(key) {
          if (key === 'rcUserInfo') {
            return {
              rcUserInfo: {
                rcAccountId: 'rc-account-1',
              },
            };
          }
          if (key === 'userSettings') {
            return {
              userSettings: {
                showCalldownTab: {
                  value: true,
                },
              },
            };
          }
          return {};
        },
      },
    },
  };

  const axiosPosts = [];
  const cachedContacts = [];
  const calldownPageCalls = [];
  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        contactTypes: [],
      },
    },
  };

  const c2schedule = await loadBundledModule('src/messageHandlers/c2schedule.js', {
    stubs: {
      '../core/contact': {
        async getContact() {
          return {
            contactInfo: [
              {
                id: 'contact-1',
                name: 'Ada Lovelace',
                type: 'Lead',
              },
            ],
          };
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
      '../components/schedulePage': {
        getSchedulePageRender() {
          return {
            id: 'c2dSchedulePage',
          };
        },
      },
      axios: {
        async post(url, body) {
          axiosPosts.push({ url, body });
        },
      },
      '../components/calldownPage': {
        async getCalldownPageWithRecords(args) {
          calldownPageCalls.push(args);
          return {
            id: 'calldownPage',
            records: [
              {
                id: 'calldown-1',
              },
            ],
          };
        },
      },
      '../lib/util': {
        async cacheCalldownContact(args) {
          cachedContacts.push(args);
        },
      },
    },
  });

  await c2schedule.onMessage({
    request: {
      phoneNumber: '+15550100',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.equal(listeners.length, 1);
  await listeners[0].listener({
    data: {
      type: 'rc-post-message-request',
      path: '/custom-button-click',
      requestId: 'req-schedule-submit',
      body: {
        page: {
          id: 'c2dSchedulePage',
        },
        formData: {
          phone: '+15550100',
          contact: 'contact-1',
          callbackDateTime: '2026-07-01T10:00:00.000Z',
          note: 'Call back after demo',
        },
      },
    },
  });

  assert.deepEqual(axiosPosts, [
    {
      url: 'https://server.example.com/calldown?rcAccountId=rc-account-1',
      body: {
        phoneNumber: '+15550100',
        scheduledAt: '2026-07-01T10:00:00.000Z',
        contactId: 'contact-1',
        note: 'Call back after demo',
      },
    },
  ]);
  assert.deepEqual(cachedContacts, [
    {
      contactId: 'contact-1',
      contactName: 'Ada Lovelace',
      phoneNumber: '+15550100',
      contactType: 'Lead',
    },
  ]);
  assert.deepEqual(calldownPageCalls, [
    {
      manifest,
      filterStatus: 'All',
      userSettings: {
        showCalldownTab: {
          value: true,
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages.slice(2), [
    {
      message: {
        type: 'rc-post-message-response',
        responseId: 'req-schedule-submit',
        response: {
          data: 'ok',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          records: [
            {
              id: 'calldown-1',
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
  assert.deepEqual(removedListeners, [
    {
      eventName: 'message',
      listener: listeners[0].listener,
    },
  ]);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
