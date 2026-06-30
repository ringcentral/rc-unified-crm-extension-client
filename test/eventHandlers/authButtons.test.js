const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages = [], widgetMessages = []) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
    open(url) {
      windowMessages.push({ openedUrl: url });
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

test('auth page API key login registers report, calldown, and admin pages after CRM auth succeeds', async () => {
  const storage = createChromeStorage({
    userSettings: {
      locale: 'en-US',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const apiKeyLoginCalls = [];
  const updateTokenCalls = [];
  const reportStatsCalls = [];
  const reportRenderCalls = [];
  const calldownCalls = [];
  const adminRefreshCalls = [];
  const adminRenderCalls = [];
  const serverAuthCalls = [];

  const authPage = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/auth/authPage.js', {
    stubs: {
      '../../../../core/auth': {
        async apiKeyLogin(args) {
          apiKeyLoginCalls.push(args);
          return 'crm-jwt';
        },
      },
      '../../../../core/user': {
        async updateSSCLToken(args) {
          updateTokenCalls.push(args);
        },
        getShowUserReportTabSetting() {
          return {
            value: true,
          };
        },
        async getUserReportStats(args) {
          reportStatsCalls.push(args);
          return {
            totalMessages: 5,
          };
        },
        getShowCalldownTabSetting() {
          return {
            value: true,
          };
        },
      },
      '../../../../components/reportPage/reportPage': {
        getReportsPageRender(args) {
          reportRenderCalls.push(args);
          return {
            id: 'reportPage',
            stats: args.userStats,
          };
        },
      },
      '../../../../components/calldownPage': {
        async getCalldownPageWithRecords(args) {
          calldownCalls.push(args);
          return {
            id: 'calldownPage',
            filterStatus: args.filterStatus,
          };
        },
      },
      '../../../../core/admin': {
        async refreshAdminSettings() {
          adminRefreshCalls.push({});
          return {
            adminSettings: {
              enabled: true,
            },
          };
        },
        async authAppConnectServer(args) {
          serverAuthCalls.push(args);
        },
      },
      '../../../../components/admin/adminPage': {
        getAdminPageRender(args) {
          adminRenderCalls.push(args);
          return {
            id: 'adminPage',
            platformName: args.platform.name,
          };
        },
      },
    },
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const platform = {
    name: 'acme',
    useLicense: true,
  };
  const formData = {
    apiKey: 'api-key-1',
    hostname: 'crm.example.com',
  };

  await authPage.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
    manifest,
    platform,
  });

  assert.deepEqual(apiKeyLoginCalls, [
    {
      serverUrl: 'https://server.example.com',
      apiKey: 'api-key-1',
      formData,
      useLicense: true,
    },
  ]);
  assert.equal(storage.store.crmAuthed, true);
  assert.deepEqual(updateTokenCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      token: 'crm-jwt',
    },
  ]);
  assert.deepEqual(reportStatsCalls, [
    {
      dateRange: 'Last 24 hours',
    },
  ]);
  assert.deepEqual(reportRenderCalls, [
    {
      userStats: {
        totalMessages: 5,
      },
      userSettings: {
        locale: 'en-US',
      },
    },
  ]);
  assert.deepEqual(calldownCalls, [
    {
      manifest,
      filterStatus: 'All',
      userSettings: {
        locale: 'en-US',
      },
    },
  ]);
  assert.deepEqual(adminRefreshCalls, [{}]);
  assert.deepEqual(adminRenderCalls, [
    {
      platform,
    },
  ]);
  assert.deepEqual(serverAuthCalls, [
    {
      serverUrl: 'https://server.example.com',
      jwtToken: 'crm-jwt',
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
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'reportPage',
          stats: {
            totalMessages: 5,
          },
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          filterStatus: 'All',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminPage',
          platformName: 'acme',
        },
      },
      targetOrigin: '*',
    },
  ]);
});

test('auth page API key login stores unauthenticated state and skips page registration when login fails', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const updateTokenCalls = [];
  const authPage = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/auth/authPage.js', {
    stubs: {
      '../../../../core/auth': {
        async apiKeyLogin() {
          return null;
        },
      },
      '../../../../core/user': {
        async updateSSCLToken(args) {
          updateTokenCalls.push(args);
        },
        getShowUserReportTabSetting() {
          throw new Error('failed auth should not inspect report tab settings');
        },
        getShowCalldownTabSetting() {
          throw new Error('failed auth should not inspect calldown settings');
        },
      },
      '../../../../components/reportPage/reportPage': {},
      '../../../../components/calldownPage': {},
      '../../../../core/admin': {
        async refreshAdminSettings() {
          throw new Error('failed auth should not refresh admin settings');
        },
      },
      '../../../../components/admin/adminPage': {},
    },
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const platform = {
    name: 'acme',
  };

  await authPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            apiKey: 'bad-key',
          },
        },
      },
    },
    manifest,
    platform,
  });

  assert.equal(storage.store.crmAuthed, false);
  assert.deepEqual(updateTokenCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      token: null,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(widgetMessages, []);
});

test('managed OAuth setup saves pending values, starts connect flow, and navigates back once', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const saveCalls = [];
  const connectCalls = [];
  const notifications = [];

  const managedOAuthSetup = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.js',
    {
      stubs: {
        '../../../../core/auth': {
          async saveManagedOAuthPendingValues(args) {
            saveCalls.push(args);
          },
          async onUserClickConnectButton(args) {
            connectCalls.push(args);
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

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const platform = {
    name: 'acme',
  };
  const formData = {
    clientId: 'client-1',
    clientSecret: 'secret-1',
    accessTokenUri: 'https://crm.example.com/token',
    authorizationUri: 'https://crm.example.com/auth',
    redirectUri: 'https://extension.example.com/oauth',
    scopes: 'crm.read crm.write',
    hostname: 'crm.example.com',
  };

  await managedOAuthSetup.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
    manifest,
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(saveCalls, [
    {
      serverUrl: 'https://server.example.com',
      values: formData,
    },
  ]);
  assert.deepEqual(connectCalls, [
    {
      platform,
      platformName: 'acme',
      manifest,
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'OAuth credentials will be saved after you, as the first user, successfully connect to CRM. To re-enter them, close and reopen the extension.',
      ttl: 10000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
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
});

test('managed OAuth setup reports failure and does not navigate when saving pending values fails', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const notifications = [];
  const managedOAuthSetup = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.js',
    {
      stubs: {
        '../../../../core/auth': {
          async saveManagedOAuthPendingValues() {
            throw new Error('save failed');
          },
          async onUserClickConnectButton() {
            throw new Error('failed save should not start connect flow');
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

  await managedOAuthSetup.onEvent({
    data: {
      body: {
        button: {
          formData: {
            clientId: 'client-1',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      name: 'acme',
    },
  });

  assert.deepEqual(notifications, [
    {
      level: 'error',
      message: 'Failed to save OAuth credentials. Please try again.',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(widgetMessages, []);
});

test('insightly get API key opens the user settings page on the selected hostname', async () => {
  const windowMessages = [];
  installWindowAndAdapter(windowMessages);

  const insightlyGetApiKey = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/insightlyGetApiKey.js'
  );

  await insightlyGetApiKey.onEvent({
    data: {},
    platformInfo: {
      hostname: 'acme.insightly.com',
    },
  });

  assert.deepEqual(windowMessages, [
    {
      openedUrl: 'https://acme.insightly.com/Users/UserSettings',
    },
  ]);
});
