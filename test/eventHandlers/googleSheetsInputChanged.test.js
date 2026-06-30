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

test('Google Sheets user page input change re-renders with current user settings', async () => {
  const storage = createChromeStorage({
    userSettings: {
      googleSheetsName: 'Pipeline Calls',
      locale: 'en-US',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const updateCalls = [];

  const googleSheetsPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/googleSheetsPage.js',
    {
      stubs: {
        '../../../../../components/platformSpecific/googleSheetsPage': {
          getUpdatedGoogleSheetsPage(args) {
            updateCalls.push(args);
            return {
              id: 'googleSheetsPage',
              force: args.formData.forceGoogleSheets,
              sheetName: args.userSettings.googleSheetsName,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const page = {
    id: 'googleSheetsPage',
  };
  const formData = {
    forceGoogleSheets: true,
  };

  await googleSheetsPage.onEvent({
    data: {
      body: {
        page,
        formData,
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(updateCalls, [
    {
      page,
      formData,
      manifest,
      userSettings: {
        googleSheetsName: 'Pipeline Calls',
        locale: 'en-US',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'googleSheetsPage',
          force: true,
          sheetName: 'Pipeline Calls',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/googleSheetsPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('admin Google Sheets force toggle updates managed setting customization and uploads admin settings', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        googleSheetsName: {
          value: 'Team Calls',
          customizable: true,
        },
        googleSheetsUrl: {
          value: 'https://sheets.example.com/team',
          customizable: true,
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const uploadCalls = [];
  const notifications = [];
  const updateCalls = [];

  const adminGoogleSheetsPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/adminGoogleSheetsPage.js',
    {
      stubs: {
        '../../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(args);
          },
        },
        '../../../../../core/user': {},
        '../../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../../components/admin/adminGoogleSheetsPage': {
          getUpdatedAdminGoogleSheetsPage(args) {
            updateCalls.push(args);
            return {
              id: 'adminGoogleSheetsPage',
              forceGoogleSheets: args.formData.forceGoogleSheets,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const page = {
    id: 'adminGoogleSheetsPage',
  };
  const formData = {
    forceGoogleSheets: {
      customizable: false,
    },
  };

  await adminGoogleSheetsPage.onEvent({
    data: {
      body: {
        keys: ['forceGoogleSheets'],
        page,
        formData,
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  const expectedAdminSettings = {
    userSettings: {
      googleSheetsName: {
        value: 'Team Calls',
        customizable: false,
      },
      googleSheetsUrl: {
        value: 'https://sheets.example.com/team',
        customizable: false,
      },
    },
  };
  assert.deepEqual(storage.store.adminSettings, expectedAdminSettings);
  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: expectedAdminSettings,
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Google Sheets setting enforced for all users',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(updateCalls, [
    {
      page,
      formData,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminGoogleSheetsPage',
          forceGoogleSheets: {
            customizable: false,
          },
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/adminGoogleSheetsPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
