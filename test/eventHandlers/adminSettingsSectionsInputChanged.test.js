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

async function assertAdminUserSettingsSection({
  entryPoint,
  componentPath,
  renderMethod,
  pageId,
  adminUserSettings = {
    c2d: {
      value: true,
      customizable: false,
    },
  },
}) {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: adminUserSettings,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const section = await loadBundledModule(entryPoint, {
    stubs: {
      [componentPath]: {
        [renderMethod](args) {
          renderCalls.push(args);
          return {
            id: pageId,
            adminSettingKeys: Object.keys(args.adminUserSettings ?? {}),
          };
        },
      },
    },
  });

  await section.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      adminUserSettings,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: pageId,
          adminSettingKeys: Object.keys(adminUserSettings),
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: `/customized/${pageId}`,
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
}

test('simple admin settings sections render from admin user settings and navigate to their customized pages', async () => {
  const cases = [
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialMatcher.js',
      componentPath: '../../../../../components/admin/generalSettings/clickToDialMatcherSettingPage',
      renderMethod: 'getClickToDialMatcherSettingPageRender',
      pageId: 'clickToDialMatcherSettingPage',
    },
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/widgetSettings.js',
      componentPath: '../../../../../components/admin/generalSettings/widgetSettingsPage',
      renderMethod: 'getWidgetSettingsPageRender',
      pageId: 'widgetSettingsPage',
    },
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/notificationLevel.js',
      componentPath: '../../../../../components/admin/generalSettings/notificationLevelSettingPage',
      renderMethod: 'getNotificationLevelSettingPageRender',
      pageId: 'notificationLevelSettingPage',
    },
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/phoneNumberFormat.js',
      componentPath: '../../../../../components/admin/generalSettings/phoneNumberFormatPage',
      renderMethod: 'getPhoneNumberFormatPageRender',
      pageId: 'phoneNumberFormatPage',
    },
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialEmbed.js',
      componentPath: '../../../../../components/admin/generalSettings/clickToDialEmbedPage',
      renderMethod: 'getClickToDialEmbedPageRender',
      pageId: 'clickToDialEmbedPage',
    },
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callAndSMSLogging.js',
      componentPath: '../../../../../components/admin/managedSettings/callAndSMSLoggingSettingPage',
      renderMethod: 'getCallAndSMSLoggingSettingPageRender',
      pageId: 'callAndSMSLoggingSettingPage',
    },
    {
      entryPoint: 'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/advancedFeaturesSetting.js',
      componentPath: '../../../../../components/admin/managedSettings/advancedFeaturesSettingPage',
      renderMethod: 'getAdvancedFeaturesSettingPageRender',
      pageId: 'advancedFeaturesSettingPage',
    },
  ];

  for (const testCase of cases) {
    await assertAdminUserSettingsSection(testCase);
  }
});

test('customize tabs section passes admin settings, manifest, and platform name to the renderer', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        tabs: {
          value: ['contacts', 'reports'],
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const customizeTabs = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customizeTabs.js',
    {
      stubs: {
        '../../../../../components/admin/generalSettings/customizeTabsSettingPage': {
          getCustomizeTabsSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'customizeTabsSettingPage',
              platformName: args.platformName,
            };
          },
        },
      },
    }
  );

  const manifest = {
    platforms: {
      acme: {
        displayName: 'Acme CRM',
      },
    },
  };

  await customizeTabs.onEvent({
    data: {},
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: manifest.platforms.acme,
  });

  assert.deepEqual(renderCalls, [
    {
      adminUserSettings: {
        tabs: {
          value: ['contacts', 'reports'],
        },
      },
      manifest,
      platformName: 'acme',
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'customizeTabsSettingPage',
        platformName: 'acme',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/customizeTabsSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('contact setting section derives platform-specific field visibility before rendering', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        contactSetting: {
          value: true,
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const contactSetting = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/contactSetting.js',
    {
      stubs: {
        '../../../../../components/admin/managedSettings/contactSettingPage': {
          getContactSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'contactSettingPage',
              renderOverridingNumberFormat: args.renderOverridingNumberFormat,
              renderAllowExtensionNumberLogging: args.renderAllowExtensionNumberLogging,
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'insightly',
    enableExtensionNumberLoggingSetting: true,
  };

  await contactSetting.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'insightly',
    platform,
  });

  assert.deepEqual(renderCalls, [
    {
      adminUserSettings: {
        contactSetting: {
          value: true,
        },
      },
      renderOverridingNumberFormat: true,
      renderAllowExtensionNumberLogging: true,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'contactSettingPage',
        renderOverridingNumberFormat: true,
        renderAllowExtensionNumberLogging: true,
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/contactSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('custom settings section renders with CRM manifest, admin settings, and current user settings', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        customField: {
          value: 'admin-default',
        },
      },
    },
    userSettings: {
      customField: 'user-value',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const customSettings = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customSettings.js',
    {
      stubs: {
        '../../../../../components/admin/managedSettings/customSettingsPage': {
          getCustomSettingsPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'customSettingsPage',
              crmName: args.crmManifest.name,
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'acme',
    customSettings: [
      {
        const: 'customField',
      },
    ],
  };

  await customSettings.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(renderCalls, [
    {
      crmManifest: platform,
      adminUserSettings: {
        customField: {
          value: 'admin-default',
        },
      },
      userSettings: {
        customField: 'user-value',
      },
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'customSettingsPage',
        crmName: 'acme',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/customSettingsPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('call log details section verifies server-side logging subscription before rendering locked settings', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        serverSideLogging: {
          enable: true,
        },
      },
    },
    userPermissions: {
      callLog: false,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const subscriptionCalls = [];
  const renderCalls = [];

  const callLogDetailsSetting = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.js',
    {
      stubs: {
        '../../../../../components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage': {
          getCallLogDetailsSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'callLogDetailsSettingPage',
              serverSideLoggingSubscribed: args.serverSideLoggingSubscribed,
              canCallLog: args.userPermissions.callLog,
            };
          },
        },
        '../../../../../core/admin': {
          async getServerSideLogging(args) {
            subscriptionCalls.push(args);
            return {
              subscribed: true,
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'acme',
  };

  await callLogDetailsSetting.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(subscriptionCalls, [{ platform }]);
  assert.deepEqual(renderCalls, [
    {
      adminUserSettings: {
        serverSideLogging: {
          enable: true,
        },
      },
      userPermissions: {
        callLog: false,
      },
      serverSideLoggingSubscribed: true,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'callLogDetailsSettingPage',
        serverSideLoggingSubscribed: true,
        canCallLog: false,
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/callLogDetailsSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('auto-log preferences section falls back to a generic Contact type when platform contact types are absent', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userSettings: {
        autoLog: {
          value: true,
        },
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const renderCalls = [];

  const autoLogPreferences = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/autoLogPreferences.js',
    {
      stubs: {
        '../../../../../components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage': {
          getAutoLogPreferenceSettingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'autoLogPreferenceSettingPage',
              contactTypes: args.contactTypes,
            };
          },
        },
      },
    }
  );

  await autoLogPreferences.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {
      name: 'acme',
    },
  });

  assert.deepEqual(renderCalls, [
    {
      adminUserSettings: {
        autoLog: {
          value: true,
        },
      },
      contactTypes: [
        {
          value: 'contact',
          display: 'Contact',
        },
      ],
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'autoLogPreferenceSettingPage',
        contactTypes: [
          {
            value: 'contact',
            display: 'Contact',
          },
        ],
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/autoLogPreferenceSettingPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('appearance section registers the appearance settings page without storage dependencies', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const appearance = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/appearance.js',
    {
      stubs: {
        '../../../../../components/admin/generalSettings/appearancePage': {
          getAppearancePageRender() {
            return {
              id: 'appearancePage',
              title: 'Appearance',
            };
          },
        },
      },
    }
  );

  await appearance.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'appearancePage',
        title: 'Appearance',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/appearancePage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('managed OAuth section registers the managed OAuth admin page', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const managedOAuth = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedOAuth.js',
    {
      stubs: {
        '../../../../../components/admin/managedOAuthAdminPage': {
          getManagedOAuthAdminPageRender() {
            return {
              id: 'managedOAuthAdminPage',
              title: 'Managed OAuth',
            };
          },
        },
      },
    }
  );

  await managedOAuth.onEvent({
    data: {},
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'managedOAuthAdminPage',
        title: 'Managed OAuth',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/managedOAuthAdminPage',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('Google Sheets admin config section refreshes admin settings before rendering the admin config page', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const refreshedAdminSettings = {
    userSettings: {
      googleSheetsName: {
        value: 'Team Sheet',
      },
    },
  };
  const refreshCalls = [];
  const renderCalls = [];

  const googleSheetsAdminConfig = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/googleSheetsAdminConfig.js',
    {
      stubs: {
        '../../../../../core/admin': {
          async refreshAdminSettings() {
            refreshCalls.push({});
            return {
              adminSettings: refreshedAdminSettings,
            };
          },
        },
        '../../../../../components/admin/adminGoogleSheetsPage': {
          renderAdminGoogleSheetsPage(args) {
            renderCalls.push(args);
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

  await googleSheetsAdminConfig.onEvent({
    data: {},
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(refreshCalls, [{}]);
  assert.deepEqual(renderCalls, [
    {
      manifest,
      adminSettings: refreshedAdminSettings,
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'adminGoogleSheetsPage',
        sheetName: 'Team Sheet',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/adminGoogleSheetsPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('user mapping section refreshes server mappings, stores compact admin mappings, uploads them, and opens the mapping page', async () => {
  const storage = createChromeStorage({
    adminSettings: {
      userMappings: [],
      userSettings: {},
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const getUserMappingCalls = [];
  const uploadCalls = [];
  const renderCalls = [];

  const userMapping = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/userMapping.js',
    {
      stubs: {
        '../../../../../core/admin': {
          async getUserMapping(args) {
            getUserMappingCalls.push(args);
            return [
              {
                crmUser: {
                  id: 'crm-user-1',
                  name: 'Ada Lovelace',
                },
                rcUser: [
                  {
                    extensionId: 'rc-ext-1',
                  },
                  {
                    extensionId: 'rc-ext-2',
                  },
                ],
              },
              {
                crmUser: {
                  id: 'crm-user-2',
                  name: 'Grace Hopper',
                },
                rcUser: null,
              },
            ];
          },
          async uploadAdminSettings(args) {
            uploadCalls.push(args);
          },
        },
        '../../../../../components/admin/userMappingPage/userMappingPage': {
          getUserMappingPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'userMappingPage',
              userCount: args.userMapping.length,
              platformDisplayName: args.platformDisplayName,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const platform = {
    displayName: 'Acme CRM',
  };

  await userMapping.onEvent({
    data: {},
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform,
  });

  const expectedAdminSettings = {
    userMappings: [
      {
        crmUserId: 'crm-user-1',
        rcExtensionId: ['rc-ext-1', 'rc-ext-2'],
      },
      {
        crmUserId: 'crm-user-2',
        rcExtensionId: [],
      },
    ],
    userSettings: {},
  };
  assert.deepEqual(storage.store.adminSettings, expectedAdminSettings);
  assert.deepEqual(getUserMappingCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(uploadCalls, [
    {
      serverUrl: 'https://server.example.com',
      adminSettings: expectedAdminSettings,
    },
  ]);
  assert.deepEqual(renderCalls, [
    {
      userMapping: [
        {
          crmUser: {
            id: 'crm-user-1',
            name: 'Ada Lovelace',
          },
          rcUser: [
            {
              extensionId: 'rc-ext-1',
            },
            {
              extensionId: 'rc-ext-2',
            },
          ],
        },
        {
          crmUser: {
            id: 'crm-user-2',
            name: 'Grace Hopper',
          },
          rcUser: null,
        },
      ],
      platformDisplayName: 'Acme CRM',
    },
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'userMappingPage',
        userCount: 2,
        platformDisplayName: 'Acme CRM',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/userMappingPage',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
