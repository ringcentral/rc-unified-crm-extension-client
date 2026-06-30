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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createUserMapping(overrides = {}) {
  return {
    crmUser: {
      id: 'crm-user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    },
    rcUser: [
      {
        extensionId: 'rc-ext-1',
        name: 'Ada RC',
        extensionNumber: '101',
      },
    ],
    ...overrides,
  };
}

test('reinitialize user mapping calls admin API and reports success', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const reinitializeCalls = [];
  const notifications = [];

  const reinitializeUserMappingButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/reinitializeUserMappingButton.js',
    {
      stubs: {
        '../../../../core/admin': {
          async reinitializeUserMapping(args) {
            reinitializeCalls.push(args);
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
      },
    }
  );

  await reinitializeUserMappingButton.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(reinitializeCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'User mapping reinitialized.',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(widgetMessages, []);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('user mapping edit opens an edit page with mapped CRM user and RingCentral users/departments', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const rcContacts = [
    {
      id: 'rc-ext-1',
      type: 'User',
      name: 'Ada RC',
    },
    {
      id: 'rc-dept-1',
      type: 'Department',
      name: 'Support',
    },
    {
      id: 'company-contact-1',
      type: 'CompanyContact',
      name: 'Ignored Contact',
    },
  ];
  const pageCalls = [];

  const usermappingEdit = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingEdit.js',
    {
      stubs: {
        '../../../../lib/util': {
          async getRcContactInfo() {
            return rcContacts;
          },
        },
        '../../../../components/admin/userMappingPage/editUserMappingPage': {
          renderEditUserMappingPage(args) {
            pageCalls.push(args);
            return {
              id: 'editUserMappingPage',
              crmUserId: args.userMapping.crmUser.id,
              rcExtensionCount: args.rcExtensions.length,
            };
          },
        },
        '../../../../core/contact': {},
      },
    }
  );

  const mappingToEdit = createUserMapping();

  await usermappingEdit.onEvent({
    data: {
      body: {
        button: {
          formData: {
            allUserMapping: [
              createUserMapping({
                crmUser: {
                  id: 'crm-user-other',
                  name: 'Other',
                },
              }),
              mappingToEdit,
            ],
          },
        },
      },
    },
    platform: {
      displayName: 'Salesforce',
    },
    listButtonItemId: 'crm-user-1',
  });

  assert.deepEqual(pageCalls, [
    {
      userMapping: mappingToEdit,
      platformDisplayName: 'Salesforce',
      rcExtensions: [
        {
          id: 'rc-ext-1',
          type: 'User',
          name: 'Ada RC',
        },
        {
          id: 'rc-dept-1',
          type: 'Department',
          name: 'Support',
        },
      ],
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'editUserMappingPage',
          crmUserId: 'crm-user-1',
          rcExtensionCount: 2,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/editUserMappingPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('user mapping remove clears mapped RingCentral extensions, uploads admin settings, and refreshes the list page', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userMappings: [
        {
          crmUserId: 'crm-user-1',
          rcExtensionId: ['rc-ext-1'],
        },
        {
          crmUserId: 'crm-user-2',
          rcExtensionId: ['rc-ext-2'],
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const uploadCalls = [];
  const getMappingCalls = [];
  const pageCalls = [];
  const updatedMapping = [
    createUserMapping({
      crmUser: {
        id: 'crm-user-1',
        name: 'Ada Lovelace',
      },
      rcUser: [],
    }),
  ];

  const usermappingRemove = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingRemove.js',
    {
      stubs: {
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
          async getUserMapping(args) {
            getMappingCalls.push(args);
            return updatedMapping;
          },
        },
        '../../../../components/admin/userMappingPage/userMappingPage': {
          getUserMappingPageRender(args) {
            pageCalls.push(args);
            return {
              id: 'userMappingPage',
              rows: args.userMapping.length,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await usermappingRemove.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest,
    platform: {
      displayName: 'Salesforce',
    },
    listButtonItemId: 'crm-user-1',
  });

  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userMappings: [
          {
            crmUserId: 'crm-user-1',
            rcExtensionId: [],
          },
          {
            crmUserId: 'crm-user-2',
            rcExtensionId: ['rc-ext-2'],
          },
        ],
      },
    },
  ]);
  assert.deepEqual(getMappingCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      userMapping: updatedMapping,
      platformDisplayName: 'Salesforce',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'userMappingPage',
          rows: 1,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/userMappingPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('edit user mapping page updates an existing mapping and returns to the list', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userMappings: [
        {
          crmUserId: 'crm-user-1',
          rcExtensionId: ['rc-ext-1'],
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const uploadCalls = [];
  const pageCalls = [];
  const updatedMapping = [createUserMapping()];

  const editUserMappingPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.js',
    {
      stubs: {
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
          async getUserMapping() {
            return updatedMapping;
          },
        },
        '../../../../components/admin/userMappingPage/userMappingPage': {
          getUserMappingPageRender(args) {
            pageCalls.push(args);
            return {
              id: 'userMappingPage',
              rows: args.userMapping.length,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await editUserMappingPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            crmUserId: 'crm-user-1',
            rcExtensionList: ['rc-ext-2', 'rc-ext-3'],
          },
        },
      },
    },
    manifest,
    platform: {
      displayName: 'Salesforce',
    },
  });

  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userMappings: [
          {
            crmUserId: 'crm-user-1',
            rcExtensionId: ['rc-ext-2', 'rc-ext-3'],
          },
        ],
      },
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      userMapping: updatedMapping,
      platformDisplayName: 'Salesforce',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'userMappingPage',
          rows: 1,
        },
      },
      targetOrigin: undefined,
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

test('edit user mapping page removes an existing mapping when no RingCentral extensions are selected', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userMappings: [
        {
          crmUserId: 'crm-user-1',
          rcExtensionId: ['rc-ext-1'],
        },
        {
          crmUserId: 'crm-user-2',
          rcExtensionId: ['rc-ext-2'],
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const uploadCalls = [];

  const editUserMappingPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.js',
    {
      stubs: {
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
          async getUserMapping() {
            return [];
          },
        },
        '../../../../components/admin/userMappingPage/userMappingPage': {
          getUserMappingPageRender() {
            return {
              id: 'userMappingPage',
            };
          },
        },
      },
    }
  );

  await editUserMappingPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            crmUserId: 'crm-user-1',
            rcExtensionList: [],
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platform: {
      displayName: 'Salesforce',
    },
  });

  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userMappings: [
          {
            crmUserId: 'crm-user-2',
            rcExtensionId: ['rc-ext-2'],
          },
        ],
      },
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'userMappingPage',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: 'goBack',
    },
  ]);
});
