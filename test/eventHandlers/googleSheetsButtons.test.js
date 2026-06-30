const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages, openedWindows = []) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
    open(url, target) {
      openedWindows.push({ url, target });
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

test('select existing Google Sheet stores a pending user selection and opens the file picker', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  const openedWindows = [];
  installWindowAndAdapter(windowMessages, widgetMessages, openedWindows);

  const selectExistingSheetButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/selectExistingSheetButton.js'
  );

  await selectExistingSheetButton.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.equal(typeof storage.store.pendingUserGoogleSheetsSelection.timestamp, 'number');
  assert.deepEqual(openedWindows, [
    {
      url: 'https://server.example.com/googleSheets/filePicker?token=crm-jwt',
      target: '_blank',
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
  assert.deepEqual(windowMessages, []);
});

test('new Google Sheet creates a sheet, saves user settings, notifies success, and reopens the settings page', async () => {
  const storage = createChromeStorage({});
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const axiosPosts = [];
  const refreshCalls = [];
  const notifications = [];
  const pageCalls = [];

  const newSheetButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.js',
    {
      stubs: {
        axios: {
          async post(url, body) {
            axiosPosts.push({ url, body });
            return {
              status: 200,
              data: {
                name: 'Team Calls',
                url: 'https://sheets.example.com/team-calls',
              },
            };
          },
        },
        '../../../../core/user': {
          async refreshUserSettings(args) {
            refreshCalls.push(args);
            return {
              googleSheetsName: {
                value: 'Team Calls',
              },
              googleSheetsUrl: {
                value: 'https://sheets.example.com/team-calls',
              },
            };
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../components/platformSpecific/googleSheetsPage': {
          renderGoogleSheetsPage(args) {
            pageCalls.push(args);
            return {
              id: 'googleSheetsPage',
              sheetName: args.userSettings.googleSheetsName.value,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await newSheetButton.onEvent({
    data: {
      body: {
        button: {
          formData: {
            newSheetName: 'Team Calls',
          },
        },
      },
    },
    manifest,
  });

  assert.deepEqual(axiosPosts, [
    {
      url: 'https://server.example.com/googleSheets/sheet',
      body: {
        name: 'Team Calls',
      },
    },
  ]);
  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        googleSheetsName: {
          value: 'Team Calls',
        },
        googleSheetsUrl: {
          value: 'https://sheets.example.com/team-calls',
        },
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'New sheet created successfully',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      userSettings: {
        googleSheetsName: {
          value: 'Team Calls',
        },
        googleSheetsUrl: {
          value: 'https://sheets.example.com/team-calls',
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'googleSheetsPage',
          sheetName: 'Team Calls',
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
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('recent user Google Sheet selection saves the selected sheet, clears pending state, and re-renders the page', async () => {
  const storage = createChromeStorage({
    pendingUserGoogleSheetsSelection: {
      timestamp: Date.now() - 1000,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const refreshCalls = [];
  const notifications = [];
  const pageCalls = [];

  const userGoogleSheetSelected = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.js',
    {
      stubs: {
        '../../../../core/user': {
          async refreshUserSettings(args) {
            refreshCalls.push(args);
            return {
              googleSheetsName: {
                value: 'Selected Calls',
              },
              googleSheetsUrl: {
                value: 'https://sheets.example.com/selected',
              },
            };
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../components/platformSpecific/googleSheetsPage': {
          renderGoogleSheetsPage(args) {
            pageCalls.push(args);
            return {
              id: 'googleSheetsPage',
              sheetName: args.userSettings.googleSheetsName.value,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await userGoogleSheetSelected.onEvent({
    data: {
      body: {
        sheetName: 'Selected Calls',
        sheetUrl: 'https://sheets.example.com/selected',
      },
    },
    manifest,
  });

  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        googleSheetsName: {
          value: 'Selected Calls',
        },
        googleSheetsUrl: {
          value: 'https://sheets.example.com/selected',
        },
      },
    },
  ]);
  assert.equal(storage.store.pendingUserGoogleSheetsSelection, undefined);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Google Sheet "Selected Calls" selected successfully',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      userSettings: {
        googleSheetsName: {
          value: 'Selected Calls',
        },
        googleSheetsUrl: {
          value: 'https://sheets.example.com/selected',
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'googleSheetsPage',
          sheetName: 'Selected Calls',
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
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('admin select existing Google Sheet preserves managed state and opens the admin file picker', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  const openedWindows = [];
  installWindowAndAdapter(windowMessages, widgetMessages, openedWindows);

  const adminSelectExistingSheetButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminSelectExistingSheetButton.js',
    {
      stubs: {
        '../../../../lib/util': {
          getRcAccessToken() {
            return 'rc-token';
          },
        },
      },
    }
  );

  await adminSelectExistingSheetButton.onEvent({
    data: {
      body: {
        button: {
          formData: {
            forceGoogleSheets: {
              customizable: false,
            },
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.equal(storage.store.pendingAdminGoogleSheetsSelection.forceGoogleSheets, true);
  assert.equal(typeof storage.store.pendingAdminGoogleSheetsSelection.timestamp, 'number');
  assert.deepEqual(openedWindows, [
    {
      url: 'https://server.example.com/admin/googleSheets/filePicker?jwtToken=crm-jwt&rcAccessToken=rc-token',
      target: '_blank',
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
  assert.deepEqual(windowMessages, []);
});

test('admin Google Sheet selection saves managed admin settings, uploads them, and clears pending state', async () => {
  const adminSettings = {
    userSettings: {},
  };
  const storage = createChromeStorage({
    pendingAdminGoogleSheetsSelection: {
      forceGoogleSheets: true,
      timestamp: Date.now() - 1000,
    },
    adminSettings,
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const uploadCalls = [];
  const notifications = [];
  const pageCalls = [];

  const adminGoogleSheetSelected = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.js',
    {
      stubs: {
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
        },
        '../../../../core/user': {},
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../components/admin/adminGoogleSheetsPage': {
          renderAdminGoogleSheetsPage(args) {
            pageCalls.push(args);
            return {
              id: 'adminGoogleSheetsPage',
              sheetName: args.adminSettings.userSettings.googleSheetsName.value,
              customizable: args.adminSettings.userSettings.googleSheetsName.customizable,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await adminGoogleSheetSelected.onEvent({
    data: {
      body: {
        sheetName: 'Admin Calls',
        sheetUrl: 'https://sheets.example.com/admin',
      },
    },
    manifest,
  });

  assert.equal(storage.store.pendingAdminGoogleSheetsSelection, undefined);
  assert.deepEqual(storage.store.adminSettings.userSettings.googleSheetsName, {
    value: 'Admin Calls',
    customizable: false,
  });
  assert.deepEqual(storage.store.adminSettings.userSettings.googleSheetsUrl, {
    value: 'https://sheets.example.com/admin',
    customizable: false,
  });
  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userSettings: {
          googleSheetsName: {
            value: 'Admin Calls',
            customizable: false,
          },
          googleSheetsUrl: {
            value: 'https://sheets.example.com/admin',
            customizable: false,
          },
        },
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Admin Google Sheet "Admin Calls" selected successfully and enforced for all users',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      adminSettings: {
        userSettings: {
          googleSheetsName: {
            value: 'Admin Calls',
            customizable: false,
          },
          googleSheetsUrl: {
            value: 'https://sheets.example.com/admin',
            customizable: false,
          },
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminGoogleSheetsPage',
          sheetName: 'Admin Calls',
          customizable: false,
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

test('admin remove Google Sheet clears admin and user settings then re-renders admin page', async () => {
  const adminSettings = {
    userSettings: {
      googleSheetsName: {
        value: 'Admin Calls',
        customizable: false,
      },
      googleSheetsUrl: {
        value: 'https://sheets.example.com/admin',
        customizable: false,
      },
    },
  };
  const storage = createChromeStorage({
    adminSettings,
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const uploadCalls = [];
  const refreshCalls = [];
  const notifications = [];
  const pageCalls = [];

  const adminRemoveSheetButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminRemoveSheetButton.js',
    {
      stubs: {
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
        },
        '../../../../core/user': {
          async refreshUserSettings(args) {
            refreshCalls.push(args);
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../components/admin/adminGoogleSheetsPage': {
          renderAdminGoogleSheetsPage(args) {
            pageCalls.push(args);
            return {
              id: 'adminGoogleSheetsPage',
              sheetName: args.adminSettings.userSettings.googleSheetsName.value,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await adminRemoveSheetButton.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest,
  });

  assert.deepEqual(storage.store.adminSettings.userSettings.googleSheetsName, {
    value: '',
    customizable: true,
  });
  assert.deepEqual(storage.store.adminSettings.userSettings.googleSheetsUrl, {
    value: '',
    customizable: true,
  });
  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userSettings: {
          googleSheetsName: {
            value: '',
            customizable: true,
          },
          googleSheetsUrl: {
            value: '',
            customizable: true,
          },
        },
      },
    },
  ]);
  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        googleSheetsName: {
          value: '',
        },
        googleSheetsUrl: {
          value: '',
        },
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Admin Google Sheet removed successfully',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      adminSettings: {
        userSettings: {
          googleSheetsName: {
            value: '',
            customizable: true,
          },
          googleSheetsUrl: {
            value: '',
            customizable: true,
          },
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminGoogleSheetsPage',
          sheetName: '',
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

test('remove user Google Sheet clears user settings and reopens the Google Sheets page', async () => {
  const storage = createChromeStorage({});
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const refreshCalls = [];
  const pageCalls = [];

  const removeSheetButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/removeSheetButton.js',
    {
      stubs: {
        '../../../../core/user': {
          async refreshUserSettings(args) {
            refreshCalls.push(args);
            return {
              googleSheetsName: {
                value: '',
              },
              googleSheetsUrl: {
                value: '',
              },
            };
          },
        },
        '../../../../components/platformSpecific/googleSheetsPage': {
          renderGoogleSheetsPage(args) {
            pageCalls.push(args);
            return {
              id: 'googleSheetsPage',
              sheetName: args.userSettings.googleSheetsName.value,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await removeSheetButton.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest,
  });

  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        googleSheetsName: {
          value: '',
        },
        googleSheetsUrl: {
          value: '',
        },
      },
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      userSettings: {
        googleSheetsName: {
          value: '',
        },
        googleSheetsUrl: {
          value: '',
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'googleSheetsPage',
          sheetName: '',
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
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('admin new Google Sheet creates a managed sheet, uploads admin settings, and re-renders admin page', async () => {
  const adminSettings = {
    userSettings: {},
  };
  const storage = createChromeStorage({
    adminSettings,
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const axiosPosts = [];
  const uploadCalls = [];
  const notifications = [];
  const pageCalls = [];

  const adminNewSheetButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.js',
    {
      stubs: {
        axios: {
          async post(url, body) {
            axiosPosts.push({ url, body });
            return {
              data: {
                name: 'Admin Created Calls',
                url: 'https://sheets.example.com/admin-created',
              },
            };
          },
        },
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
        },
        '../../../../core/user': {},
        '../../../../lib/util': {
          getRcAccessToken() {
            return 'rc-token';
          },
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../components/admin/adminGoogleSheetsPage': {
          renderAdminGoogleSheetsPage(args) {
            pageCalls.push(args);
            return {
              id: 'adminGoogleSheetsPage',
              sheetName: args.adminSettings.userSettings.googleSheetsName.value,
              customizable: args.adminSettings.userSettings.googleSheetsName.customizable,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await adminNewSheetButton.onEvent({
    data: {
      body: {
        button: {
          formData: {
            newSheetName: 'Admin Created Calls',
            forceGoogleSheets: {
              customizable: false,
            },
          },
        },
      },
    },
    manifest,
  });

  assert.deepEqual(axiosPosts, [
    {
      url: 'https://server.example.com/admin/googleSheets/sheet?rcAccessToken=rc-token',
      body: {
        name: 'Admin Created Calls',
      },
    },
  ]);
  assert.deepEqual(storage.store.adminSettings.userSettings.googleSheetsName, {
    value: 'Admin Created Calls',
    customizable: false,
  });
  assert.deepEqual(storage.store.adminSettings.userSettings.googleSheetsUrl, {
    value: 'https://sheets.example.com/admin-created',
    customizable: false,
  });
  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userSettings: {
          googleSheetsName: {
            value: 'Admin Created Calls',
            customizable: false,
          },
          googleSheetsUrl: {
            value: 'https://sheets.example.com/admin-created',
            customizable: false,
          },
        },
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Admin Google Sheet "Admin Created Calls" created successfully and enforced for all users',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      adminSettings: {
        userSettings: {
          googleSheetsName: {
            value: 'Admin Created Calls',
            customizable: false,
          },
          googleSheetsUrl: {
            value: 'https://sheets.example.com/admin-created',
            customizable: false,
          },
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminGoogleSheetsPage',
          sheetName: 'Admin Created Calls',
          customizable: false,
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
