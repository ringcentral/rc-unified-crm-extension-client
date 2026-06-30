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
      windowMessages.push({
        openedUrl: url,
      });
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

test('plugin market list page filters installed plugins and preserves search/filter state', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const onlineSettingsCalls = [];
  const renderCalls = [];

  const pluginMarket = await loadBundledModule('src/eventHandlers/rc-post-message-request/pluginMarketListPage.js', {
    stubs: {
      '../../components/pluginMarketListPage': {
        getPluginMarketListPageRender(args) {
          renderCalls.push(args);
          return {
            id: 'pluginMarketListPage',
            pluginIds: args.pluginList.map((plugin) => plugin.id),
            searchWord: args.searchWord,
            filter: args.filter,
          };
        },
      },
      '../../service/manifestService': {
        async getPluginList() {
          return [
            {
              id: 'plugin-available-1',
            },
            {
              id: 'plugin-installed',
            },
            {
              id: 'plugin-available-2',
            },
          ];
        },
      },
      '../../core/user': {
        async getUserSettingsOnline(args) {
          onlineSettingsCalls.push(args);
          return {
            plugins: {
              installed: true,
            },
          };
        },
        getAllPluginSettings() {
          return {
            'plugin-installed': {
              enabled: true,
            },
          };
        },
      },
    },
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await pluginMarket.onEvent({
    data: {
      body: {
        formData: {
          pluginSearch: {
            search: 'calendar',
            filter: 'productivity',
          },
        },
      },
    },
    manifest,
  });

  assert.deepEqual(onlineSettingsCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(renderCalls, [
    {
      pluginList: [
        {
          id: 'plugin-available-1',
        },
        {
          id: 'plugin-available-2',
        },
      ],
      searchWord: 'calendar',
      filter: 'productivity',
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
          id: 'pluginMarketListPage',
          pluginIds: ['plugin-available-1', 'plugin-available-2'],
          searchWord: 'calendar',
          filter: 'productivity',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/pluginMarketListPage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('open developer settings page renders admin-aware developer settings and navigates to it', async () => {
  const storage = createChromeStorage({
    isAdmin: true,
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installWindowAndAdapter([], widgetMessages);

  const renderCalls = [];
  const openDeveloperSettingsPage = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openDeveloperSettingsPage.js', {
    stubs: {
      '../../../../components/developerSettingsPage': {
        getDeveloperSettingsPageRender(args) {
          renderCalls.push(args);
          return {
            id: 'developerSettingsPage',
            isAdmin: args.isAdmin,
          };
        },
      },
    },
  });

  await openDeveloperSettingsPage.onEvent({
    data: {},
  });

  assert.deepEqual(renderCalls, [
    {
      isAdmin: true,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'developerSettingsPage',
          isAdmin: true,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/developerSettingsPage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('open implemented interfaces page renders stored implemented interface metadata', async () => {
  const storage = createChromeStorage({
    implementedInterfaces: {
      createCallLog: true,
      findContactWithName: false,
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installWindowAndAdapter([], widgetMessages);

  const renderCalls = [];
  const openImplementedInterfaces = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openImplementedInterfacesPageButton.js', {
    stubs: {
      '../../../../components/developerSettingsPage/implementedInterfacesPage': {
        getImplementedInterfacesPageRender(args) {
          renderCalls.push(args);
          return {
            id: 'implementedInterfacesPage',
            implementedInterfaces: args.implementedInterfaces,
          };
        },
      },
    },
  });

  await openImplementedInterfaces.onEvent({
    data: {},
  });

  assert.deepEqual(renderCalls, [
    {
      implementedInterfaces: {
        createCallLog: true,
        findContactWithName: false,
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'implementedInterfacesPage',
          implementedInterfaces: {
            createCallLog: true,
            findContactWithName: false,
          },
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/implementedInterfacesPage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('documentation navigation opens the platform documentation URL and tracks the page', async () => {
  const windowMessages = [];
  installWindowAndAdapter(windowMessages);

  const trackCalls = [];
  const notifications = [];

  const documentation = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.js', {
    stubs: {
      '../../../../lib/analytics': {
        trackPage(path) {
          trackCalls.push(path);
        },
      },
      '../../../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
      },
    },
  });

  await documentation.onEvent({
    data: {},
    platform: {
      documentationUrl: 'https://docs.example.com/acme',
    },
  });

  assert.deepEqual(windowMessages, [
    {
      openedUrl: 'https://docs.example.com/acme',
    },
  ]);
  assert.deepEqual(trackCalls, ['/documentation']);
  assert.deepEqual(notifications, []);
});

test('documentation navigation warns when the platform has no documentation URL', async () => {
  const windowMessages = [];
  installWindowAndAdapter(windowMessages);

  const trackCalls = [];
  const notifications = [];

  const documentation = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.js', {
    stubs: {
      '../../../../lib/analytics': {
        trackPage(path) {
          trackCalls.push(path);
        },
      },
      '../../../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
      },
    },
  });

  await documentation.onEvent({
    data: {},
    platform: {},
  });

  assert.deepEqual(windowMessages, []);
  assert.deepEqual(trackCalls, []);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Documentation URL is not set',
      ttl: 3000,
    },
  ]);
});
