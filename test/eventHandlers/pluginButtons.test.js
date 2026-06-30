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

function createPlugin(overrides = {}) {
  return {
    id: 'plugin-alpha',
    access: 'public',
    name: 'acme.alpha',
    displayName: 'Acme Alpha',
    version: '1.2.3',
    isAsync: true,
    phase: 'afterLog',
    supportedLogTypes: ['call'],
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
    ],
    ...overrides,
  };
}

test('select plugin stops on unauthorized CRM user and does not open plugin configuration', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const notifications = [];

  const selectPlugin = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.js',
    {
      stubs: {
        '../../../../core/auth': {
          async checkAuth() {
            return false;
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../core/user': {},
        '../../../../service/manifestService': {},
        '../../../../service/pluginService': {},
        '../../../../components/pluginAdminConfigurePage': {},
        '../../../../components/pluginConfigurePage': {},
        axios: {},
      },
    }
  );

  await selectPlugin.onEvent({
    data: {
      body: {
        formData: {
          plugins: 'plugin-alpha=public',
        },
      },
    },
    manifest: {
      platforms: {
        salesforce: {
          displayName: 'Salesforce',
        },
      },
    },
    platformName: 'salesforce',
  });

  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Please go to user settings page and connect to your Salesforce account.',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(widgetMessages, []);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('select plugin opens user configuration with auth and license state from plugin services', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pluginSummary = createPlugin({
    id: 'plugin-alpha',
    access: 'shared',
  });
  const pluginDetails = createPlugin({
    id: 'plugin-alpha',
    access: 'shared',
    showAuthorizationButton: true,
    authStateUrl: 'https://plugin.example.com/auth/state',
    requireLicense: true,
  });
  const notifications = [];
  const userSettingsCalls = [];
  const configurePageCalls = [];
  const licenseCalls = [];
  const axiosGets = [];

  const selectPlugin = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.js',
    {
      stubs: {
        '../../../../core/auth': {
          async checkAuth() {
            return true;
          },
        },
        '../../../../core/user': {
          async getUserSettingsOnline(args) {
            userSettingsCalls.push(args);
            return {
              [`plugin_${pluginSummary.id}`]: {
                value: {
                  config: {
                    apiKey: {
                      value: 'stored-key',
                    },
                  },
                },
              },
            };
          },
          getPluginSetting(userSettings, pluginId) {
            return userSettings[`plugin_${pluginId}`]?.value;
          },
        },
        '../../../../service/manifestService': {
          async getPluginDetails(args) {
            assert.deepEqual(args, {
              selectedPlugin: pluginSummary,
            });
            return pluginDetails;
          },
        },
        '../../../../service/pluginService': {
          async getPluginLicenseStatus(args) {
            licenseCalls.push(args);
            return {
              id: args.pluginId,
              licenseStatus: true,
              licenseStatusDescription: 'Active',
            };
          },
        },
        '../../../../components/pluginConfigurePage': {
          getPluginConfigurePageRender(args) {
            configurePageCalls.push(args);
            return {
              id: 'pluginConfigurePage',
              pluginId: args.pluginId,
              isLoggedIn: args.isLoggedIn,
              hasValidLicense: args.hasValidLicense,
            };
          },
        },
        '../../../../components/pluginAdminConfigurePage': {},
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        axios: {
          async get(url) {
            axiosGets.push(url);
            return {
              data: {
                successful: true,
                returnMessage: {
                  messageType: 'success',
                  message: 'Plugin connected.',
                },
              },
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      salesforce: {
        displayName: 'Salesforce',
      },
    },
  };

  await selectPlugin.onEvent({
    data: {
      body: {
        formData: {
          pluginList: [pluginSummary],
        },
      },
    },
    manifest,
    platformName: 'salesforce',
    listButtonItemId: 'plugin-alpha=shared',
  });

  assert.deepEqual(userSettingsCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(axiosGets, ['https://plugin.example.com/auth/state']);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Plugin connected.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(licenseCalls, [
    {
      pluginId: 'plugin-alpha',
      plugin: pluginDetails,
    },
  ]);
  assert.deepEqual(configurePageCalls, [
    {
      pluginId: 'plugin-alpha',
      pluginAccess: 'shared',
      plugin: pluginDetails,
      config: {
        apiKey: {
          value: 'stored-key',
        },
      },
      isLoggedIn: true,
      hasValidLicense: true,
      licenseStatusDescription: 'Active',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'pluginConfigurePage',
          pluginId: 'plugin-alpha',
          isLoggedIn: true,
          hasValidLicense: true,
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
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('installed plugin list keeps installed plugins, enriches license status, and navigates to the list page', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pluginAlpha = createPlugin({
    id: 'plugin-alpha',
    requireLicense: true,
  });
  const pluginBeta = createPlugin({
    id: 'plugin-beta',
    name: 'acme.beta',
    displayName: 'Acme Beta',
  });
  const pageCalls = [];
  const licenseCalls = [];

  const installedPluginListPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/installedPluginListPage.js',
    {
      stubs: {
        '../../../../core/user': {
          async getUserSettingsOnline(args) {
            assert.deepEqual(args, {
              serverUrl: 'https://server.example.com',
            });
            return {
              'plugin_plugin-alpha': {
                value: {
                  requireLicense: true,
                },
              },
              plugin_missing: {
                value: {},
              },
            };
          },
          getAllPluginSettings(userSettings) {
            const result = {};
            for (const key of Object.keys(userSettings)) {
              if (key.startsWith('plugin_')) {
                result[key.slice('plugin_'.length)] = userSettings[key].value;
              }
            }
            return result;
          },
        },
        '../../../../service/manifestService': {
          async getPluginList() {
            return [pluginAlpha, pluginBeta];
          },
        },
        '../../../../service/pluginService': {
          async getPluginLicenseStatus(args) {
            licenseCalls.push(args);
            return {
              id: args.pluginId,
              licenseStatus: false,
              licenseStatusDescription: 'Missing license',
              errorMessage: 'License required',
            };
          },
        },
        '../../../../components/installedPluginListPage': {
          getInstalledPluginListPageRender(args) {
            pageCalls.push(args);
            return {
              id: 'installedPluginListPage',
              plugins: args.pluginList.map((plugin) => ({
                id: plugin.id,
                licenseStatus: plugin.licenseStatus,
              })),
            };
          },
        },
      },
    }
  );

  await installedPluginListPage.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(licenseCalls, [
    {
      pluginId: 'plugin-alpha',
      plugin: {
        ...pluginAlpha,
        requireLicense: true,
      },
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      pluginList: [
        {
          ...pluginAlpha,
          requireLicense: true,
          licenseStatus: false,
          licenseStatusDescription: 'Missing license',
          errorMessage: 'License required',
        },
      ],
      isFromAdmin: false,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'installedPluginListPage',
          plugins: [
            {
              id: 'plugin-alpha',
              licenseStatus: false,
            },
          ],
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

test('plugin configuration submit saves merged user settings with RingCentral account scope', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const refreshCalls = [];
  const notifications = [];
  const mergeCalls = [];

  const pluginConfigurePageSubmit = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigurePageSubmit.js',
    {
      stubs: {
        '../../../../core/user': {
          async refreshUserSettings(args) {
            refreshCalls.push(args);
            return {
              userSettings: {},
            };
          },
        },
        '../../../../lib/util': {
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
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../components/pluginConfigurePage': {
          getMergedPluginConfigFromFormData(formData) {
            mergeCalls.push(formData);
            return {
              apiKey: {
                value: 'new-key',
              },
            };
          },
        },
      },
    }
  );

  const plugin = createPlugin();
  const formData = {
    pluginId: 'plugin-alpha',
    plugin,
    isAsync: true,
    phase: 'afterLog',
    access: 'public',
    logTypes: ['call'],
    config: {
      apiKey: 'new-key',
    },
  };

  await pluginConfigurePageSubmit.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
  });

  assert.deepEqual(mergeCalls, [formData]);
  assert.deepEqual(refreshCalls, [
    {
      changedSettings: {
        'plugin_plugin-alpha': {
          value: {
            name: 'acme.alpha',
            version: '1.2.3',
            isAsync: true,
            phase: 'afterLog',
            access: 'public',
            supportedLogTypes: ['call'],
            rcAccountId: 'rc-account-1',
            config: {
              apiKey: {
                value: 'new-key',
              },
            },
          },
          isCustomizable: true,
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
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Configuration is updated.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('plugin license refresh reloads license state and registers the updated configuration page', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const licenseCalls = [];
  const mergeCalls = [];
  const pageCalls = [];

  const pluginLicenseRefreshButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginLicenseRefreshButton.js',
    {
      stubs: {
        '../../../../service/pluginService': {
          async getPluginLicenseStatus(args) {
            licenseCalls.push(args);
            return {
              id: args.pluginId,
              licenseStatus: true,
              licenseStatusDescription: 'Active',
            };
          },
        },
        '../../../../components/pluginConfigurePage': {
          getMergedPluginConfigFromFormData(formData) {
            mergeCalls.push(formData);
            return {
              apiKey: {
                value: 'stored-key',
              },
            };
          },
          getPluginConfigurePageRender(args) {
            pageCalls.push(args);
            return {
              id: 'pluginConfigurePage',
              hasValidLicense: args.hasValidLicense,
              licenseStatusDescription: args.licenseStatusDescription,
            };
          },
        },
      },
    }
  );

  const plugin = createPlugin({
    requireLicense: true,
  });
  const formData = {
    pluginId: 'plugin-alpha',
    access: 'public',
    plugin,
    isLoggedIn: false,
    config: {
      apiKey: 'stored-key',
    },
  };

  await pluginLicenseRefreshButton.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
  });

  assert.deepEqual(licenseCalls, [
    {
      pluginId: 'plugin-alpha',
      plugin,
    },
  ]);
  assert.deepEqual(mergeCalls, [formData]);
  assert.deepEqual(pageCalls, [
    {
      pluginId: 'plugin-alpha',
      pluginAccess: 'public',
      plugin,
      config: {
        apiKey: {
          value: 'stored-key',
        },
      },
      isLoggedIn: false,
      hasValidLicense: true,
      licenseStatusDescription: 'Active',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'pluginConfigurePage',
          hasValidLicense: true,
          licenseStatusDescription: 'Active',
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


test('plugin auth button opens third-party OAuth and caches the current config form', async () => {
  const storage = createChromeStorage({});
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const axiosGets = [];
  const oauthWindows = [];

  const pluginConfigButtons = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.js',
    {
      stubs: {
        axios: {
          async get(url) {
            axiosGets.push(url);
            return {
              data: {
                authUrl: 'https://plugin.example.com/oauth/authorize',
              },
            };
          },
        },
        '../../../../core/auth': {
          handleThirdPartyOAuthWindow(authUri) {
            oauthWindows.push(authUri);
          },
        },
        '../../../../lib/util': {
          showNotification() {},
        },
        '../../../../i18n': {
          t(key) {
            return key;
          },
        },
        '../../../../components/pluginConfigurePage': {},
        '../../../../service/pluginService': {},
      },
    }
  );

  const formData = {
    pluginId: 'plugin-alpha',
    plugin: {
      authorizationUrl: 'https://plugin.example.com/oauth/start',
    },
    config: {
      apiKey: 'stored-key',
    },
  };

  await pluginConfigButtons.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
    buttonId: 'pluginAuthButton',
  });

  assert.deepEqual(axiosGets, ['https://plugin.example.com/oauth/start?pluginId=plugin-alpha']);
  assert.deepEqual(oauthWindows, ['https://plugin.example.com/oauth/authorize']);
  assert.deepEqual(storage.store.cachedPluginConfigFormData, formData);
  assert.deepEqual(widgetMessages, []);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('plugin logout clears plugin auth state, reports success, and refreshes configuration page', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const axiosPosts = [];
  const notifications = [];
  const licenseCalls = [];
  const mergeCalls = [];
  const pageCalls = [];

  const pluginConfigButtons = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.js',
    {
      stubs: {
        axios: {
          async post(url, body) {
            axiosPosts.push({ url, body });
            return {
              data: {
                successful: true,
              },
            };
          },
        },
        '../../../../core/auth': {},
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../../i18n': {
          t(key) {
            return key;
          },
        },
        '../../../../service/pluginService': {
          async getPluginLicenseStatus(args) {
            licenseCalls.push(args);
            return {
              id: args.pluginId,
              licenseStatus: true,
              licenseStatusDescription: 'Active',
            };
          },
        },
        '../../../../components/pluginConfigurePage': {
          getMergedPluginConfigFromFormData(formData) {
            mergeCalls.push(formData);
            return {
              apiKey: {
                value: 'stored-key',
              },
            };
          },
          getPluginConfigurePageRender(args) {
            pageCalls.push(args);
            return {
              id: 'pluginConfigurePage',
              isLoggedIn: args.isLoggedIn,
              hasValidLicense: args.hasValidLicense,
            };
          },
        },
      },
    }
  );

  const plugin = createPlugin({
    logoutUrl: 'https://plugin.example.com/logout',
    requireLicense: true,
  });
  const formData = {
    pluginId: 'plugin-alpha',
    access: 'public',
    plugin,
    existingConfig: {
      apiKey: {
        value: 'stored-key',
      },
    },
    config: {},
  };

  await pluginConfigButtons.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
    buttonId: 'pluginLogoutButton',
  });

  assert.deepEqual(axiosPosts, [
    {
      url: 'https://plugin.example.com/logout',
      body: {
        jwtToken: 'crm-jwt',
      },
    },
  ]);
  assert.deepEqual(licenseCalls, [
    {
      pluginId: 'plugin-alpha',
      plugin,
    },
  ]);
  assert.deepEqual(mergeCalls, [formData]);
  assert.deepEqual(pageCalls, [
    {
      pluginId: 'plugin-alpha',
      pluginAccess: 'public',
      plugin,
      config: {
        apiKey: {
          value: 'stored-key',
        },
      },
      isLoggedIn: false,
      hasValidLicense: true,
      licenseStatusDescription: 'Active',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'notifications.success.loggedOut',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'pluginConfigurePage',
          isLoggedIn: false,
          hasValidLicense: true,
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
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
