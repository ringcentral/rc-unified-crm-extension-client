const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installDocument(widgetMessages = []) {
  const widgetElement = {
    style: {},
  };

  global.document = {
    getElementById() {
      return widgetElement;
    },
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

  return {
    widgetElement,
  };
}

function createRcInfo({ smsSending = false } = {}) {
  return {
    value: {
      cachedData: {
        extensionInfo: {
          id: 'rc-extension-1',
          name: 'Ada Lovelace',
          contact: {
            email: 'ada@example.com',
          },
          account: {
            id: 'rc-account-1',
          },
        },
        extensionFeatures: {
          records: [
            {
              id: 'SMSSending',
              available: smsSending,
            },
          ],
        },
      },
    },
  };
}

function createCommonStubs(overrides = {}) {
  const analyticsCalls = [];
  const notificationCalls = [];
  const additionalSubmissionCalls = [];
  const rcInfo = overrides.rcInfo ?? createRcInfo();

  const stubs = {
    '../service/platformService': {
      async getPlatformInfo() {
        return undefined;
      },
      ...(overrides.platformService ?? {}),
    },
    '../service/manifestService': {
      async getManifest() {
        return {
          version: '1.7.35',
          platforms: {},
        };
      },
      async getPlatformList() {
        return [];
      },
      ...(overrides.manifestService ?? {}),
    },
    '../core/auth': {
      async checkAndOpenPlatformSelectionPage() {},
      setAuth() {},
      isAdminManagedOAuthEnabled() {
        return false;
      },
      async checkManagedOAuthBeforeCrmVisible() {},
      async apiKeyLogin() {
        return null;
      },
      ...(overrides.authCore ?? {}),
    },
    '../core/user': {
      async refreshUserSettings() {
        return {};
      },
      async getUserReportStats() {
        return {};
      },
      getShowUserReportTabSetting() {
        return {
          value: false,
        };
      },
      getShowCalldownTabSetting() {
        return {
          value: false,
        };
      },
      async refreshUserInfo() {},
      async updateSSCLToken() {},
      async preloadUserSettingsFromAdmin() {},
      ...(overrides.userCore ?? {}),
    },
    '../lib/util': {
      showNotification(payload) {
        notificationCalls.push(payload);
      },
      getRcAccessToken() {
        return 'rc-access-token';
      },
      async getRcInfo() {
        return rcInfo;
      },
      async setRcAdditionalSubmission(payload) {
        additionalSubmissionCalls.push(payload);
      },
      ...(overrides.util ?? {}),
    },
    '../components/reportPage/reportPage': {
      getReportsPageRender() {
        return {
          id: 'reportPage',
        };
      },
      ...(overrides.reportPage ?? {}),
    },
    '../components/calldownPage': {
      async getCalldownPageWithRecords() {
        return {
          id: 'calldownPage',
        };
      },
      ...(overrides.calldownPage ?? {}),
    },
    '../components/appointmentsPage/appointmentsPage': {
      getAppointmentsPageRender() {
        return {
          id: 'appointmentsPage',
        };
      },
      ...(overrides.appointmentsPage ?? {}),
    },
    '../lib/logUtil': {
      async triggerPendingRecordingCheck() {},
      ...(overrides.logUtil ?? {}),
    },
    '../misc/bullhorn': {
      bullhornHeartbeat() {},
      ...(overrides.bullhorn ?? {}),
    },
    axios: overrides.axios ?? {
      defaults: {
        headers: {
          common: {},
        },
      },
    },
    '../lib/analytics': {
      reset() {
        analyticsCalls.push({
          type: 'reset',
        });
      },
      identify(payload) {
        analyticsCalls.push({
          type: 'identify',
          payload,
        });
      },
      group(payload) {
        analyticsCalls.push({
          type: 'group',
          payload,
        });
      },
      trackRcLogin() {
        analyticsCalls.push({
          type: 'trackRcLogin',
        });
      },
      trackRcLogout() {
        analyticsCalls.push({
          type: 'trackRcLogout',
        });
      },
      ...(overrides.analytics ?? {}),
    },
    '../components/releaseNotesPage': {
      async getReleaseNotesPageRender() {
        return null;
      },
      ...(overrides.releaseNotesPage ?? {}),
    },
    '../core/admin': {
      async refreshAdminSettings() {},
      ...(overrides.adminCore ?? {}),
    },
    '../service/logService': {
      forceCallLogMatcherCheck() {},
      ...(overrides.logService ?? {}),
    },
    '../lib/rcAPI': {
      RcAPI: class {
        async getUserInfo() {
          return {
            accountId: 'server-account-1',
            extensionId: 'server-extension-1',
          };
        }
      },
      ...(overrides.rcAPI ?? {}),
    },
    '../service/pluginService': {
      async checkAndUpdatePluginVersion() {
        return {};
      },
      ...(overrides.pluginService ?? {}),
    },
  };

  return {
    stubs,
    analyticsCalls,
    notificationCalls,
    additionalSubmissionCalls,
    rcInfo,
  };
}

test('login status notify stores RingCentral permissions and opens platform selection when no CRM platform is selected', async () => {
  const storage = createChromeStorage();
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage() {
        throw new Error('platform selection flow should not request a runtime popup callback');
      },
    },
  };

  const widgetMessages = [];
  const { widgetElement } = installDocument(widgetMessages);

  const platformList = [
    {
      name: 'acme',
      title: 'Acme CRM',
    },
  ];
  const platformSelectionCalls = [];
  const setAuthCalls = [];

  const { stubs, analyticsCalls, additionalSubmissionCalls, rcInfo } = createCommonStubs({
    rcInfo: createRcInfo({
      smsSending: true,
    }),
    manifestService: {
      async getManifest() {
        return {
          version: '1.7.35',
          platforms: {},
        };
      },
      async getPlatformList() {
        return platformList;
      },
    },
    authCore: {
      async checkAndOpenPlatformSelectionPage(args) {
        platformSelectionCalls.push(args);
      },
      setAuth(value) {
        setAuthCalls.push(value);
      },
    },
  });

  const loginStatus = await loadBundledModule('src/eventHandlers/rc-login-status-notify.js', {
    stubs,
  });

  await loginStatus.onEvent({
    data: {
      loggedIn: true,
      loginNumber: '+15550100',
      contractedCountryCode: 'US',
      features: {
        smartNote: true,
        ringSenseInsights: false,
        ringCX: true,
        sms: true,
      },
    },
  });

  assert.deepEqual(platformSelectionCalls, [
    {
      platformList,
    },
  ]);
  assert.deepEqual(setAuthCalls, [false]);
  assert.equal(widgetElement.style.zIndex, 0);
  assert.equal(storage.store.crmAuthed, false);
  assert.deepEqual(storage.store.userPermissions, {
    aiNote: true,
    ringSenseInsights: false,
    ringCX: true,
    sms: true,
    c2sms: true,
  });
  assert.equal(storage.store.rcLoginStatus, true);
  assert.deepEqual(additionalSubmissionCalls, [
    {
      rcInfo,
      platform: undefined,
    },
  ]);
  assert.deepEqual(analyticsCalls, [
    {
      type: 'trackRcLogin',
    },
  ]);
  assert.deepEqual(widgetMessages, []);
});

test('login status notify initializes CRM-authenticated pages, analytics identity, and settings sync', async (t) => {
  const originalSetInterval = global.setInterval;
  const intervalDelays = [];
  global.setInterval = (callback, delay) => {
    intervalDelays.push(delay);
    return {
      callback,
      delay,
    };
  };
  t.after(() => {
    global.setInterval = originalSetInterval;
  });

  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    rcLoginStatus: true,
    userSettings: {
      showAppointmentsTab: {
        value: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installDocument(widgetMessages);

  const manifest = {
    serverUrl: 'https://server.example.com',
    version: '1.7.35',
    author: {
      name: 'Integration Team',
    },
    platforms: {
      acme: {
        name: 'acme',
        page: {
          appointment: {
            supported: true,
            title: 'CRM Tasks',
            showConfirm: false,
          },
        },
      },
    },
  };
  const platform = manifest.platforms.acme;
  const axiosDefaults = {
    headers: {
      common: {},
    },
  };

  const reportCalls = [];
  const calldownCalls = [];
  const appointmentCalls = [];
  const userReportCalls = [];
  const refreshUserSettingsCalls = [];
  const refreshUserInfoCalls = [];
  const updateTokenCalls = [];
  const adminCalls = [];
  const pluginCalls = [];
  const rcApiCalls = [];

  const { stubs, analyticsCalls, additionalSubmissionCalls, rcInfo } = createCommonStubs({
    rcInfo: createRcInfo(),
    platformService: {
      async getPlatformInfo() {
        return {
          platformName: 'acme',
        };
      },
    },
    manifestService: {
      async getManifest() {
        return manifest;
      },
    },
    userCore: {
      async getUserReportStats(args) {
        userReportCalls.push(args);
        return {
          totalCalls: 12,
        };
      },
      getShowUserReportTabSetting() {
        return {
          value: true,
        };
      },
      getShowCalldownTabSetting() {
        return {
          value: true,
        };
      },
      async refreshUserSettings(args) {
        refreshUserSettingsCalls.push(args);
        return {
          refreshed: true,
        };
      },
      async refreshUserInfo(args) {
        refreshUserInfoCalls.push(args);
      },
      async updateSSCLToken(args) {
        updateTokenCalls.push(args);
      },
    },
    reportPage: {
      getReportsPageRender(args) {
        reportCalls.push(args);
        return {
          id: 'reportPage',
          stats: args.userStats,
        };
      },
    },
    calldownPage: {
      async getCalldownPageWithRecords(args) {
        calldownCalls.push(args);
        return {
          id: 'calldownPage',
          filterStatus: args.filterStatus,
        };
      },
    },
    appointmentsPage: {
      getAppointmentsPageRender(args) {
        appointmentCalls.push(args);
        return {
          id: 'appointmentsPage',
          title: args.appointmentTitle,
          showConfirm: args.showConfirm,
        };
      },
    },
    axios: {
      defaults: axiosDefaults,
    },
    adminCore: {
      async refreshAdminSettings() {
        adminCalls.push({});
      },
    },
    pluginService: {
      async checkAndUpdatePluginVersion() {
        pluginCalls.push({});
        return {
          pluginVersionChanged: true,
        };
      },
    },
    rcAPI: {
      RcAPI: class {
        async getUserInfo(args) {
          rcApiCalls.push(args);
          return {
            accountId: 'server-account-1',
            extensionId: 'server-extension-1',
          };
        }
      },
    },
  });

  const loginStatus = await loadBundledModule('src/eventHandlers/rc-login-status-notify.js', {
    stubs,
  });

  await loginStatus.onEvent({
    data: {
      loggedIn: true,
      features: {
        smartNote: true,
        ringSenseInsights: true,
        ringCX: false,
        sms: false,
      },
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'reportPage',
          stats: {
            totalCalls: 12,
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
          id: 'appointmentsPage',
          title: 'CRM Tasks',
          showConfirm: false,
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-update-authorization-status',
        authorized: true,
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(intervalDelays, [900000, 300000, 600000]);
  assert.deepEqual(userReportCalls, [
    {
      dateRange: 'Last 24 hours',
    },
  ]);
  assert.deepEqual(reportCalls, [
    {
      userStats: {
        totalCalls: 12,
      },
      userSettings: {},
    },
  ]);
  assert.deepEqual(calldownCalls, [
    {
      manifest,
      filterStatus: 'All',
      userSettings: {},
    },
  ]);
  assert.deepEqual(appointmentCalls, [
    {
      manifest,
      platformName: 'acme',
      selectedTab: 'upcoming',
      appointmentTitle: 'CRM Tasks',
      showConfirm: false,
      userSettings: {
        showAppointmentsTab: {
          value: true,
        },
      },
    },
  ]);
  assert.deepEqual(adminCalls, [{}]);
  assert.deepEqual(pluginCalls, [{}]);
  assert.deepEqual(refreshUserSettingsCalls, [
    {
      changedSettings: {
        pluginVersionChanged: true,
      },
    },
  ]);
  assert.deepEqual(refreshUserInfoCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(updateTokenCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      token: 'crm-jwt',
    },
  ]);
  assert.deepEqual(rcApiCalls, [
    {
      serverUrl: 'https://server.example.com',
      extensionId: 'rc-extension-1',
      accountId: 'rc-account-1',
    },
  ]);
  assert.deepEqual(storage.store.rcUserInfo, {
    rcUserName: 'Ada Lovelace',
    rcUserEmail: 'ada@example.com',
    rcAccountId: 'server-account-1',
    rcExtensionId: 'server-extension-1',
  });
  assert.deepEqual(additionalSubmissionCalls, [
    {
      rcInfo,
      platform,
    },
  ]);
  assert.deepEqual(analyticsCalls, [
    {
      type: 'reset',
    },
    {
      type: 'identify',
      payload: {
        extensionId: 'server-extension-1',
        rcAccountId: 'server-account-1',
        platformName: 'acme',
      },
    },
    {
      type: 'group',
      payload: {
        rcAccountId: 'server-account-1',
      },
    },
  ]);
  assert.equal(axiosDefaults.headers.common['rc-extension-id'], 'server-extension-1');
  assert.equal(axiosDefaults.headers.common['rc-account-id'], 'server-account-1');
  assert.equal(axiosDefaults.headers.common['developer-author-name'], 'Integration Team');
});

test('login status notify absorbs the first widget logout event before tracking a real logout', async () => {
  const storage = createChromeStorage({
    rcLoginStatus: true,
  });
  global.chrome = storage.chrome;

  const { stubs, analyticsCalls } = createCommonStubs();
  const loginStatus = await loadBundledModule('src/eventHandlers/rc-login-status-notify.js', {
    stubs,
  });

  await loginStatus.onEvent({
    data: {
      loggedIn: false,
    },
  });
  assert.equal(storage.store.rcLoginStatus, true);
  assert.deepEqual(analyticsCalls, []);

  await loginStatus.onEvent({
    data: {
      loggedIn: false,
    },
  });
  assert.equal(storage.store.rcLoginStatus, false);
  assert.deepEqual(analyticsCalls, [
    {
      type: 'trackRcLogout',
    },
  ]);
});

test('login status notify registers release notes and updates stored extension version', async () => {
  const storage = createChromeStorage({
    rcLoginStatus: false,
    'rc-crm-extension-version': '1.0.0',
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installDocument(widgetMessages);

  const releaseNoteCalls = [];
  const { stubs, notificationCalls } = createCommonStubs({
    platformService: {
      async getPlatformInfo() {
        return {
          platformName: 'acme',
        };
      },
    },
    manifestService: {
      async getManifest() {
        return {
          version: '2.0.0',
          platforms: {
            acme: {},
          },
        };
      },
    },
    releaseNotesPage: {
      async getReleaseNotesPageRender(args) {
        releaseNoteCalls.push(args);
        return {
          id: 'releaseNotesPage',
          title: 'Release notes',
        };
      },
    },
  });

  const loginStatus = await loadBundledModule('src/eventHandlers/rc-login-status-notify.js', {
    stubs,
  });

  await loginStatus.onEvent({
    data: {
      loggedIn: false,
    },
  });

  assert.deepEqual(releaseNoteCalls, [
    {
      manifest: {
        version: '2.0.0',
        platforms: {
          acme: {},
        },
      },
      platformName: 'acme',
      registeredVersion: '1.0.0',
    },
  ]);
  assert.equal(storage.store['rc-crm-extension-version'], '2.0.0');
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'releaseNotesPage',
          title: 'Release notes',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/releaseNotesPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(notificationCalls, [
    {
      level: 'success',
      message: 'Updated to the latest version 2.0.0',
      ttl: 60000,
    },
  ]);
});
