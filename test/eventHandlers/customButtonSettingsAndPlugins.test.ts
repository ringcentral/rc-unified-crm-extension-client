import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

function baseManifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        displayName: 'Salesforce',
        environment: {
          type: 'dynamic',
        },
        serverSideLogging: {
          useAdminAssignedUserToken: true,
        },
      },
      fixedcrm: {
        displayName: 'Fixed CRM',
        environment: {
          type: 'fixed',
          url: 'https://fixed.example/app',
        },
      },
      selectablecrm: {
        displayName: 'Selectable CRM',
        environment: {
          type: 'selectable',
        },
      },
    },
  };
}

function dataFor(formData = {}, id = 'testButton') {
  return {
    requestId: 'request-1',
    body: {
      button: {
        id,
        formData,
      },
      formData,
    },
  };
}

function pluginList() {
  return [
    {
      id: 'plugin-1',
      name: 'Plugin One',
      version: '1.0.0',
      isAsync: false,
      supportedLogTypes: ['CallLog'],
      requireLicense: true,
      pageContent: [
        { const: 'apiKey' },
        { const: 'hiddenKey', hidden: true },
      ],
      accountId: 'owner-account-1',
    },
    {
      id: 'plugin-2',
      name: 'Plugin Two',
      version: '2.0.0',
      isAsync: true,
      supportedLogTypes: ['MessageLog'],
      requireLicense: false,
      pageContent: [],
      accountId: 'owner-account-2',
    },
  ];
}

function fixedConnectorManifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
        displayName: 'Salesforce',
        environment: {
          type: 'fixed',
          url: 'https://crm.example/app',
        },
      },
    },
  };
}

function dynamicConnectorManifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
        displayName: 'Salesforce',
        environment: {
          type: 'dynamic',
          url: 'https://*.example',
        },
        auth: {
          type: 'apiKey',
        },
      },
    },
  };
}

async function loadButtonHandler(modulePath, overrides: Record<string, any> = {}) {
  vi.resetModules();
  vi.mocked(axios.get).mockReset().mockResolvedValue({ data: { successful: true } });
  vi.mocked(axios.post).mockReset().mockResolvedValue({ data: { successful: true } });
  vi.mocked(axios.delete).mockReset().mockResolvedValue({ data: { successful: true } });

  const authCore = {
    apiKeyLogin: vi.fn(async () => 'jwt-token'),
    checkAuth: vi.fn(async () => true),
    unAuthorize: vi.fn(async () => {}),
    refreshLicenseStatus: vi.fn(async () => {}),
    onUserClickConnectButton: vi.fn(async () => {}),
    checkManagedOAuthBeforeCrmVisible: vi.fn(async () => ({ blocked: false })),
    getManagedAuthState: vi.fn(async () => ({ allRequiredFieldsSatisfied: true })),
    saveManagedOAuthPendingValues: vi.fn(async () => {}),
    ...overrides.authCore,
  };
  vi.doMock('../../src/core/auth.ts', () => ({
    default: authCore,
    checkAuth: authCore.checkAuth,
  }));

  const userCore = {
    updateSSCLToken: vi.fn(async () => {}),
    getShowUserReportTabSetting: vi.fn(() => ({ value: true })),
    getUserReportStats: vi.fn(async () => ({ total: 3 })),
    getShowCalldownTabSetting: vi.fn(() => ({ value: true })),
    refreshUserSettings: vi.fn(async ({ changedSettings, settingKeysToRemove } = {}) => {
      const current = (await chrome.storage.local.get('userSettings')).userSettings ?? {};
      const next = { ...current, ...(changedSettings ?? {}) };
      for (const key of settingKeysToRemove ?? []) {
        delete next[key];
      }
      await chrome.storage.local.set({ userSettings: next });
      return { ...next, userSettings: next };
    }),
    getUserSettingsOnline: vi.fn(async () => (await chrome.storage.local.get('userSettings')).userSettings ?? {}),
    getPluginSetting: vi.fn((settings, pluginId) => {
      const setting = settings?.[`plugin_${pluginId}`];
      return setting?.value ?? setting;
    }),
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
    refreshUserSettings: userCore.refreshUserSettings,
    getUserSettingsOnline: userCore.getUserSettingsOnline,
    getPluginSetting: userCore.getPluginSetting,
    getAllPluginSettings: userCore.getAllPluginSettings,
  }));

  const adminCore = {
    refreshAdminSettings: vi.fn(async () => ({ adminSettings: { userSettings: {} } })),
    authAppConnectServer: vi.fn(async () => {}),
    uploadAdminSettings: vi.fn(async () => {}),
    getAdminSettings: vi.fn(async () => (await chrome.storage.local.get('adminSettings')).adminSettings ?? { userSettings: {} }),
    getServerSideLogging: vi.fn(async () => ({
      subscribed: true,
      subscriptionLevel: 'Account',
      loggingWithUserAssigned: false,
      loggingByAdmin: false,
      sources: ['Voice'],
    })),
    enableServerSideLogging: vi.fn(async () => {}),
    disableServerSideLogging: vi.fn(async () => {}),
    saveManagedAuthSettings: vi.fn(async () => {}),
    uploadServerSideLoggingAdditionalFieldValues: vi.fn(async () => ({ successful: true })),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.ts', () => ({
    default: adminCore,
    uploadAdminSettings: adminCore.uploadAdminSettings,
    getAdminSettings: adminCore.getAdminSettings,
  }));

  const util = {
    showNotification: vi.fn(),
    getRcContactInfo: vi.fn(async () => [
      { id: '101', type: 'User', name: 'Jane User' },
      { id: '201', type: 'Department', firstName: 'Support', lastName: 'Team' },
      { id: 'account', type: 'Company', name: 'Acme' },
    ]),
    getRcAccessToken: vi.fn(() => 'rc-access-token'),
    getRcAccessTokenHeaderConfig: vi.fn((config = {}) => ({
      ...config,
      headers: {
        ...(config.headers ?? {}),
        'X-RC-Access-Token': 'rc-access-token',
      },
    })),
    getRcInfo: vi.fn(async () => ({
      value: {
        cachedData: {
          accountInfo: { id: 1001 },
          extensionInfo: { account: { id: 1002 } },
        },
      },
    })),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const analytics = {
    trackFactoryReset: vi.fn(),
    ...overrides.analytics,
  };
  vi.doMock('../../src/lib/analytics.ts', () => analytics);

  const platformService = {
    clearPlatformInfo: vi.fn(async () => {}),
    ...overrides.platformService,
  };
  vi.doMock('../../src/service/platformService.ts', () => platformService);

  const manifestService = {
    getManifest: vi.fn(async () => baseManifest()),
    saveManifest: vi.fn(async ({ manifest }) => manifest),
    saveManifestUrl: vi.fn(async () => {}),
    getPluginList: vi.fn(async () => pluginList()),
    getPluginDetails: vi.fn(async ({ selectedPlugin }) => ({
      ...selectedPlugin,
      showAuthorizationButton: true,
      authStateUrl: 'https://plugin.example/auth-state',
    })),
    ...overrides.manifestService,
  };
  vi.doMock('../../src/service/manifestService.ts', () => manifestService);

  const embeddableServices = {
    getServiceManifest: vi.fn(async () => ({ id: 'service-manifest' })),
    ...overrides.embeddableServices,
  };
  vi.doMock('../../src/service/embeddableServices.ts', () => ({ default: embeddableServices }));

  const pluginService = {
    getPluginLicenseStatus: vi.fn(async ({ pluginId }) => ({
      id: pluginId,
      licenseStatus: true,
      licenseStatusDescription: 'Licensed',
    })),
    ...overrides.pluginService,
  };
  vi.doMock('../../src/service/pluginService.ts', () => ({ default: pluginService }));

  const reportPage = {
    getReportsPageRender: vi.fn((props) => ({ id: 'reportPage', props })),
    ...overrides.reportPage,
  };
  vi.doMock('../../src/components/reportPage/reportPage.ts', () => ({ default: reportPage }));

  const calldownPage = {
    getCalldownPageWithRecords: vi.fn(async (props) => ({ id: 'calldownPage', props })),
    ...overrides.calldownPage,
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));

  const adminPage = {
    getAdminPageRender: vi.fn((props) => ({ id: 'adminPage', props })),
    ...overrides.adminPage,
  };
  vi.doMock('../../src/components/admin/adminPage.ts', () => ({ default: adminPage }));

  const hostnameInputPage = {
    getHostnameInputPageRender: vi.fn((props) => ({ id: 'hostnameInputPage', props })),
    ...overrides.hostnameInputPage,
  };
  vi.doMock('../../src/components/hostnameInputPage.ts', () => ({ default: hostnameInputPage }));

  const managedAuthUserPage = {
    getManagedAuthUserPageRender: vi.fn((props) => ({ id: 'managedAuthUserPage', props })),
    ...overrides.managedAuthUserPage,
  };
  vi.doMock('../../src/components/admin/managedAuthUserPage.ts', () => ({ default: managedAuthUserPage }));

  const pluginPages = {
    getPluginAdminConfigurePageRender: vi.fn((props) => ({ id: 'pluginAdminConfigurePage', props })),
    getPluginConfigurePageRender: vi.fn((props) => ({ id: 'pluginConfigurePage', props })),
    getMergedPluginConfigFromFormData: vi.fn((form) => ({
      apiKey: form.apiKey?.value ?? form.apiKey ?? null,
    })),
    getMissingRequiredPluginConfigFields: vi.fn(() => []),
    getInstalledPluginListPageRender: vi.fn((props) => ({ id: 'installedPluginListPage', props })),
    getPluginMarketListPageRender: vi.fn((props) => ({ id: 'pluginMarketListPage', props })),
    ...overrides.pluginPages,
  };
  vi.doMock('../../src/components/pluginAdminConfigurePage.ts', () => ({
    getPluginAdminConfigurePageRender: pluginPages.getPluginAdminConfigurePageRender,
  }));
  vi.doMock('../../src/components/pluginConfigurePage.ts', () => ({
    getPluginConfigurePageRender: pluginPages.getPluginConfigurePageRender,
    getMergedPluginConfigFromFormData: pluginPages.getMergedPluginConfigFromFormData,
    getMissingRequiredPluginConfigFields: pluginPages.getMissingRequiredPluginConfigFields,
  }));
  vi.doMock('../../src/components/installedPluginListPage.ts', () => ({
    getInstalledPluginListPageRender: pluginPages.getInstalledPluginListPageRender,
  }));
  vi.doMock('../../src/components/pluginMarketListPage.ts', () => ({
    getPluginMarketListPageRender: pluginPages.getPluginMarketListPageRender,
  }));

  const handler = await loadModule(modulePath);
  return {
    handler,
    authCore,
    userCore,
    adminCore,
    util,
    analytics,
    platformService,
    manifestService,
    embeddableServices,
    pluginService,
    reportPage,
    calldownPage,
    adminPage,
    hostnameInputPage,
    managedAuthUserPage,
    pluginPages,
  };
}

describe('custom-button auth, admin settings, and plugin handlers', () => {
  beforeEach(() => {
    seedStorage({
      userSettings: {},
      adminSettings: { userSettings: {} },
    });
  });

  it('authenticates with an API key and registers report, calldown, and admin pages', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/authPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ apiKey: 'api-key-1' }, 'authPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: { useLicense: true },
    });

    expect(loaded.authCore.apiKeyLogin).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      apiKey: 'api-key-1',
      useLicense: true,
    }));
    expect(readStorage().crmAuthed).toBe(true);
    expect(loaded.userCore.updateSSCLToken).toHaveBeenCalledWith(expect.objectContaining({
      token: 'jwt-token',
    }));
    expect(loaded.adminCore.authAppConnectServer).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-token',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.objectContaining({ page: expect.objectContaining({ id: 'reportPage' }) }) }),
      expect.objectContaining({ message: expect.objectContaining({ page: expect.objectContaining({ id: 'calldownPage' }) }) }),
      expect.objectContaining({ message: expect.objectContaining({ page: expect.objectContaining({ id: 'adminPage' }) }) }),
    ]));
  });

  it('stores selected dynamic platform host information and starts CRM connection', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.ts',
      {
        manifestService: {
          getManifest: vi.fn(async () => baseManifest()),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({
        platformId: 'salesforce',
        platformDisplayName: 'Salesforce',
        url: 'https://crm.example/lightning',
        connectorId: 'connector-1',
        devRcAccountId: 'connector-owner-account',
        isPrivate: true,
      }, 'hostnameInputPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(readStorage()['platform-info']).toEqual({
      platformName: 'salesforce',
      platformDisplayName: 'Salesforce',
      hostname: 'crm.example',
      connectorId: 'connector-1',
      devRcAccountId: 'connector-owner-account',
      isPrivate: true,
    });
    expect(loaded.manifestService.getManifest).toHaveBeenCalledWith(true);
    expect(loaded.manifestService.saveManifest).toHaveBeenCalledWith({ manifest: baseManifest() });
    expect(loaded.embeddableServices.getServiceManifest).toHaveBeenCalled();
    expect(loaded.authCore.onUserClickConnectButton).toHaveBeenCalledWith(expect.objectContaining({
      platformName: 'salesforce',
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.objectContaining({ type: 'rc-adapter-register-third-party-service' }) }),
      expect.objectContaining({ message: { type: 'rc-adapter-navigate-to', path: '/settings' } }),
    ]));
  });

  it('stores fixed platform host information without connecting when managed OAuth blocks visibility', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.ts',
      {
        authCore: {
          checkManagedOAuthBeforeCrmVisible: vi.fn(async () => ({ blocked: true })),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({
        platformId: 'fixedcrm',
        platformDisplayName: 'Fixed CRM',
      }, 'hostnameInputPage'),
      manifest: baseManifest(),
      platformName: 'fixedcrm',
      platform: baseManifest().platforms.fixedcrm,
    });
    expect(readStorage()['platform-info'].hostname).toBe('fixed.example');
    expect(loaded.authCore.onUserClickConnectButton).not.toHaveBeenCalled();
  });

  it('selects a public fixed connector manifest and connects immediately', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.ts',
    );
    const fixedManifest = fixedConnectorManifest();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: fixedManifest });

    await loaded.handler.onEvent({
      data: dataFor({
        platformList: [
          {
            id: 'salesforce',
            name: 'salesforce',
            displayName: 'Salesforce',
          },
        ],
      }, 'selectPlatform'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'salesforce=public',
    });

    expect(axios.get).toHaveBeenCalledWith('https://appconnect.labs.ringcentral.com/public-api/connectors/salesforce/manifest?type=connector');
    expect(loaded.manifestService.saveManifestUrl).toHaveBeenCalledWith({
      manifestUrl: 'https://appconnect.labs.ringcentral.com/public-api/connectors/salesforce/manifest?type=connector',
    });
    expect(readStorage()['platform-info']).toEqual({
      platformName: 'salesforce',
      platformDisplayName: 'Salesforce',
      hostname: 'crm.example',
      connectorId: 'salesforce',
      devRcAccountId: '',
      isPrivate: false,
    });
    expect(loaded.embeddableServices.getServiceManifest).toHaveBeenCalled();
    expect(loaded.authCore.checkManagedOAuthBeforeCrmVisible).toHaveBeenCalledWith({
      manifest: fixedManifest,
      platformName: 'salesforce',
      platform: fixedManifest.platforms.salesforce,
    });
    expect(loaded.authCore.onUserClickConnectButton).toHaveBeenCalledWith({
      platform: fixedManifest.platforms.salesforce,
      platformName: 'salesforce',
      manifest: fixedManifest,
    });
  });

  it('selects a private dynamic connector manifest and opens hostname input', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.ts',
    );
    const dynamicManifest = dynamicConnectorManifest();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: dynamicManifest });

    await loaded.handler.onEvent({
      data: dataFor({
        platformList: [
          {
            id: 'salesforce',
            name: 'salesforce',
            displayName: 'Salesforce',
          },
        ],
      }, 'selectPlatform'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'salesforce=private',
    });

    expect(loaded.authCore.getManagedAuthState).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      connectorId: 'salesforce',
      devRcAccountId: 1001,
      isPrivate: true,
    }));
    expect(loaded.hostnameInputPage.getHostnameInputPageRender).toHaveBeenCalledWith(expect.objectContaining({
      platform: dynamicManifest.platforms.salesforce,
      isUrlValid: true,
      submitText: 'Connect',
      connectorId: 'salesforce',
      devRcAccountId: 1001,
      isPrivate: true,
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/hostnameInputPage',
        },
      }),
    ]));
    expect(loaded.authCore.onUserClickConnectButton).not.toHaveBeenCalled();
  });

  it('falls back to shared connector manifest URL when the first shared lookup is unavailable', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.ts',
    );
    const dynamicManifest = dynamicConnectorManifest();
    vi.mocked(axios.get)
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: dynamicManifest });

    await loaded.handler.onEvent({
      data: dataFor({
        platformList: [
          {
            id: 'salesforce',
            name: 'salesforce',
            displayName: 'Salesforce',
            accountId: 'shared-account',
          },
        ],
      }, 'selectPlatform'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'salesforce=shared',
    });
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(loaded.manifestService.saveManifestUrl).toHaveBeenCalledWith({
      manifestUrl: 'https://appconnect.labs.ringcentral.com/public-api/connectors/salesforce/manifest?access=internal&type=connector&accountId=shared-account',
    });
  });

  it('walks first-run dynamic connector selection through hostname capture and CRM connect', async () => {
    const dynamicManifest = dynamicConnectorManifest();
    const selectLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({ data: dynamicManifest });

    await selectLoaded.handler.onEvent({
      data: dataFor({
        platformList: [
          {
            id: 'salesforce',
            name: 'salesforce',
            displayName: 'Salesforce',
          },
        ],
      }, 'selectPlatform'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'salesforce=private',
    });

    expect(selectLoaded.hostnameInputPage.getHostnameInputPageRender).toHaveBeenCalledWith(expect.objectContaining({
      connectorId: 'salesforce',
      isPrivate: true,
      platform: dynamicManifest.platforms.salesforce,
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/hostnameInputPage',
        },
      }),
    ]));

    const hostnameLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.ts',
      {
        manifestService: {
          getManifest: vi.fn(async () => dynamicManifest),
        },
      },
    );

    await hostnameLoaded.handler.onEvent({
      data: dataFor({
        platformId: 'salesforce',
        platformDisplayName: 'Salesforce',
        url: 'https://crm.example/lightning',
        connectorId: 'salesforce',
        devRcAccountId: 1001,
        isPrivate: true,
      }, 'hostnameInputPage'),
      manifest: dynamicManifest,
      platformName: 'salesforce',
      platform: dynamicManifest.platforms.salesforce,
    });

    expect(readStorage()['platform-info']).toEqual({
      platformName: 'salesforce',
      platformDisplayName: 'Salesforce',
      hostname: 'crm.example',
      connectorId: 'salesforce',
      devRcAccountId: 1001,
      isPrivate: true,
    });
    expect(hostnameLoaded.manifestService.saveManifest).toHaveBeenCalledWith({ manifest: dynamicManifest });
    expect(hostnameLoaded.embeddableServices.getServiceManifest).toHaveBeenCalled();
    expect(hostnameLoaded.authCore.onUserClickConnectButton).toHaveBeenCalledWith({
      platform: dynamicManifest.platforms.salesforce,
      platformName: 'salesforce',
      manifest: dynamicManifest,
    });
  });

  it('resets CRM authorization state and records factory reset analytics', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/factoryResetButton.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({}, 'factoryResetButton'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: { useLicense: true },
    });

    expect(loaded.userCore.updateSSCLToken).toHaveBeenCalledWith(expect.objectContaining({
      token: '',
    }));
    expect(loaded.authCore.unAuthorize).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    expect(loaded.authCore.refreshLicenseStatus).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });
    expect(loaded.platformService.clearPlatformInfo).toHaveBeenCalled();
    expect(loaded.analytics.trackFactoryReset).toHaveBeenCalled();
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: { type: 'rc-adapter-navigate-to', path: 'goBack' } }),
      expect.objectContaining({ message: { type: 'rc-adapter-logout' } }),
    ]));
  });

  it('saves managed OAuth pending values and continues CRM connection', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        clientId: 'client-id',
        clientSecret: 'secret',
        accessTokenUri: 'https://oauth.example/token',
        authorizationUri: 'https://oauth.example/auth',
        redirectUri: 'https://app.example/callback',
        scopes: 'read write',
        hostname: 'crm.example',
      }, 'managedOAuthSetupPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(loaded.authCore.saveManagedOAuthPendingValues).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      values: expect.objectContaining({ clientId: 'client-id', hostname: 'crm.example' }),
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      level: 'success',
    }));
    expect(loaded.authCore.onUserClickConnectButton).toHaveBeenCalled();
  });

  it('walks managed OAuth first use from blocked fixed connector to pending credentials and connect', async () => {
    const blockedHostLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.ts',
      {
        authCore: {
          checkManagedOAuthBeforeCrmVisible: vi.fn(async () => ({ blocked: true })),
        },
      },
    );

    await blockedHostLoaded.handler.onEvent({
      data: dataFor({
        platformId: 'fixedcrm',
        platformDisplayName: 'Fixed CRM',
      }, 'hostnameInputPage'),
      manifest: baseManifest(),
      platformName: 'fixedcrm',
      platform: baseManifest().platforms.fixedcrm,
    });

    expect(readStorage()['platform-info']).toEqual(expect.objectContaining({
      platformName: 'fixedcrm',
      hostname: 'fixed.example',
    }));
    expect(blockedHostLoaded.authCore.onUserClickConnectButton).not.toHaveBeenCalled();

    const setupLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.ts',
    );

    await setupLoaded.handler.onEvent({
      data: dataFor({
        clientId: 'client-id',
        clientSecret: 'secret',
        accessTokenUri: 'https://oauth.example/token',
        authorizationUri: 'https://oauth.example/auth',
        redirectUri: 'https://app.example/callback',
        scopes: 'read write',
        hostname: 'fixed.example',
      }, 'managedOAuthSetupPage'),
      manifest: baseManifest(),
      platformName: 'fixedcrm',
      platform: baseManifest().platforms.fixedcrm,
    });

    expect(setupLoaded.authCore.saveManagedOAuthPendingValues).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      values: {
        clientId: 'client-id',
        clientSecret: 'secret',
        accessTokenUri: 'https://oauth.example/token',
        authorizationUri: 'https://oauth.example/auth',
        redirectUri: 'https://app.example/callback',
        scopes: 'read write',
        hostname: 'fixed.example',
      },
    });
    expect(setupLoaded.authCore.onUserClickConnectButton).toHaveBeenCalledWith({
      platform: baseManifest().platforms.fixedcrm,
      platformName: 'fixedcrm',
      manifest: baseManifest(),
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: { type: 'rc-adapter-navigate-to', path: 'goBack' } }),
    ]));
  });

  it('reports managed OAuth pending value save failures', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.ts',
      {
        authCore: {
          saveManagedOAuthPendingValues: vi.fn(async () => {
            throw new Error('save failed');
          }),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({}, 'managedOAuthSetupPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Failed to save OAuth credentials. Please try again.',
      ttl: 5000,
    });
  });

  it('saves admin settings and maps custom number format overrides', async () => {
    seedStorage({
      adminSettings: {
        userSettings: {
          overridingNumberFormat: {
            customizable: false,
            numberFormatter1: 'old-1',
            numberFormatter2: 'old-2',
            numberFormatter3: 'old-3',
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/adminSettingsFormSubmit.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        overridingNumberFormatCustomizable: true,
        overridingNumberFormat1: 'fmt-1',
        overridingNumberFormat2: 'fmt-2',
        overridingNumberFormat3: 'fmt-3',
        overridingNumberFormatTitle: 'title',
        overridingNumberFormatWarning: 'warning',
      }, 'customSettingsPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      responseMessage: vi.fn(),
    });

    expect(readStorage().adminSettings.userSettings.overridingNumberFormat).toEqual({
      customizable: true,
      numberFormatter1: 'fmt-1',
      numberFormatter2: 'fmt-2',
      numberFormatter3: 'fmt-3',
    });
    expect(readStorage().adminSettings.userSettings.overridingNumberFormat1).toBeUndefined();
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalled();
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Settings saved.',
      ttl: 3000,
    });
  });

  it('refreshes server-side logging subscriptions after admin call-log settings save', async () => {
    const responseMessage = vi.fn();
    seedStorage({
      adminSettings: {
        userSettings: {
          serverSideLogging: { enable: true },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/adminSettingsFormSubmit.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ serverSideLogging: { enable: true } }, 'callLogDetailsSettingPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      responseMessage,
    });
    expect(responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(loaded.adminCore.getServerSideLogging).toHaveBeenCalledWith({ platform: baseManifest().platforms.salesforce });
    expect(loaded.adminCore.enableServerSideLogging).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      subscriptionLevel: 'Account',
      loggingByAdmin: true,
      silence: true,
    }));
  });

  it('reports admin setting upload failures', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/adminSettingsFormSubmit.ts',
      {
        adminCore: {
          uploadAdminSettings: vi.fn(async () => {
            throw new Error('upload failed');
          }),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({ anySetting: true }, 'customSettingsPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      responseMessage: vi.fn(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Failed to save settings. Please try again.',
      ttl: 3000,
    });
  });

  it('updates managed-auth user field values and re-renders filtered users', async () => {
    seedStorage({
      managedAuthSettings: {
        userFields: [
          { const: 'clientId' },
          { const: 'clientSecret' },
        ],
        userValues: [
          {
            rcExtensionId: '101',
            rcUserName: 'Jane User',
            fields: {
              clientSecret: {
                hasValue: true,
                value: 'old-secret',
              },
            },
          },
        ],
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        rcExtensionId: '101',
        clientId: 'client-id',
        clientSecret: '',
        searchWord: 'Jane',
        filter: 'Users',
      }, 'managedAuthUserPage'),
      manifest: baseManifest(),
    });

    expect(loaded.adminCore.saveManagedAuthSettings).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      scope: 'user',
      rcExtensionId: '101',
      rcUserName: 'Jane User',
      values: { clientId: 'client-id' },
      fieldsToRemove: ['clientSecret'],
      refreshAfterSave: false,
    });
    expect(readStorage().managedAuthSettings.userValues[0].fields).toEqual({
      clientId: {
        hasValue: true,
        value: 'client-id',
      },
    });
    expect(loaded.managedAuthUserPage.getManagedAuthUserPageRender).toHaveBeenCalledWith(expect.objectContaining({
      searchWord: 'Jane',
      filter: 'Users',
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'User managed authentication updated.',
      ttl: 3000,
    });
  });

  it('reports managed-auth user field save failures', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserPage.ts',
      {
        adminCore: {
          saveManagedAuthSettings: vi.fn(async () => {
            throw new Error('save failed');
          }),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({ rcExtensionId: '101' }, 'managedAuthUserPage'),
      manifest: baseManifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Failed to update user managed authentication. Please try again.',
      ttl: 3000,
    });
  });

  it('enables server-side logging, refreshes service manifest, and uploads extra fields', async () => {
    const responseMessage = vi.fn();
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/saveServerSideLogging.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        serverSideLoggingHolder: {
          serverSideLogging: 'Account',
          activityRecordOwner: 'admin',
          sources: ['Voice'],
        },
        doNotLogNumbers: '+16505550100',
      }, 'saveServerSideLoggingButton'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      responseMessage,
    });

    expect(responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        serverSideLogging: {
          enable: true,
          loggingLevel: 'Account',
        },
      },
    });
    expect(loaded.adminCore.enableServerSideLogging).toHaveBeenCalledWith(expect.objectContaining({
      loggingByAdmin: true,
      sources: ['Voice'],
    }));
    expect(loaded.embeddableServices.getServiceManifest).toHaveBeenCalled();
    expect(loaded.adminCore.uploadServerSideLoggingAdditionalFieldValues).toHaveBeenCalledWith(expect.objectContaining({
      formData: expect.objectContaining({ doNotLogNumbers: '+16505550100' }),
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Server side logging do not log numbers updated.',
      ttl: 5000,
    });
  });

  it('disables server-side logging and reports extra-field update warnings', async () => {
    const responseMessage = vi.fn();
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/saveServerSideLogging.ts',
      {
        adminCore: {
          uploadServerSideLoggingAdditionalFieldValues: vi.fn(async () => ({
            successful: false,
            returnMessage: {
              messageType: 'warning',
              message: 'Partial update',
              ttl: 4000,
            },
          })),
        },
      },
    );
    await loaded.handler.onEvent({
      data: dataFor({
        serverSideLoggingHolder: {
          serverSideLogging: 'Disable',
          activityRecordOwner: 'user',
          sources: [],
        },
      }, 'saveServerSideLoggingButton'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      responseMessage,
    });
    expect(loaded.adminCore.disableServerSideLogging).toHaveBeenCalledWith({ platform: baseManifest().platforms.salesforce });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Server side logging turned OFF.',
      ttl: 5000,
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Partial update',
      ttl: 4000,
    });
  });

  it('renders selected user plugin configuration with saved config and license status', async () => {
    seedStorage({
      userSettings: {
        'plugin_plugin-1': {
          value: {
            config: {
              apiKey: { value: 'saved-key' },
            },
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: true,
        returnMessage: {
          messageType: 'info',
          message: 'Connected',
        },
      },
    });

    await loaded.handler.onEvent({
      data: dataFor({ pluginList: pluginList(), isFromAdmin: false }, 'selectPlugin'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'plugin-1=user',
    });

    expect(loaded.manifestService.getPluginDetails).toHaveBeenCalledWith({ selectedPlugin: pluginList()[0] });
    expect(loaded.pluginService.getPluginLicenseStatus).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
    }));
    expect(loaded.pluginPages.getPluginConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      pluginAccess: 'user',
      isLoggedIn: true,
      hasValidLicense: true,
      config: {
        apiKey: { value: 'saved-key' },
      },
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'info',
      message: 'Connected',
      ttl: 3000,
    });
  });

  it('warns and skips plugin configuration rendering when CRM auth is missing', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.ts',
      {
        authCore: {
          checkAuth: vi.fn(async () => false),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({ pluginList: pluginList() }, 'selectPlugin'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'plugin-1=user',
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Please go to user settings page and connect to your Salesforce account.',
      ttl: 5000,
    });
    expect(loaded.pluginPages.getPluginConfigurePageRender).not.toHaveBeenCalled();
  });

  it('renders admin plugin configuration after reporting authorization-state failures', async () => {
    seedStorage({
      userSettings: {
        'plugin_plugin-1': {
          value: {
            config: {
              apiKey: { value: 'saved-key' },
            },
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.ts',
      {
        manifestService: {
          getPluginDetails: vi.fn(async ({ selectedPlugin }) => ({
            ...selectedPlugin,
            showAuthorizationButton: true,
            authStateUrl: 'https://plugin.example/auth-state',
          })),
        },
      },
    );
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: {
        data: {
          returnMessage: {
            messageType: 'error',
            message: 'Auth check failed',
          },
        },
      },
    });

    await loaded.handler.onEvent({
      data: dataFor({ pluginList: pluginList(), isFromAdmin: true }, 'selectPlugin'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'plugin-1=admin',
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Auth check failed',
      ttl: 3000,
    });
    expect(loaded.pluginPages.getPluginAdminConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      pluginAccess: 'admin',
      ownerRcAccountId: 'owner-account-1',
      installed: true,
    }));
  });

  it('renders installed plugin list pages with batch license status', async () => {
    seedStorage({
      userSettings: {
        'plugin_plugin-1': {
          value: {
            requireLicense: true,
          },
        },
        'plugin_plugin-2': {
          value: {
            requireLicense: false,
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/installedPluginListPage.ts',
      {
        pluginService: {
          getPluginLicenseStatus: vi.fn(async ({ pluginId }) => ({
            id: pluginId,
            licenseStatus: pluginId === 'plugin-1',
            licenseStatusDescription: pluginId === 'plugin-1' ? 'Licensed' : 'No license required',
            errorMessage: pluginId === 'plugin-2' ? '' : undefined,
          })),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({}, 'openInstalledPluginListPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(loaded.pluginPages.getInstalledPluginListPageRender).toHaveBeenCalledWith({
      pluginList: [
        expect.objectContaining({
          id: 'plugin-1',
          requireLicense: true,
          licenseStatus: true,
          licenseStatusDescription: 'Licensed',
        }),
        expect.objectContaining({
          id: 'plugin-2',
          requireLicense: false,
          licenseStatus: false,
          licenseStatusDescription: 'No license required',
        }),
      ],
      isFromAdmin: false,
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.objectContaining({ page: expect.objectContaining({ id: 'installedPluginListPage' }) }) }),
      expect.objectContaining({ message: { type: 'rc-adapter-navigate-to', path: '/customized/installedPluginListPage' } }),
    ]));
  });

  it('installs an admin plugin, registers it remotely, and refreshes plugin pages', async () => {
    seedStorage({
      adminSettings: {
        userSettings: {},
      },
      userSettings: {
        'plugin_plugin-1': {
          value: {
            name: 'Plugin One',
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'admin',
        ownerRcAccountId: 'owner-account-1',
        plugin: pluginList()[0],
      }, 'pluginAdminConfigButtons'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      buttonId: 'installButton',
    });

    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalledWith(expect.objectContaining({
      adminSettings: expect.objectContaining({
        userSettings: expect.objectContaining({
          'plugin_plugin-1': expect.objectContaining({
            value: expect.objectContaining({
              name: 'Plugin One',
              access: 'admin',
              config: {
                apiKey: {
                  value: null,
                  customizable: true,
                },
                hiddenKey: {
                  value: null,
                  customizable: false,
                },
              },
            }),
          }),
        }),
      }),
    }));
    expect(axios.post).toHaveBeenCalledWith(
      'https://server.example/plugin/register',
      expect.objectContaining({
        pluginId: 'plugin-1',
        pluginAccess: 'admin',
        rcAccountId: '1001',
        ownerRcAccountId: 'owner-account-1',
      }),
      { headers: { 'X-RC-Access-Token': 'rc-access-token' } },
    );
    expect(loaded.pluginPages.getPluginAdminConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      installed: true,
    }));
    expect(loaded.pluginPages.getPluginMarketListPageRender).toHaveBeenCalled();
    expect(loaded.pluginPages.getInstalledPluginListPageRender).toHaveBeenCalledWith(expect.objectContaining({
      isFromAdmin: true,
    }));
  });

  it('walks plugin install, license-backed selection, and user configuration update', async () => {
    const installLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.ts',
    );

    await installLoaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'admin',
        ownerRcAccountId: 'owner-account-1',
        plugin: pluginList()[0],
      }, 'pluginAdminConfigButtons'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      buttonId: 'installButton',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://server.example/plugin/register',
      expect.objectContaining({
        pluginId: 'plugin-1',
        pluginAccess: 'admin',
        rcAccountId: '1001',
      }),
      { headers: { 'X-RC-Access-Token': 'rc-access-token' } },
    );

    seedStorage({
      userSettings: {
        'plugin_plugin-1': {
          value: {
            name: 'Plugin One',
            requireLicense: true,
            config: {
              apiKey: { value: 'saved-key' },
            },
          },
        },
      },
    });
    const selectLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: true,
        returnMessage: {
          messageType: 'success',
          message: 'Plugin authorized',
        },
      },
    });

    await selectLoaded.handler.onEvent({
      data: dataFor({ pluginList: pluginList(), isFromAdmin: false }, 'selectPlugin'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      listButtonItemId: 'plugin-1=user',
    });

    expect(selectLoaded.pluginService.getPluginLicenseStatus).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
    }));
    expect(selectLoaded.pluginPages.getPluginConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      hasValidLicense: true,
      isLoggedIn: true,
      config: {
        apiKey: { value: 'saved-key' },
      },
    }));

    const configLoaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigurePageSubmit.ts',
    );

    await configLoaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        plugin: pluginList()[0],
        isAsync: true,
        phase: 'postSave',
        access: 'user',
        supportedLogTypes: ['CallLog'],
        apiKey: { value: 'updated-key' },
      }, 'pluginConfigurePage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(configLoaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        'plugin_plugin-1': {
          value: expect.objectContaining({
            name: 'Plugin One',
            config: {
              apiKey: 'updated-key',
            },
          }),
          isCustomizable: true,
        },
      },
    });
  });

  it('removes an admin plugin, unregisters it remotely, and refreshes the installed list', async () => {
    seedStorage({
      adminSettings: {
        userSettings: {
          'plugin_plugin-1': {
            value: {
              name: 'Plugin One',
            },
          },
        },
      },
      userSettings: {
        'plugin_plugin-2': {
          value: {
            name: 'Plugin Two',
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'admin',
        ownerRcAccountId: 'owner-account-1',
        plugin: pluginList()[0],
      }, 'pluginAdminConfigButtons'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      buttonId: 'removeButton',
    });

    expect(axios.delete).toHaveBeenCalledWith('https://server.example/plugin/unregister', {
      headers: { 'X-RC-Access-Token': 'rc-access-token' },
      params: {
        rcAccountId: '1001',
        pluginName: 'Plugin One',
        pluginId: 'plugin-1',
      },
    });
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      settingKeysToRemove: ['plugin_plugin-1'],
    });
    expect(loaded.pluginPages.getInstalledPluginListPageRender).toHaveBeenCalledWith({
      pluginList: [expect.objectContaining({ id: 'plugin-2' })],
      isFromAdmin: true,
    });
  });

  it('rolls back plugin installation settings when remote registration fails', async () => {
    seedStorage({
      adminSettings: {
        userSettings: {},
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.ts',
    );
    vi.mocked(axios.post).mockRejectedValueOnce({
      response: {
        data: {
          returnMessage: 'Registration failed',
        },
      },
    });

    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'admin',
        ownerRcAccountId: 'owner-account-1',
        plugin: pluginList()[0],
      }, 'pluginAdminConfigButtons'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
      buttonId: 'installButton',
    });

    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalledTimes(2);
    expect(loaded.adminCore.uploadAdminSettings.mock.calls[1][0].adminSettings.userSettings['plugin_plugin-1'].isRemoved).toBe(true);
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Registration failed',
      ttl: 5000,
    });
  });

  it('submits user plugin configuration settings', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigurePageSubmit.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        plugin: pluginList()[0],
        isAsync: true,
        phase: 'postSave',
        access: 'user',
        supportedLogTypes: ['CallLog'],
        apiKey: { value: 'new-key' },
      }, 'pluginConfigurePage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(loaded.pluginPages.getMergedPluginConfigFromFormData).toHaveBeenCalled();
    expect(loaded.userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        'plugin_plugin-1': {
          value: expect.objectContaining({
            name: 'Plugin One',
            rcAccountId: 1002,
            config: {
              apiKey: 'new-key',
            },
          }),
          isCustomizable: true,
        },
      },
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Configuration is updated.',
      ttl: 3000,
    });
  });

  it('does not save user plugin configuration when required fields are missing', async () => {
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigurePageSubmit.ts',
      {
        pluginPages: {
          getMissingRequiredPluginConfigFields: vi.fn(() => [
            { const: 'apiKey', title: 'API key' },
          ]),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        plugin: pluginList()[0],
        access: 'user',
      }, 'pluginConfigurePage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(loaded.userCore.refreshUserSettings).not.toHaveBeenCalled();
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Please complete the required plugin configuration: API key.',
      ttl: 5000,
    });
  });

  it('submits admin plugin detail settings and locks hidden config fields', async () => {
    seedStorage({
      adminSettings: {
        userSettings: {
          'plugin_plugin-1': {
            value: {
              config: {
                apiKey: {
                  value: 'old-key',
                  customizable: true,
                },
              },
            },
          },
        },
      },
    });
    const loaded = await loadButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginDetailsSettingPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        hiddenConfigFields: ['apiSecret'],
        apiKey: {
          value: 'new-key',
          customizable: true,
        },
        apiSecret: {
          value: 'new-secret',
          customizable: true,
        },
      }, 'pluginDetailsSettingPage'),
      manifest: baseManifest(),
      platformName: 'salesforce',
      platform: baseManifest().platforms.salesforce,
    });

    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      adminSettings: {
        userSettings: {
          'plugin_plugin-1': {
            value: {
              config: {
                apiKey: {
                  value: 'new-key',
                  customizable: true,
                },
                apiSecret: {
                  value: 'new-secret',
                  customizable: false,
                },
              },
            },
          },
        },
      },
    });
  });
});
