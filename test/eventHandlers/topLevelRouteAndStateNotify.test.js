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

test('route changed notify refreshes Call Back tab records when authenticated user opens the calldown tab', async () => {
  const storage = createChromeStorage({
    crmAuthed: true,
    rcUnifiedCrmExtJwt: 'crm-jwt',
    userSettings: {
      timezone: 'UTC',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const trackCalls = [];
  const pageCalls = [];

  const routeChanged = await loadBundledModule('src/eventHandlers/rc-route-changed-notify.js', {
    stubs: {
      '../lib/analytics': {
        trackPage(path) {
          trackCalls.push(path);
        },
      },
      '../core/user': {
        getShowCalldownTabSetting() {
          return {
            value: true,
          };
        },
      },
      '../components/calldownPage': {
        async getCalldownPageWithRecords(args) {
          pageCalls.push(args);
          return {
            id: 'calldownPage',
            filterStatus: args.filterStatus,
          };
        },
        getCalldownPageRender() {
          return {
            id: 'calldownPage',
          };
        },
      },
      '../components/appointmentsPage/appointmentsPage': {},
      '../service/manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
          };
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
    },
  });

  await routeChanged.onEvent({
    data: {
      path: '/customizedTabs/calldownPage',
    },
  });

  assert.equal(storage.store.appConnectCurrentPath, '/customizedTabs/calldownPage');
  assert.equal(storage.store.autoPopupMainConverastionId, null);
  assert.deepEqual(trackCalls, ['/customizedTabs/calldownPage']);
  assert.deepEqual(pageCalls, [
    {
      manifest: {
        serverUrl: 'https://server.example.com',
      },
      filterStatus: 'All',
      userSettings: {
        timezone: 'UTC',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
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
  ]);
  assert.deepEqual(windowMessages, []);
});

test('route changed notify hides Call Back tab when CRM is disconnected', async () => {
  const storage = createChromeStorage({
    crmAuthed: false,
    rcUnifiedCrmExtJwt: null,
    userSettings: {
      showCalldown: true,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const routeChanged = await loadBundledModule('src/eventHandlers/rc-route-changed-notify.js', {
    stubs: {
      '../lib/analytics': {
        trackPage() {},
      },
      '../core/user': {
        getShowCalldownTabSetting() {
          return {
            value: true,
          };
        },
        async refreshUserSettings() {},
      },
      '../components/calldownPage': {
        async getCalldownPageWithRecords() {
          throw new Error('disconnected CRM should not fetch calldown records');
        },
        getCalldownPageRender() {
          return {
            id: 'calldownPage',
            title: 'Call Back',
          };
        },
      },
      '../components/appointmentsPage/appointmentsPage': {},
      '../service/manifestService': {
        async getManifest() {
          return {};
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
    },
  });

  await routeChanged.onEvent({
    data: {
      path: '/customizedTabs/calldownPage',
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          title: 'Call Back',
          hidden: true,
          unreadCount: 0,
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('region settings notify stores selected region, updates locale, and re-registers service manifest', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const localeCalls = [];
  const regionSettings = await loadBundledModule('src/eventHandlers/rc-region-settings-notify.js', {
    stubs: {
      '../i18n': {
        async setLocale(countryCode) {
          localeCalls.push(countryCode);
        },
      },
      '../service/embeddableServices': {
        async getServiceManifest() {
          return {
            name: 'acme',
            displayName: 'Acme CRM',
          };
        },
      },
    },
  });

  await regionSettings.onEvent({
    data: {
      countryCode: 'fr-FR',
    },
  });

  assert.equal(storage.store.selectedRegion, 'fr-FR');
  assert.deepEqual(localeCalls, ['fr-FR']);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: {
          name: 'acme',
          displayName: 'Acme CRM',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('push adapter state refreshes manifest, applies platform timeout, and re-registers service manifest', async () => {
  const widgetMessages = [];
  installWindowAndAdapter([], widgetMessages);

  const refreshCalls = [];
  const axiosDefaults = {};

  const pushAdapterState = await loadBundledModule('src/eventHandlers/rc-adapter-pushAdapterState.js', {
    stubs: {
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          throw new Error('push adapter state should use refreshManifest result');
        },
        async refreshManifest() {
          refreshCalls.push({});
          return {
            platforms: {
              acme: {
                requestConfig: {
                  timeout: 12,
                },
              },
            },
          };
        },
      },
      '../service/embeddableServices': {
        async getServiceManifest() {
          return {
            name: 'acme',
          };
        },
      },
      axios: {
        defaults: axiosDefaults,
      },
    },
  });

  await pushAdapterState.onEvent({
    data: {},
  });

  assert.deepEqual(refreshCalls, [{}]);
  assert.equal(axiosDefaults.timeout, 12000);
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
  ]);
});

test('login popup notify asks service worker to open RingCentral OAuth window', async () => {
  const runtimeMessages = [];
  global.chrome = {
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const loginPopup = await loadBundledModule('src/eventHandlers/rc-login-popup-notify.js');

  await loginPopup.onEvent({
    data: {
      oAuthUri: 'https://platform.ringcentral.com/restapi/oauth/authorize?state=abc',
    },
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'openRCOAuthWindow',
      oAuthUri: 'https://platform.ringcentral.com/restapi/oauth/authorize?state=abc',
    },
  ]);
});
