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

test('controlCall forwards call control action to the widget and responds to runtime', async () => {
  const widgetMessages = [];
  const responses = [];
  installAdapterFrame(widgetMessages);

  const controlCall = await loadBundledModule('src/messageHandlers/controlCall.js');

  await controlCall.onMessage({
    request: {
      callAction: 'answer',
      callId: 'call-1',
      options: {
        deviceId: 'device-1',
      },
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-control-call',
        callAction: 'answer',
        callId: 'call-1',
        options: {
          deviceId: 'device-1',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
});

test('ringsenseRefTrack tracks the RingSense referral page and responds to runtime', async () => {
  const trackingCalls = [];
  const responses = [];

  const ringsenseRefTrack = await loadBundledModule('src/messageHandlers/ringsenseRefTrack.js', {
    stubs: {
      '../lib/analytics': {
        trackRingSensePage() {
          trackingCalls.push('trackRingSensePage');
        },
      },
    },
  });

  await ringsenseRefTrack.onMessage({
    request: {},
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(trackingCalls, ['trackRingSensePage']);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
});

test('pipedrive callback exits early when CRM auth already exists', async () => {
  const responses = [];

  const pipedriveCallbackUri = await loadBundledModule('src/messageHandlers/pipedriveCallbackUri.js', {
    stubs: {
      '../core/auth': {
        async checkAuth() {
          return true;
        },
        async onAuthCallback() {
          throw new Error('onAuthCallback should not run when CRM auth already exists');
        },
      },
      '../core/user': {},
      '../core/admin': {},
      '../components/reportPage/reportPage': {},
      '../components/calldownPage': {},
      '../components/admin/adminPage': {},
      '../service/platformService': {},
      '../service/manifestService': {},
    },
  });

  await pipedriveCallbackUri.onMessage({
    request: {
      pipedriveCallbackUri: 'https://acme.pipedrive.com/oauth/callback?code=crm-code',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
});

test('pipedrive callback URI exchanges CRM token, refreshes post-login pages, and notifies the installer tab', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  const runtimeMessages = [];
  global.chrome = {
    storage: storage.chrome.storage,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const widgetMessages = [];
  installAdapterFrame(widgetMessages);

  const authCallbackCalls = [];
  const updateTokenCalls = [];
  const userReportStatsCalls = [];
  const calldownPageCalls = [];
  const refreshUserSettingsCalls = [];
  const refreshAdminSettingsCalls = [];
  const authAppConnectServerCalls = [];
  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      pipedrive: {
        name: 'pipedrive',
        useLicense: true,
      },
    },
  };

  const pipedriveCallbackUri = await loadBundledModule('src/messageHandlers/pipedriveCallbackUri.js', {
    stubs: {
      '../core/auth': {
        async checkAuth() {
          return false;
        },
        async onAuthCallback(args) {
          authCallbackCalls.push(args);
          return 'crm-jwt';
        },
      },
      '../core/user': {
        async updateSSCLToken(args) {
          updateTokenCalls.push(args);
        },
        getShowUserReportTabSetting() {
          return {
            value: true,
          };
        },
        async getUserReportStats(args) {
          userReportStatsCalls.push(args);
          return {
            loggedCalls: 5,
          };
        },
        getShowCalldownTabSetting() {
          return {
            value: true,
          };
        },
        async refreshUserSettings(args) {
          refreshUserSettingsCalls.push(args);
        },
      },
      '../core/admin': {
        async refreshAdminSettings() {
          refreshAdminSettingsCalls.push({});
          return {
            adminSettings: {
              enabled: true,
            },
          };
        },
        async authAppConnectServer(args) {
          authAppConnectServerCalls.push(args);
        },
      },
      '../components/reportPage/reportPage': {
        getReportsPageRender(args) {
          return {
            id: 'reportPage',
            stats: args.userStats,
          };
        },
      },
      '../components/calldownPage': {
        async getCalldownPageWithRecords(args) {
          calldownPageCalls.push(args);
          return {
            id: 'calldownPage',
          };
        },
      },
      '../components/admin/adminPage': {
        getAdminPageRender(args) {
          return {
            id: 'adminPage',
            platformName: args.platform.name,
          };
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'pipedrive',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return manifest;
        },
      },
    },
  });

  await pipedriveCallbackUri.onMessage({
    request: {
      pipedriveCallbackUri: 'https://acme.pipedrive.com/oauth/callback?code=crm-code',
    },
    sendResponse() {},
  });

  const platform = manifest.platforms.pipedrive;
  assert.deepEqual(authCallbackCalls, [
    {
      serverUrl: 'https://server.example.com',
      callbackUri: 'https://acme.pipedrive.com/oauth/callback?code=crm-code&state=platform=pipedrive',
      useLicense: true,
    },
  ]);
  assert.deepEqual(updateTokenCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      token: 'crm-jwt',
    },
  ]);
  assert.equal(storage.store.crmAuthed, true);
  assert.deepEqual(userReportStatsCalls, [
    {
      dateRange: 'Last 24 hours',
    },
  ]);
  assert.deepEqual(calldownPageCalls, [
    {
      manifest,
      filterStatus: 'All',
      userSettings: {},
    },
  ]);
  assert.deepEqual(refreshAdminSettingsCalls, [{}]);
  assert.deepEqual(refreshUserSettingsCalls, [{}]);
  assert.deepEqual(authAppConnectServerCalls, [
    {
      serverUrl: 'https://server.example.com',
      jwtToken: 'crm-jwt',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'reportPage',
          stats: {
            loggedCalls: 5,
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
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminPage',
          platformName: 'pipedrive',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(runtimeMessages, [
    {
      type: 'pipedriveAltAuthDone',
    },
  ]);
});
test('insightly API key auth registers post-login pages and opens the popup window', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  const runtimeMessages = [];
  global.chrome = {
    storage: storage.chrome.storage,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const windowMessages = [];
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
  const widgetMessages = [];
  installAdapterFrame(widgetMessages);

  const apiKeyLoginCalls = [];
  const updateTokenCalls = [];
  const userReportStatsCalls = [];
  const calldownPageCalls = [];
  const refreshUserSettingsCalls = [];
  const refreshAdminSettingsCalls = [];
  const authAppConnectServerCalls = [];

  const insightlyAuth = await loadBundledModule('src/messageHandlers/insightlyAuth.js', {
    stubs: {
      '../core/auth': {
        async apiKeyLogin(args) {
          apiKeyLoginCalls.push(args);
          return 'crm-jwt';
        },
      },
      '../core/user': {
        async updateSSCLToken(args) {
          updateTokenCalls.push(args);
        },
        getShowUserReportTabSetting() {
          return {
            value: true,
          };
        },
        async getUserReportStats(args) {
          userReportStatsCalls.push(args);
          return {
            loggedCalls: 3,
          };
        },
        getShowCalldownTabSetting() {
          return {
            value: true,
          };
        },
        async refreshUserSettings(args) {
          refreshUserSettingsCalls.push(args);
        },
      },
      '../core/admin': {
        async refreshAdminSettings() {
          refreshAdminSettingsCalls.push({});
          return {
            adminSettings: {
              enabled: true,
            },
          };
        },
        async authAppConnectServer(args) {
          authAppConnectServerCalls.push(args);
        },
      },
      '../components/reportPage/reportPage': {
        getReportsPageRender(args) {
          return {
            id: 'reportPage',
            stats: args.userStats,
          };
        },
      },
      '../components/calldownPage': {
        async getCalldownPageWithRecords(args) {
          calldownPageCalls.push(args);
          return {
            id: 'calldownPage',
          };
        },
      },
      '../components/admin/adminPage': {
        getAdminPageRender(args) {
          return {
            id: 'adminPage',
            platformName: args.platform.name,
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
            platforms: {
              insightly: {
                name: 'insightly',
                useLicense: true,
              },
            },
          };
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'insightly',
          };
        },
      },
    },
  });

  await insightlyAuth.onMessage({
    request: {
      apiKey: 'api-key-1',
      apiUrl: 'https://api.insightly.example.com',
    },
    sendResponse() {},
  });

  const platform = {
    name: 'insightly',
    useLicense: true,
  };
  assert.deepEqual(apiKeyLoginCalls, [
    {
      serverUrl: 'https://server.example.com',
      apiKey: 'api-key-1',
      formData: {
        apiUrl: 'https://api.insightly.example.com',
      },
      useLicense: true,
    },
  ]);
  assert.deepEqual(updateTokenCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      token: 'crm-jwt',
    },
  ]);
  assert.equal(storage.store.crmAuthed, true);
  assert.deepEqual(userReportStatsCalls, [
    {
      dateRange: 'Last 24 hours',
    },
  ]);
  assert.deepEqual(calldownPageCalls, [
    {
      manifest: {
        serverUrl: 'https://server.example.com',
        platforms: {
          insightly: platform,
        },
      },
      filterStatus: 'All',
      userSettings: {},
    },
  ]);
  assert.deepEqual(refreshAdminSettingsCalls, [{}]);
  assert.deepEqual(authAppConnectServerCalls, [
    {
      serverUrl: 'https://server.example.com',
      jwtToken: 'crm-jwt',
    },
  ]);
  assert.deepEqual(refreshUserSettingsCalls, [{}]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'reportPage',
          stats: {
            loggedCalls: 3,
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
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'adminPage',
          platformName: 'insightly',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-apiKey-input-modal-close',
        platform: 'insightly',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(runtimeMessages, [
    {
      type: 'openPopupWindow',
    },
  ]);
});
