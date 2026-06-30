const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

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

function createPlugin(overrides = {}) {
  return {
    id: 'plugin-alpha',
    access: 'public',
    name: 'acme.alpha',
    displayName: 'Acme Alpha',
    version: '1.2.3',
    isAsync: true,
    phase: 'afterLog',
    supportedLogTypes: ['call', 'sms'],
    requireLicense: true,
    description: 'Alpha plugin',
    developer: {
      name: 'Acme',
    },
    pageContent: [
      {
        const: 'apiKey',
        title: 'API Key',
        type: 'string',
      },
      {
        const: 'secret',
        title: 'Secret',
        type: 'string',
        hidden: true,
      },
    ],
    ...overrides,
  };
}

function createCoreUserStub(refreshUserSettingsImpl) {
  return {
    getPluginSetting(userSettings, pluginId) {
      return userSettings[`plugin_${pluginId}`]?.value;
    },
    getAllPluginSettings(userSettings) {
      const result = {};
      for (const key of Object.keys(userSettings)) {
        if (key.startsWith('plugin_') && !userSettings[key]?.isRemoved) {
          result[key.slice('plugin_'.length)] = userSettings[key].value;
        }
      }
      return result;
    },
    async refreshUserSettings(args) {
      return refreshUserSettingsImpl(args);
    },
  };
}

test('admin install plugin saves admin settings, registers the plugin, and refreshes plugin pages', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pluginAlpha = createPlugin();
  const pluginBeta = createPlugin({
    id: 'plugin-beta',
    name: 'acme.beta',
    displayName: 'Acme Beta',
    requireLicense: false,
  });
  const uploadCalls = [];
  const axiosPosts = [];
  const adminConfigurePageCalls = [];
  const marketPageCalls = [];
  const installedPageCalls = [];
  const refreshCalls = [];

  const pluginAdminConfigButtons = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.js',
    {
      stubs: {
        '../../../../service/manifestService': {
          async getPluginList() {
            return [pluginAlpha, pluginBeta];
          },
        },
        '../../../../core/admin': {
          async getAdminSettings(args) {
            assert.deepEqual(args, {
              serverUrl: 'https://server.example.com',
            });
            return {
              userSettings: {},
            };
          },
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
        },
        '../../../../core/user': createCoreUserStub(async (args) => {
          refreshCalls.push(args);
          return {
            'plugin_plugin-alpha': {
              value: {
                name: 'acme.alpha',
              },
            },
          };
        }),
        '../../../../components/pluginAdminConfigurePage': {
          getPluginAdminConfigurePageRender(args) {
            adminConfigurePageCalls.push(args);
            return {
              id: 'pluginConfigurePage',
              installed: args.installed,
            };
          },
        },
        '../../../../components/pluginMarketListPage': {
          getPluginMarketListPageRender(args) {
            marketPageCalls.push(args);
            return {
              id: 'pluginMarketListPage',
              plugins: args.pluginList.map((plugin) => plugin.id),
            };
          },
        },
        '../../../../components/installedPluginListPage': {
          getInstalledPluginListPageRender(args) {
            installedPageCalls.push(args);
            return {
              id: 'installedPluginListPage',
              plugins: args.pluginList.map((plugin) => plugin.id),
            };
          },
        },
        '../../../../lib/util': {
          getRcAccessToken() {
            return 'rc-token';
          },
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-1',
                  },
                },
              },
            };
          },
          showNotification() {},
        },
        axios: {
          async post(url, body) {
            axiosPosts.push({ url, body });
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await pluginAdminConfigButtons.onEvent({
    data: {
      body: {
        button: {
          formData: {
            pluginId: 'plugin-alpha',
            access: 'public',
            plugin: pluginAlpha,
          },
        },
      },
    },
    manifest,
    buttonId: 'installButton',
  });

  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userSettings: {
          'plugin_plugin-alpha': {
            value: {
              name: 'acme.alpha',
              version: '1.2.3',
              isAsync: true,
              logTypes: ['call', 'sms'],
              access: 'public',
              requireLicense: true,
              config: {
                apiKey: {
                  value: null,
                  customizable: true,
                },
                secret: {
                  value: null,
                  customizable: false,
                },
              },
            },
            customizable: true,
          },
        },
      },
    },
  ]);
  assert.deepEqual(axiosPosts, [
    {
      url: 'https://server.example.com/plugin/register?rcAccessToken=rc-token',
      body: {
        pluginId: 'plugin-alpha',
        pluginAccess: 'public',
        pluginName: 'acme.alpha',
        rcAccountId: 'rc-account-1',
      },
    },
  ]);
  assert.deepEqual(refreshCalls, [{}]);
  assert.deepEqual(adminConfigurePageCalls, [
    {
      pluginId: 'plugin-alpha',
      pluginAccess: 'public',
      plugin: pluginAlpha,
      installed: true,
    },
  ]);
  assert.deepEqual(marketPageCalls, [
    {
      pluginList: [pluginBeta],
      searchWord: '',
      filter: null,
    },
  ]);
  assert.deepEqual(installedPageCalls, [
    {
      pluginList: [pluginAlpha],
      isFromAdmin: true,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'pluginConfigurePage',
          installed: true,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/pluginConfigurePage',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'pluginMarketListPage',
          plugins: ['plugin-beta'],
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'installedPluginListPage',
          plugins: ['plugin-alpha'],
        },
      },
      targetOrigin: undefined,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('admin install plugin rolls back admin setting and notifies when server registration fails', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pluginAlpha = createPlugin();
  const uploadCalls = [];
  const notifications = [];
  const errors = [];
  const previousConsoleError = console.error;
  console.error = (...args) => {
    errors.push(args);
  };

  try {
    const pluginAdminConfigButtons = await loadBundledModule(
      'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.js',
      {
        stubs: {
          '../../../../service/manifestService': {
            async getPluginList() {
              return [pluginAlpha];
            },
          },
          '../../../../core/admin': {
            async getAdminSettings() {
              return {
                userSettings: {},
              };
            },
            async uploadAdminSettings(args) {
              uploadCalls.push(clone(args));
            },
          },
          '../../../../core/user': createCoreUserStub(async () => {
            throw new Error('refreshUserSettings should not run after register failure');
          }),
          '../../../../components/pluginAdminConfigurePage': {},
          '../../../../components/pluginMarketListPage': {},
          '../../../../components/installedPluginListPage': {},
          '../../../../lib/util': {
            getRcAccessToken() {
              return 'rc-token';
            },
            async getRcInfo() {
              return {
                value: {
                  cachedData: {
                    accountInfo: {
                      id: 'rc-account-1',
                    },
                  },
                },
              };
            },
            showNotification(notification) {
              notifications.push(notification);
            },
          },
          axios: {
            async post() {
              throw new Error('register failed');
            },
          },
        },
      }
    );

    await pluginAdminConfigButtons.onEvent({
      data: {
        body: {
          button: {
            formData: {
              pluginId: 'plugin-alpha',
              access: 'public',
              plugin: pluginAlpha,
            },
          },
        },
      },
      manifest: {
        serverUrl: 'https://server.example.com',
      },
      buttonId: 'installButton',
    });
  } finally {
    console.error = previousConsoleError;
  }

  assert.equal(uploadCalls.length, 2);
  assert.equal(uploadCalls[0].adminSettings.userSettings['plugin_plugin-alpha'].isRemoved, undefined);
  assert.equal(uploadCalls[1].adminSettings.userSettings['plugin_plugin-alpha'].isRemoved, true);
  assert.deepEqual(notifications, [
    {
      level: 'error',
      message: 'register failed',
      ttl: 5000,
    },
  ]);
  assert.equal(errors.length, 1);
  assert.deepEqual(widgetMessages, []);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('admin remove plugin marks it removed, unregisters it, and refreshes the installed plugin list', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pluginAlpha = createPlugin();
  const pluginBeta = createPlugin({
    id: 'plugin-beta',
    name: 'acme.beta',
    displayName: 'Acme Beta',
  });
  const uploadCalls = [];
  const deleteCalls = [];
  const refreshCalls = [];
  const installedPageCalls = [];

  const pluginAdminConfigButtons = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.js',
    {
      stubs: {
        '../../../../service/manifestService': {
          async getPluginList() {
            return [pluginAlpha, pluginBeta];
          },
        },
        '../../../../core/admin': {
          async getAdminSettings() {
            return {
              userSettings: {
                'plugin_plugin-alpha': {
                  value: {
                    name: 'acme.alpha',
                  },
                },
              },
            };
          },
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
        },
        '../../../../core/user': createCoreUserStub(async (args) => {
          refreshCalls.push(args);
          return {
            'plugin_plugin-beta': {
              value: {
                name: 'acme.beta',
              },
            },
          };
        }),
        '../../../../components/pluginAdminConfigurePage': {},
        '../../../../components/pluginMarketListPage': {},
        '../../../../components/installedPluginListPage': {
          getInstalledPluginListPageRender(args) {
            installedPageCalls.push(args);
            return {
              id: 'installedPluginListPage',
              plugins: args.pluginList.map((plugin) => plugin.id),
            };
          },
        },
        '../../../../lib/util': {
          getRcAccessToken() {
            return 'rc-token';
          },
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  extensionInfo: {
                    account: {
                      id: 'rc-account-1',
                    },
                  },
                },
              },
            };
          },
          showNotification() {},
        },
        axios: {
          async delete(url) {
            deleteCalls.push(url);
          },
        },
      },
    }
  );

  await pluginAdminConfigButtons.onEvent({
    data: {
      body: {
        button: {
          formData: {
            pluginId: 'plugin-alpha',
            plugin: pluginAlpha,
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    buttonId: 'removeButton',
  });

  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0].adminSettings.userSettings['plugin_plugin-alpha'].isRemoved, true);
  assert.equal(deleteCalls.length, 1);
  assert.ok(deleteCalls[0].includes('https://server.example.com/plugin/unregister?rcAccessToken=rc-token'));
  assert.ok(deleteCalls[0].includes('rcAccountId=rc-account-1'));
  assert.ok(deleteCalls[0].includes('pluginName=acme.alpha'));
  assert.ok(deleteCalls[0].includes('pluginId=plugin-alpha'));
  assert.deepEqual(refreshCalls, [
    {
      settingKeysToRemove: ['plugin_plugin-alpha'],
    },
  ]);
  assert.deepEqual(installedPageCalls, [
    {
      pluginList: [pluginBeta],
      isFromAdmin: true,
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
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'installedPluginListPage',
          plugins: ['plugin-beta'],
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/installedPluginListPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('admin plugin details submit saves field values and hides configured secret fields', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const adminSettings = {
    userSettings: {
      'plugin_plugin-alpha': {
        value: {
          config: {
            apiKey: {
              value: 'old-key',
              customizable: true,
            },
            secret: {
              value: null,
              customizable: false,
            },
          },
        },
      },
    },
  };
  global.chrome = {
    storage: {
      local: {
        async get(key) {
          assert.equal(key, 'adminSettings');
          return {
            adminSettings,
          };
        },
      },
    },
  };

  const uploadCalls = [];

  const pluginDetailsSettingPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginDetailsSettingPage.js',
    {
      stubs: {
        '../../../../core/user': {
          getPluginSetting(userSettings, pluginId) {
            return userSettings[`plugin_${pluginId}`].value;
          },
        },
        '../../../../core/admin': {
          async uploadAdminSettings(args) {
            uploadCalls.push(clone(args));
          },
        },
      },
    }
  );

  await pluginDetailsSettingPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            pluginId: 'plugin-alpha',
            hiddenConfigFields: ['secret'],
            apiKey: {
              value: 'new-key',
              customizable: true,
            },
            secret: {
              value: 'stored-secret',
              customizable: true,
            },
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: {
        userSettings: {
          'plugin_plugin-alpha': {
            value: {
              config: {
                apiKey: {
                  value: 'new-key',
                  customizable: true,
                },
                secret: {
                  value: 'stored-secret',
                  customizable: false,
                },
              },
            },
          },
        },
      },
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
