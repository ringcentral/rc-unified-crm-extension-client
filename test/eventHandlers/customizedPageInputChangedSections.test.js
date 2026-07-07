import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const simpleSectionMocks = [
  ['../../src/components/admin/generalSettingPage.js', 'getGeneralSettingPageRender', 'generalSettingPage'],
  ['../../src/components/admin/managedSettingsPage.js', 'getManagedSettingsPageRender', 'managedSettingsPage'],
  ['../../src/components/admin/generalSettings/appearancePage.js', 'getAppearancePageRender', 'appearancePage'],
  ['../../src/components/admin/generalSettings/clickToDialMatcherSettingPage.js', 'getClickToDialMatcherSettingPageRender', 'clickToDialMatcherSettingPage'],
  ['../../src/components/admin/generalSettings/customizeTabsSettingPage.js', 'getCustomizeTabsSettingPageRender', 'customizeTabsSettingPage'],
  ['../../src/components/admin/generalSettings/widgetSettingsPage.js', 'getWidgetSettingsPageRender', 'widgetSettingsPage'],
  ['../../src/components/admin/generalSettings/notificationLevelSettingPage.js', 'getNotificationLevelSettingPageRender', 'notificationLevelSettingPage'],
  ['../../src/components/admin/generalSettings/phoneNumberFormatPage.js', 'getPhoneNumberFormatPageRender', 'phoneNumberFormatPage'],
  ['../../src/components/admin/generalSettings/clickToDialEmbedPage.js', 'getClickToDialEmbedPageRender', 'clickToDialEmbedPage'],
  ['../../src/components/admin/managedSettings/callAndSMSLoggingSettingPage.js', 'getCallAndSMSLoggingSettingPageRender', 'callAndSMSLoggingSettingPage'],
  ['../../src/components/admin/managedSettings/contactSettingPage.js', 'getContactSettingPageRender', 'contactSettingPage'],
  ['../../src/components/admin/managedSettings/advancedFeaturesSettingPage.js', 'getAdvancedFeaturesSettingPageRender', 'advancedFeaturesSettingPage'],
  ['../../src/components/admin/managedSettings/customSettingsPage.js', 'getCustomSettingsPageRender', 'customSettingsPage'],
  ['../../src/components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage.js', 'getAutoLogPreferenceSettingPageRender', 'autoLogPreferenceSettingPage'],
  ['../../src/components/admin/managedOAuthAdminPage.js', 'getManagedOAuthAdminPageRender', 'managedOAuthAdminPage'],
  ['../../src/components/admin/managedAuthOrgPage.js', 'getManagedAuthOrgPageRender', 'managedAuthOrgPage'],
];

async function loadSectionHandler(modulePath, overrides = {}) {
  vi.resetModules();

  const pageMocks = {};
  for (const [path, fnName, pageId] of simpleSectionMocks) {
    pageMocks[fnName] = vi.fn((props) => ({ id: pageId, props }));
    vi.doMock(path, () => ({
      default: {
        [fnName]: pageMocks[fnName],
      },
    }));
  }

  const callLogDetailsSettingPage = {
    getCallLogDetailsSettingPageRender: vi.fn((props) => ({ id: 'callLogDetailsSettingPage', props })),
  };
  vi.doMock('../../src/components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage.js', () => ({
    default: callLogDetailsSettingPage,
  }));

  const serverSideLoggingPage = {
    getServerSideLoggingSettingPageRender: vi.fn((props) => ({ id: 'serverSideLoggingSettingPage', props })),
  };
  vi.doMock('../../src/components/admin/serverSideLoggingPage.js', () => ({ default: serverSideLoggingPage }));

  const managedAuthenticationPage = {
    getManagedAuthenticationPageRender: vi.fn((props) => ({ id: 'managedAuthenticationPage', props })),
  };
  vi.doMock('../../src/components/admin/managedAuthenticationPage.js', () => ({ default: managedAuthenticationPage }));

  const managedAuthUserPage = {
    getManagedAuthUserPageRender: vi.fn((props) => ({ id: 'managedAuthUserPage', props })),
  };
  vi.doMock('../../src/components/admin/managedAuthUserPage.js', () => ({ default: managedAuthUserPage }));

  const adminGoogleSheetsPage = {
    renderAdminGoogleSheetsPage: vi.fn((props) => ({ id: 'adminGoogleSheetsPage', props })),
  };
  vi.doMock('../../src/components/admin/adminGoogleSheetsPage.js', () => ({ default: adminGoogleSheetsPage }));

  const userMappingPage = {
    getUserMappingPageRender: vi.fn((props) => ({ id: 'userMappingPage', props })),
  };
  vi.doMock('../../src/components/admin/userMappingPage/userMappingPage.js', () => ({ default: userMappingPage }));

  const pluginPages = {
    getPluginsSettingPageRender: vi.fn((props) => ({ id: 'pluginsSettingPage', props })),
    getInstalledPluginListPageRender: vi.fn((props) => ({ id: 'installedPluginListPage', props })),
  };
  vi.doMock('../../src/components/admin/managedSettings/pluginsSettingPage.js', () => ({
    getPluginsSettingPageRender: pluginPages.getPluginsSettingPageRender,
  }));
  vi.doMock('../../src/components/installedPluginListPage.js', () => ({
    getInstalledPluginListPageRender: pluginPages.getInstalledPluginListPageRender,
  }));

  const adminCore = {
    getServerSideLogging: vi.fn(async () => ({
      subscribed: true,
      subscriptionLevel: 'Account',
      loggingByAdmin: true,
      doNotLogNumbers: ['+16505550100'],
      sources: ['Voice'],
    })),
    getServerSideLoggingAdditionalFieldValues: vi.fn(async () => ({ region: 'US' })),
    getUserMapping: vi.fn(async () => [
      {
        crmUser: { id: 'crm-1' },
        rcUser: [{ extensionId: '101' }],
      },
    ]),
    uploadAdminSettings: vi.fn(async () => {}),
    getManagedAuthSettings: vi.fn(async () => ({
      orgFields: [{ const: 'clientId' }],
      userFields: [{ const: 'clientSecret' }],
    })),
    refreshAdminSettings: vi.fn(async () => ({
      adminSettings: (await chrome.storage.local.get('adminSettings')).adminSettings,
    })),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.js', () => ({ default: adminCore }));

  const userCore = {
    getAllPluginSettings: vi.fn((settings = {}) => Object.keys(settings).reduce((result, key) => {
      if (key.startsWith('plugin_') && !settings[key]?.isRemoved) {
        result[key.replace('plugin_', '')] = settings[key].value ?? settings[key];
      }
      return result;
    }, {})),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.js', () => ({
    default: userCore,
    getAllPluginSettings: userCore.getAllPluginSettings,
  }));

  const manifestService = {
    getPluginList: vi.fn(async () => [
      { id: 'plugin-1', name: 'Plugin One' },
      { id: 'plugin-2', name: 'Plugin Two' },
    ]),
    ...overrides.manifestService,
  };
  vi.doMock('../../src/service/manifestService.js', () => manifestService);

  const pluginService = {
    getPluginLicenseStatus: vi.fn(async ({ pluginId }) => ({
      id: pluginId,
      licenseStatus: true,
      licenseStatusDescription: 'Licensed',
      errorMessage: '',
    })),
    ...overrides.pluginService,
  };
  vi.doMock('../../src/service/pluginService.js', () => ({ default: pluginService }));

  const util = {
    getRcContactInfo: vi.fn(async () => [
      { id: '101', type: 'User', name: 'Jane User' },
      { id: '201', type: 'Department', name: 'Support Team' },
      { id: 'account', type: 'Company', name: 'Acme' },
    ]),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const handler = await loadModule(modulePath);
  return {
    handler,
    pageMocks,
    callLogDetailsSettingPage,
    serverSideLoggingPage,
    managedAuthenticationPage,
    managedAuthUserPage,
    adminGoogleSheetsPage,
    userMappingPage,
    pluginPages,
    adminCore,
    userCore,
    manifestService,
    pluginService,
    util,
  };
}

const context = {
  data: {
    requestId: 'request-1',
    body: {
      formData: {},
      page: { id: 'settingsPage' },
    },
  },
  manifest: {
    serverUrl: 'https://server.example',
  },
  platformName: 'salesforce',
  platform: {
    name: 'clio',
    displayName: 'Salesforce',
    contactTypes: [{ value: 'Lead', display: 'Lead' }],
    enableExtensionNumberLoggingSetting: true,
    serverSideLogging: {
      additionalFields: [{ const: 'region' }],
    },
  },
};

describe('customizedPage inputChanged section handlers', () => {
  beforeEach(() => {
    seedStorage({
      adminSettings: {
        userSettings: {
          autoLogCall: { value: true },
          serverSideLogging: { enable: true },
          'plugin_plugin-1': {
            value: {
              requireLicense: true,
            },
          },
        },
      },
      userSettings: {
        locale: { value: 'en-US' },
      },
      managedAuthSettings: {
        orgFields: [{ const: 'clientId' }],
        orgValues: { clientId: { hasValue: true } },
        userFields: [{ const: 'clientSecret' }],
        userValues: [],
      },
      implementedInterfaces: {
        getUserList: true,
      },
      userPermissions: {
        edit: true,
      },
    });
  });

  it('renders simple settings section pages with stored admin settings', async () => {
    const routes = [
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/generalSettings.js', 'getGeneralSettingPageRender', 'generalSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedSettings.js', 'getManagedSettingsPageRender', 'managedSettingsPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/appearance.js', 'getAppearancePageRender', 'appearancePage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialMatcher.js', 'getClickToDialMatcherSettingPageRender', 'clickToDialMatcherSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customizeTabs.js', 'getCustomizeTabsSettingPageRender', 'customizeTabsSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/widgetSettings.js', 'getWidgetSettingsPageRender', 'widgetSettingsPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/notificationLevel.js', 'getNotificationLevelSettingPageRender', 'notificationLevelSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/phoneNumberFormat.js', 'getPhoneNumberFormatPageRender', 'phoneNumberFormatPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialEmbed.js', 'getClickToDialEmbedPageRender', 'clickToDialEmbedPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callAndSMSLogging.js', 'getCallAndSMSLoggingSettingPageRender', 'callAndSMSLoggingSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/contactSetting.js', 'getContactSettingPageRender', 'contactSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/advancedFeaturesSetting.js', 'getAdvancedFeaturesSettingPageRender', 'advancedFeaturesSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customSettings.js', 'getCustomSettingsPageRender', 'customSettingsPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/autoLogPreferences.js', 'getAutoLogPreferenceSettingPageRender', 'autoLogPreferenceSettingPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedOAuth.js', 'getManagedOAuthAdminPageRender', 'managedOAuthAdminPage'],
      ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthOrg.js', 'getManagedAuthOrgPageRender', 'managedAuthOrgPage'],
    ];

    for (const [modulePath, fnName, pageId] of routes) {
      const loaded = await loadSectionHandler(modulePath);
      await loaded.handler.onEvent(context);
      expect(loaded.pageMocks[fnName]).toHaveBeenCalled();
      expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'rc-adapter-register-customized-page',
            page: expect.objectContaining({ id: pageId }),
          }),
        }),
        expect.objectContaining({
          message: {
            type: 'rc-adapter-navigate-to',
            path: `/customized/${pageId}`,
          },
        }),
      ]));
    }
  });

  it('renders call log details with refreshed server-side logging subscription state and fallback state', async () => {
    let loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.adminCore.getServerSideLogging).toHaveBeenCalledWith({ platform: context.platform });
    expect(loaded.callLogDetailsSettingPage.getCallLogDetailsSettingPageRender).toHaveBeenCalledWith({
      adminUserSettings: expect.objectContaining({
        serverSideLogging: { enable: true },
      }),
      userPermissions: { edit: true },
      serverSideLoggingSubscribed: true,
    });

    loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.js',
      {
        adminCore: {
          getServerSideLogging: vi.fn(async () => {
            throw new Error('subscription unavailable');
          }),
        },
      },
    );
    await loaded.handler.onEvent(context);
    expect(loaded.callLogDetailsSettingPage.getCallLogDetailsSettingPageRender).toHaveBeenCalledWith(expect.objectContaining({
      serverSideLoggingSubscribed: false,
    }));
  });

  it('renders server-side logging, managed auth, admin Google Sheets, and user mapping sections', async () => {
    let loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/serverSideLoggingSetting.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.serverSideLoggingPage.getServerSideLoggingSettingPageRender).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionLevel: 'Account',
      doNotLogNumbers: ['+16505550100'],
      enableUserMapping: true,
      additionalFields: [{ const: 'region' }],
      additionalFieldValues: { region: 'US' },
      sources: ['Voice'],
      userPermissions: { edit: true },
    }));

    loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthentication.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.managedAuthenticationPage.getManagedAuthenticationPageRender).toHaveBeenCalledWith({
      hasOrgFields: true,
      hasUserFields: true,
    });

    loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthUser.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.util.getRcContactInfo).toHaveBeenCalled();
    expect(loaded.managedAuthUserPage.getManagedAuthUserPageRender).toHaveBeenCalledWith(expect.objectContaining({
      userFields: [{ const: 'clientSecret' }],
      rcExtensions: [
        { id: '101', type: 'User', name: 'Jane User' },
        { id: '201', type: 'Department', name: 'Support Team' },
      ],
    }));

    loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/googleSheetsAdminConfig.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.adminGoogleSheetsPage.renderAdminGoogleSheetsPage).toHaveBeenCalledWith({
      manifest: context.manifest,
      adminSettings: expect.objectContaining({
        userSettings: expect.any(Object),
      }),
    });

    loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/userMapping.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      adminSettings: expect.objectContaining({
        userMappings: [
          {
            crmUserId: 'crm-1',
            rcExtensionId: ['101'],
          },
        ],
      }),
    });
    expect(loaded.userMappingPage.getUserMappingPageRender).toHaveBeenCalledWith({
      userMapping: [
        {
          crmUser: { id: 'crm-1' },
          rcUser: [{ extensionId: '101' }],
        },
      ],
      platformDisplayName: 'Salesforce',
    });
  });

  it('renders admin plugin settings and installed plugin lists with license status', async () => {
    let loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/pluginsAdminConfig.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.pluginPages.getPluginsSettingPageRender).toHaveBeenCalledWith({
      installedPluginList: [expect.objectContaining({ id: 'plugin-1' })],
    });

    loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/installedPlugins.js',
    );
    await loaded.handler.onEvent(context);
    expect(loaded.pluginService.getPluginLicenseStatus).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
    }));
    expect(loaded.pluginPages.getInstalledPluginListPageRender).toHaveBeenCalledWith({
      pluginList: [
        expect.objectContaining({
          id: 'plugin-1',
          requireLicense: true,
          licenseStatus: true,
          licenseStatusDescription: 'Licensed',
        }),
      ],
      isFromAdmin: true,
    });
  });
});
