import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const simpleSectionMocks = [
  ['../../src/components/admin/generalSettingPage.ts', 'getGeneralSettingPageRender', 'generalSettingPage'],
  ['../../src/components/admin/managedSettingsPage.ts', 'getManagedSettingsPageRender', 'managedSettingsPage'],
  ['../../src/components/admin/generalSettings/appearancePage.ts', 'getAppearancePageRender', 'appearancePage'],
  ['../../src/components/admin/generalSettings/clickToDialMatcherSettingPage.ts', 'getClickToDialMatcherSettingPageRender', 'clickToDialMatcherSettingPage'],
  ['../../src/components/admin/generalSettings/customizeTabsSettingPage.ts', 'getCustomizeTabsSettingPageRender', 'customizeTabsSettingPage'],
  ['../../src/components/admin/generalSettings/widgetSettingsPage.ts', 'getWidgetSettingsPageRender', 'widgetSettingsPage'],
  ['../../src/components/admin/generalSettings/notificationLevelSettingPage.ts', 'getNotificationLevelSettingPageRender', 'notificationLevelSettingPage'],
  ['../../src/components/admin/generalSettings/phoneNumberFormatPage.ts', 'getPhoneNumberFormatPageRender', 'phoneNumberFormatPage'],
  ['../../src/components/admin/generalSettings/clickToDialEmbedPage.ts', 'getClickToDialEmbedPageRender', 'clickToDialEmbedPage'],
  ['../../src/components/admin/managedSettings/callAndSMSLoggingSettingPage.ts', 'getCallAndSMSLoggingSettingPageRender', 'callAndSMSLoggingSettingPage'],
  ['../../src/components/admin/managedSettings/contactSettingPage.ts', 'getContactSettingPageRender', 'contactSettingPage'],
  ['../../src/components/admin/managedSettings/advancedFeaturesSettingPage.ts', 'getAdvancedFeaturesSettingPageRender', 'advancedFeaturesSettingPage'],
  ['../../src/components/admin/managedSettings/customSettingsPage.ts', 'getCustomSettingsPageRender', 'customSettingsPage'],
  ['../../src/components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage.ts', 'getAutoLogPreferenceSettingPageRender', 'autoLogPreferenceSettingPage'],
  ['../../src/components/admin/managedOAuthAdminPage.ts', 'getManagedOAuthAdminPageRender', 'managedOAuthAdminPage'],
  ['../../src/components/admin/managedAuthOrgPage.ts', 'getManagedAuthOrgPageRender', 'managedAuthOrgPage'],
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
  vi.doMock('../../src/components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage.ts', () => ({
    default: callLogDetailsSettingPage,
  }));

  const serverSideLoggingPage = {
    getServerSideLoggingSettingPageRender: vi.fn((props) => ({ id: 'serverSideLoggingSettingPage', props })),
  };
  vi.doMock('../../src/components/admin/serverSideLoggingPage.ts', () => ({ default: serverSideLoggingPage }));

  const managedAuthenticationPage = {
    getManagedAuthenticationPageRender: vi.fn((props) => ({ id: 'managedAuthenticationPage', props })),
  };
  vi.doMock('../../src/components/admin/managedAuthenticationPage.ts', () => ({ default: managedAuthenticationPage }));

  const managedAuthUserPage = {
    getManagedAuthUserPageRender: vi.fn((props) => ({ id: 'managedAuthUserPage', props })),
  };
  vi.doMock('../../src/components/admin/managedAuthUserPage.ts', () => ({ default: managedAuthUserPage }));

  const adminGoogleSheetsPage = {
    renderAdminGoogleSheetsPage: vi.fn((props) => ({ id: 'adminGoogleSheetsPage', props })),
  };
  vi.doMock('../../src/components/admin/adminGoogleSheetsPage.ts', () => ({ default: adminGoogleSheetsPage }));

  const userMappingPage = {
    getUserMappingPageRender: vi.fn((props) => ({ id: 'userMappingPage', props })),
  };
  vi.doMock('../../src/components/admin/userMappingPage/userMappingPage.ts', () => ({ default: userMappingPage }));

  const pluginPages = {
    getPluginsSettingPageRender: vi.fn((props) => ({ id: 'pluginsSettingPage', props })),
    getInstalledPluginListPageRender: vi.fn((props) => ({ id: 'installedPluginListPage', props })),
  };
  vi.doMock('../../src/components/admin/managedSettings/pluginsSettingPage.ts', () => ({
    getPluginsSettingPageRender: pluginPages.getPluginsSettingPageRender,
  }));
  vi.doMock('../../src/components/installedPluginListPage.ts', () => ({
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
  vi.doMock('../../src/core/admin.ts', () => ({ default: adminCore }));

  const userCore = {
    getAllPluginSettings: vi.fn((settings = {}) => Object.keys(settings).reduce((result, key) => {
      if (key.startsWith('plugin_') && !settings[key]?.isRemoved) {
        result[key.replace('plugin_', '')] = settings[key].value ?? settings[key];
      }
      return result;
    }, {})),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.ts', () => ({
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
  vi.doMock('../../src/service/manifestService.ts', () => manifestService);

  const pluginService = {
    getPluginLicenseStatus: vi.fn(async ({ pluginId }) => ({
      id: pluginId,
      licenseStatus: true,
      licenseStatusDescription: 'Licensed',
      errorMessage: '',
    })),
    ...overrides.pluginService,
  };
  vi.doMock('../../src/service/pluginService.ts', () => ({ default: pluginService }));

  const util = {
    getRcContactInfo: vi.fn(async () => [
      { id: '101', type: 'User', name: 'Jane User' },
      { id: '201', type: 'Department', name: 'Support Team' },
      { id: 'account', type: 'Company', name: 'Acme' },
    ]),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

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

const simpleSettingsSectionRoutes = [
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/generalSettings.ts', 'getGeneralSettingPageRender', 'generalSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedSettings.ts', 'getManagedSettingsPageRender', 'managedSettingsPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/appearance.ts', 'getAppearancePageRender', 'appearancePage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialMatcher.ts', 'getClickToDialMatcherSettingPageRender', 'clickToDialMatcherSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customizeTabs.ts', 'getCustomizeTabsSettingPageRender', 'customizeTabsSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/widgetSettings.ts', 'getWidgetSettingsPageRender', 'widgetSettingsPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/notificationLevel.ts', 'getNotificationLevelSettingPageRender', 'notificationLevelSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/phoneNumberFormat.ts', 'getPhoneNumberFormatPageRender', 'phoneNumberFormatPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialEmbed.ts', 'getClickToDialEmbedPageRender', 'clickToDialEmbedPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callAndSMSLogging.ts', 'getCallAndSMSLoggingSettingPageRender', 'callAndSMSLoggingSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/contactSetting.ts', 'getContactSettingPageRender', 'contactSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/advancedFeaturesSetting.ts', 'getAdvancedFeaturesSettingPageRender', 'advancedFeaturesSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customSettings.ts', 'getCustomSettingsPageRender', 'customSettingsPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/autoLogPreferences.ts', 'getAutoLogPreferenceSettingPageRender', 'autoLogPreferenceSettingPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedOAuth.ts', 'getManagedOAuthAdminPageRender', 'managedOAuthAdminPage'],
  ['../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthOrg.ts', 'getManagedAuthOrgPageRender', 'managedAuthOrgPage'],
];

async function expectSimpleSectionRoutesToRender(routes) {
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
}

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

  it('renders general settings section pages with stored admin settings', async () => {
    await expectSimpleSectionRoutesToRender(simpleSettingsSectionRoutes.slice(0, 8));
  });

  it('renders managed settings section pages with stored admin settings', async () => {
    await expectSimpleSectionRoutesToRender(simpleSettingsSectionRoutes.slice(8));
  });

  it('renders call log details with refreshed server-side logging subscription state', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.ts',
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
  });

  it('renders call log details with server-side logging fallback when subscription lookup fails', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.ts',
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

  it('renders server-side logging section with subscription and additional field values', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/serverSideLoggingSetting.ts',
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
  });

  it('renders managed authentication section availability', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthentication.ts',
    );

    await loaded.handler.onEvent(context);

    expect(loaded.managedAuthenticationPage.getManagedAuthenticationPageRender).toHaveBeenCalledWith({
      hasOrgFields: true,
      hasUserFields: true,
    });
  });

  it('renders managed auth user section with RC extension choices', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthUser.ts',
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
  });

  it('renders admin Google Sheets configuration section', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/googleSheetsAdminConfig.ts',
    );

    await loaded.handler.onEvent(context);

    expect(loaded.adminGoogleSheetsPage.renderAdminGoogleSheetsPage).toHaveBeenCalledWith({
      manifest: context.manifest,
      adminSettings: expect.objectContaining({
        userSettings: expect.any(Object),
      }),
    });
  });

  it('renders user mapping section and persists normalized admin mappings', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/userMapping.ts',
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

  it('renders admin plugin settings section with installed plugins', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/pluginsAdminConfig.ts',
    );

    await loaded.handler.onEvent(context);

    expect(loaded.pluginPages.getPluginsSettingPageRender).toHaveBeenCalledWith({
      installedPluginList: [expect.objectContaining({ id: 'plugin-1' })],
    });
  });

  it('renders installed plugin list section with license status', async () => {
    const loaded = await loadSectionHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/installedPlugins.ts',
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
