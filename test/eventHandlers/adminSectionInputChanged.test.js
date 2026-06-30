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

test('admin installed plugins section skips stale plugin settings that are no longer in the manifest list', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        plugin_alpha: {
          value: {
            requireLicense: true,
          },
        },
        plugin_removed: {
          value: {
            requireLicense: true,
          },
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const licenseCalls = [];
  const renderCalls = [];

  const installedPlugins = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/installedPlugins.js',
    {
      stubs: {
        '../../../../../components/installedPluginListPage': {
          getInstalledPluginListPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'installedPluginListPage',
              pluginIds: args.pluginList.map((plugin) => plugin.id),
              isFromAdmin: args.isFromAdmin,
            };
          },
        },
        '../../../../../service/manifestService': {
          async getPluginList() {
            return [
              {
                id: 'alpha',
                displayName: 'Alpha plugin',
              },
            ];
          },
        },
        '../../../../../core/user': {
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
        '../../../../../service/pluginService': {
          async getPluginLicenseStatus(args) {
            licenseCalls.push(args);
            return {
              id: args.pluginId,
              licenseStatus: 'active',
              licenseStatusDescription: 'Ready',
              errorMessage: '',
            };
          },
        },
      },
    }
  );

  await installedPlugins.onEvent({
    data: {
      body: {
        formData: {
          section: 'plugins',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(licenseCalls, [
    {
      pluginId: 'alpha',
      plugin: {
        id: 'alpha',
        displayName: 'Alpha plugin',
        requireLicense: true,
        licenseStatus: 'active',
        licenseStatusDescription: 'Ready',
        errorMessage: '',
      },
    },
  ]);
  assert.deepEqual(renderCalls, [
    {
      pluginList: [
        {
          id: 'alpha',
          displayName: 'Alpha plugin',
          requireLicense: true,
          licenseStatus: 'active',
          licenseStatusDescription: 'Ready',
          errorMessage: '',
        },
      ],
      isFromAdmin: true,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'installedPluginListPage',
          pluginIds: ['alpha'],
          isFromAdmin: true,
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

test('general settings section registers the general settings page and navigates to it', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const generalSettings = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/generalSettings.js',
    {
      stubs: {
        '../../../../../components/admin/generalSettingPage': {
          getGeneralSettingPageRender() {
            return {
              id: 'generalSettingPage',
              title: 'General settings',
            };
          },
        },
      },
    }
  );

  await generalSettings.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'generalSettingPage',
          title: 'General settings',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/generalSettingPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('managed settings section renders with the current platform manifest and wraps navigation in loading state', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const managedSettings = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedSettings.js',
    {
      stubs: {
        '../../../../../components/admin/managedSettingsPage': {
          getManagedSettingsPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'managedSettingsPage',
              platformName: args.crmManifest.name,
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'acme',
    displayName: 'Acme CRM',
  };

  await managedSettings.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(renderCalls, [
    {
      crmManifest: platform,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'managedSettingsPage',
        platformName: 'acme',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/managedSettingsPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('server-side logging section renders subscription state, user mapping support, additional fields, and user permissions', async () => {
  const storage = createChromeStorage({
    implementedInterfaces: {
      getUserList: true,
    },
    userPermissions: {
      c2sms: false,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const subscriptionCalls = [];
  const additionalFieldCalls = [];
  const renderCalls = [];

  const serverSideLoggingSetting = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/serverSideLoggingSetting.js',
    {
      stubs: {
        '../../../../../core/admin': {
          async getServerSideLogging(args) {
            subscriptionCalls.push(args);
            return {
              subscribed: true,
              subscriptionLevel: 'Account',
              doNotLogNumbers: ['+15550100'],
              loggingByAdmin: true,
              sources: ['ex', 'rc'],
            };
          },
          async getServerSideLoggingAdditionalFieldValues(args) {
            additionalFieldCalls.push(args);
            return {
              region: 'west',
            };
          },
        },
        '../../../../../components/admin/serverSideLoggingPage': {
          getServerSideLoggingSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'serverSideLoggingSettingPage',
              subscriptionLevel: args.subscriptionLevel,
              enableUserMapping: args.enableUserMapping,
            };
          },
        },
      },
    }
  );

  const platform = {
    serverSideLogging: {
      additionalFields: [
        {
          const: 'region',
          title: 'Region',
        },
      ],
    },
  };

  await serverSideLoggingSetting.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(subscriptionCalls, [{ platform }]);
  assert.deepEqual(additionalFieldCalls, [{ platform }]);
  assert.deepEqual(renderCalls, [
    {
      subscriptionLevel: 'Account',
      doNotLogNumbers: ['+15550100'],
      loggingByAdmin: true,
      subscribedByOtherAdmin: undefined,
      enableUserMapping: true,
      additionalFields: [
        {
          const: 'region',
          title: 'Region',
        },
      ],
      additionalFieldValues: {
        region: 'west',
      },
      sources: ['ex', 'rc'],
      userPermissions: {
        c2sms: false,
      },
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'serverSideLoggingSettingPage',
        subscriptionLevel: 'Account',
        enableUserMapping: true,
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/serverSideLoggingSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('managed auth user section filters RingCentral contacts to users and departments before rendering', async () => {
  const storage = createChromeStorage({
    managedAuthSettings: {
      userFields: [
        {
          const: 'apiKey',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'rc-user-1',
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const managedAuthUser = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthUser.js',
    {
      stubs: {
        '../../../../../components/admin/managedAuthUserPage': {
          getManagedAuthUserPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'managedAuthUserPage',
              rcExtensionIds: args.rcExtensions.map((rc) => rc.id),
              searchWord: args.searchWord,
              filter: args.filter,
            };
          },
        },
        '../../../../../lib/util': {
          async getRcContactInfo() {
            return [
              {
                id: 'rc-user-1',
                type: 'User',
              },
              {
                id: 'rc-dept-1',
                type: 'Department',
              },
              {
                id: 'rc-site-1',
                type: 'Site',
              },
            ];
          },
        },
      },
    }
  );

  await managedAuthUser.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      userFields: [
        {
          const: 'apiKey',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'rc-user-1',
        },
      ],
      rcExtensions: [
        {
          id: 'rc-user-1',
          type: 'User',
        },
        {
          id: 'rc-dept-1',
          type: 'Department',
        },
      ],
      searchWord: '',
      filter: 'All',
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'managedAuthUserPage',
        rcExtensionIds: ['rc-user-1', 'rc-dept-1'],
        searchWord: '',
        filter: 'All',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/managedAuthUserPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('managed auth user page input change preserves search and filter while filtering RingCentral contacts', async () => {
  const storage = createChromeStorage({
    managedAuthSettings: {
      userFields: [
        {
          const: 'token',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'rc-dept-1',
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const managedAuthUserPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserPage.js',
    {
      stubs: {
        '../../../../../components/admin/managedAuthUserPage': {
          getManagedAuthUserPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'managedAuthUserPage',
              rcExtensionIds: args.rcExtensions.map((rc) => rc.id),
              searchWord: args.searchWord,
              filter: args.filter,
            };
          },
        },
        '../../../../../lib/util': {
          async getRcContactInfo() {
            return [
              {
                id: 'rc-user-1',
                type: 'User',
              },
              {
                id: 'rc-dept-1',
                type: 'Department',
              },
              {
                id: 'rc-callqueue-1',
                type: 'CallQueue',
              },
            ];
          },
        },
      },
    }
  );

  await managedAuthUserPage.onEvent({
    data: {
      body: {
        formData: {
          userSearch: {
            search: 'Ada',
            filter: 'Configured',
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      userFields: [
        {
          const: 'token',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'rc-dept-1',
        },
      ],
      rcExtensions: [
        {
          id: 'rc-user-1',
          type: 'User',
        },
        {
          id: 'rc-dept-1',
          type: 'Department',
        },
      ],
      searchWord: 'Ada',
      filter: 'Configured',
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'managedAuthUserPage',
        rcExtensionIds: ['rc-user-1', 'rc-dept-1'],
        searchWord: 'Ada',
        filter: 'Configured',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/managedAuthUserPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('managed auth user edit page re-renders the selected extension without navigating away', async () => {
  const storage = createChromeStorage({
    managedAuthSettings: {
      userFields: [
        {
          const: 'apiSecret',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'rc-user-1',
          apiSecret: 'stored',
        },
      ],
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const managedAuthUserEditPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserEditPage.js',
    {
      stubs: {
        '../../../../../components/admin/managedAuthUserEditPage': {
          getManagedAuthUserEditPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'managedAuthUserEditPage',
              rcExtensionId: args.rcExtension.id,
              searchWord: args.searchWord,
              filter: args.filter,
            };
          },
        },
        '../../../../../lib/util': {
          async getRcContactInfo() {
            return [
              {
                id: 'rc-user-1',
                type: 'User',
                name: 'Ada Lovelace',
              },
              {
                id: 'rc-site-1',
                type: 'Site',
              },
            ];
          },
        },
      },
    }
  );

  const formData = {
    rcExtensionId: 'rc-user-1',
    apiSecret: 'updated',
    searchWord: 'Ada',
    filter: 'Configured',
  };

  await managedAuthUserEditPage.onEvent({
    data: {
      body: {
        formData,
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      userFields: [
        {
          const: 'apiSecret',
        },
      ],
      userValues: [
        {
          rcExtensionId: 'rc-user-1',
          apiSecret: 'stored',
        },
      ],
      rcExtension: {
        id: 'rc-user-1',
        type: 'User',
        name: 'Ada Lovelace',
      },
      formData,
      searchWord: 'Ada',
      filter: 'Configured',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'managedAuthUserEditPage',
          rcExtensionId: 'rc-user-1',
          searchWord: 'Ada',
          filter: 'Configured',
        },
      },
      targetOrigin: undefined,
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('plugin admin settings page loads selected plugin details and rebuilds the admin detail page', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        plugin_alpha: {
          value: {
            id: 'alpha',
            config: {
              apiKey: {
                value: 'stored-key',
                customizable: true,
              },
            },
          },
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const detailCalls = [];
  const renderCalls = [];

  const pluginAdminSettingsPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/pluginAdminSettingsPage.js',
    {
      stubs: {
        '../../../../../service/manifestService': {
          async getPluginDetails(args) {
            detailCalls.push(args);
            return {
              id: 'alpha',
              pageContent: [
                {
                  const: 'apiKey',
                },
              ],
            };
          },
        },
        '../../../../../components/admin/managedSettings/pluginsSetting/pluginDetailsSettingPage': {
          getPluginDetailsSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'pluginDetailsSettingPage',
              pluginId: args.pluginId,
              detailId: args.pluginDetails.id,
            };
          },
        },
        '../../../../../core/user': {
          getPluginSetting(userSettings, pluginId) {
            return userSettings[`plugin_${pluginId}`]?.value;
          },
        },
      },
    }
  );

  await pluginAdminSettingsPage.onEvent({
    data: {
      body: {
        formData: {
          section: 'alpha',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
    pluginId: 'alpha',
  });

  const selectedPlugin = storage.store.adminSettings.userSettings.plugin_alpha.value;
  assert.deepEqual(detailCalls, [
    {
      pluginId: 'alpha',
      selectedPlugin,
    },
  ]);
  assert.deepEqual(renderCalls, [
    {
      pluginId: 'alpha',
      plugin: selectedPlugin,
      pluginDetails: {
        id: 'alpha',
        pageContent: [
          {
            const: 'apiKey',
          },
        ],
      },
      pluginSetting: selectedPlugin,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'pluginDetailsSettingPage',
        pluginId: 'alpha',
        detailId: 'alpha',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/pluginDetailsSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('managed authentication section fetches managed auth settings and renders available org/user capabilities', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const managedAuthCalls = [];
  const renderCalls = [];

  const managedAuthentication = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthentication.js',
    {
      stubs: {
        '../../../../../core/admin': {
          async getManagedAuthSettings(args) {
            managedAuthCalls.push(args);
            return {
              orgFields: [
                {
                  const: 'tenantId',
                },
              ],
              userFields: [
                {
                  const: 'apiKey',
                },
              ],
            };
          },
        },
        '../../../../../components/admin/managedAuthenticationPage': {
          getManagedAuthenticationPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'managedAuthenticationPage',
              hasOrgFields: args.hasOrgFields,
              hasUserFields: args.hasUserFields,
            };
          },
        },
      },
    }
  );

  await managedAuthentication.onEvent({
    data: {},
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(managedAuthCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(renderCalls, [
    {
      hasOrgFields: true,
      hasUserFields: true,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'managedAuthenticationPage',
        hasOrgFields: true,
        hasUserFields: true,
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/managedAuthenticationPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('managed auth org section re-renders org fields with stored values and current form data', async () => {
  const storage = createChromeStorage({
    managedAuthSettings: {
      orgFields: [
        {
          const: 'tenantId',
        },
      ],
      orgValues: {
        tenantId: 'stored-tenant',
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const managedAuthOrg = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthOrg.js',
    {
      stubs: {
        '../../../../../components/admin/managedAuthOrgPage': {
          getManagedAuthOrgPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'managedAuthOrgPage',
              tenantId: args.formData.tenantId,
            };
          },
        },
      },
    }
  );

  const formData = {
    tenantId: 'edited-tenant',
  };

  await managedAuthOrg.onEvent({
    data: {
      body: {
        formData,
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      orgFields: [
        {
          const: 'tenantId',
        },
      ],
      orgValues: {
        tenantId: 'stored-tenant',
      },
      formData,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'managedAuthOrgPage',
        tenantId: 'edited-tenant',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/managedAuthOrgPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('plugins admin config section lists only installed plugins that still exist in the plugin catalog', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        plugin_alpha: {
          value: {
            id: 'alpha',
          },
        },
        plugin_removed: {
          value: {
            id: 'removed',
          },
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const pluginsAdminConfig = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/pluginsAdminConfig.js',
    {
      stubs: {
        '../../../../../components/admin/managedSettings/pluginsSettingPage': {
          getPluginsSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'pluginsSettingPage',
              installedPluginIds: args.installedPluginList.map((plugin) => plugin.id),
            };
          },
        },
        '../../../../../service/manifestService': {
          async getPluginList() {
            return [
              {
                id: 'alpha',
                displayName: 'Alpha plugin',
              },
            ];
          },
        },
        '../../../../../core/user': {
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
      },
    }
  );

  await pluginsAdminConfig.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      installedPluginList: [
        {
          id: 'alpha',
          displayName: 'Alpha plugin',
        },
      ],
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'pluginsSettingPage',
        installedPluginIds: ['alpha'],
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/pluginsSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});
