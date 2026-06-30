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

test('managed auth org submit saves account values and removes cleared stored fields', async () => {
  const storage = createChromeStorage({
    managedAuthSettings: {
      orgFields: [
        {
          const: 'clientId',
        },
        {
          const: 'clientSecret',
        },
        {
          const: 'tokenUrl',
        },
      ],
      orgValues: {
        clientSecret: {
          hasValue: true,
        },
        tokenUrl: {
          hasValue: true,
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const saveCalls = [];
  const notifications = [];

  const managedAuthOrgPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthOrgPage.js',
    {
      stubs: {
        '../../../../core/admin': {
          async saveManagedAuthSettings(args) {
            saveCalls.push(args);
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

  await managedAuthOrgPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            clientId: 'new-client-id',
            clientSecret: '',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(saveCalls, [
    {
      serverUrl: 'https://server.example.com',
      scope: 'account',
      values: {
        clientId: 'new-client-id',
      },
      fieldsToRemove: ['clientSecret', 'tokenUrl'],
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Account managed authentication updated.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(widgetMessages, [
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

test('managed auth user submit saves per-user values, updates cache, and refreshes the list page', async () => {
  const storage = createChromeStorage({
    managedAuthSettings: {
      userFields: [
        {
          const: 'apiKey',
        },
        {
          const: 'region',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'ext-1',
          rcUserName: 'Old Name',
          fields: {
            apiKey: {
              hasValue: true,
              value: 'old-key',
            },
            region: {
              hasValue: true,
              value: 'us',
            },
          },
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const saveCalls = [];
  const listPageCalls = [];
  const notifications = [];

  const managedAuthUserPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserPage.js',
    {
      stubs: {
        '../../../../core/admin': {
          async saveManagedAuthSettings(args) {
            saveCalls.push(args);
          },
        },
        '../../../../components/admin/managedAuthUserPage': {
          getManagedAuthUserPageRender(args) {
            listPageCalls.push(args);
            return {
              id: 'managedAuthUserPage',
              userCount: args.userValues.length,
              searchWord: args.searchWord,
              filter: args.filter,
            };
          },
        },
        '../../../../lib/util': {
          async getRcContactInfo() {
            return [
              {
                id: 'ext-1',
                type: 'User',
                firstName: 'Ada',
                lastName: 'Lovelace',
              },
              {
                id: 'ext-2',
                type: 'Department',
                name: 'Support Queue',
              },
              {
                id: 'site-1',
                type: 'Site',
                name: 'HQ',
              },
            ];
          },
          showNotification(notification) {
            notifications.push(notification);
          },
        },
      },
    }
  );

  await managedAuthUserPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            rcExtensionId: 'ext-1',
            apiKey: 'new-key',
            region: '',
            searchWord: 'Ada',
            filter: 'Configured',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(saveCalls, [
    {
      serverUrl: 'https://server.example.com',
      scope: 'user',
      rcExtensionId: 'ext-1',
      rcUserName: 'Ada Lovelace',
      values: {
        apiKey: 'new-key',
      },
      fieldsToRemove: ['region'],
      refreshAfterSave: false,
    },
  ]);
  assert.deepEqual(storage.store.managedAuthSettings.userValues, [
    {
      rcExtensionId: 'ext-1',
      rcUserName: 'Ada Lovelace',
      fields: {
        apiKey: {
          hasValue: true,
          value: 'new-key',
        },
      },
    },
  ]);
  assert.equal(listPageCalls.length, 1);
  assert.deepEqual(listPageCalls[0].rcExtensions.map((item) => item.id), ['ext-1', 'ext-2']);
  assert.equal(listPageCalls[0].searchWord, 'Ada');
  assert.equal(listPageCalls[0].filter, 'Configured');
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'managedAuthUserPage',
          userCount: 1,
          searchWord: 'Ada',
          filter: 'Configured',
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
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'User managed authentication updated.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('server-side logging submit enables logging, uploads admin settings, refreshes service manifest, and navigates back', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        serverSideLogging: {
          enable: false,
          loggingLevel: 'Disable',
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const responses = [];
  const refreshCalls = [];
  const uploadAdminSettingsCalls = [];
  const enableServerSideLoggingCalls = [];
  const uploadAdditionalFieldCalls = [];
  const notifications = [];

  const saveServerSideLogging = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/saveServerSideLogging.js',
    {
      stubs: {
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadAdminSettingsCalls.push(args);
          },
          async enableServerSideLogging(args) {
            enableServerSideLoggingCalls.push(args);
          },
          async disableServerSideLogging() {
            throw new Error('disableServerSideLogging should not run when enabling server-side logging');
          },
          async uploadServerSideLoggingAdditionalFieldValues(args) {
            uploadAdditionalFieldCalls.push(args);
            return {
              successful: true,
            };
          },
        },
        '../../../../core/user': {
          async refreshUserSettings(args) {
            refreshCalls.push(args);
            return {
              userSettings: {
                serverSideLogging: args.changedSettings.serverSideLogging,
              },
            };
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../service/embeddableServices': {
          async getServiceManifest() {
            return {
              name: 'acme',
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'acme',
  };
  const formData = {
    serverSideLoggingHolder: {
      serverSideLogging: 'All',
      activityRecordOwner: 'admin',
      sources: ['Calls', 'SMS'],
    },
    doNotLogNumbersHolder: {
      doNotLogNumbers: '+15550100',
    },
  };

  await saveServerSideLogging.onEvent({
    data: {
      requestId: 'req-save-sscl',
      body: {
        button: {
          formData,
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform,
    responseMessage(requestId, payload) {
      responses.push({ requestId, payload });
    },
  });

  assert.deepEqual(responses, [
    {
      requestId: 'req-save-sscl',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        serverSideLogging: {
          enable: true,
          loggingLevel: 'All',
        },
      },
    },
  ]);
  assert.deepEqual(uploadAdminSettingsCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userSettings: {
          serverSideLogging: {
            enable: true,
            loggingLevel: 'All',
          },
        },
      },
    },
  ]);
  assert.deepEqual(enableServerSideLoggingCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      subscriptionLevel: 'All',
      loggingByAdmin: true,
      sources: ['Calls', 'SMS'],
    },
  ]);
  assert.deepEqual(uploadAdditionalFieldCalls, [
    {
      platform,
      formData,
    },
  ]);
  assert.deepEqual(storage.store.adminSettings.userSettings.serverSideLogging, {
    enable: true,
    loggingLevel: 'All',
  });
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: {
          name: 'acme',
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
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Server side logging do not log numbers updated.',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
