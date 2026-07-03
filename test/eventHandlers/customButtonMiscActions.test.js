import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function manifest() {
  return {
    version: '1.7.35',
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        displayName: 'Salesforce',
        page: {
          feedback: {
            url: 'https://feedback.example?name={userName}&email={userEmail}&crm={crmName}&v={version}&rating={rating}',
          },
        },
      },
    },
  };
}

function dataFor(formData = {}, dismissed = false) {
  return {
    requestId: 'request-1',
    body: {
      button: {
        id: 'button',
        dismissed,
        formData,
      },
    },
  };
}

async function loadAction(modulePath, overrides = {}) {
  vi.resetModules();
  vi.mocked(axios.get).mockReset().mockResolvedValue({ data: { authUrl: 'https://plugin.example/auth' } });
  vi.mocked(axios.post).mockReset().mockResolvedValue({ data: { successful: true } });

  const util = {
    showNotification: vi.fn(),
    getRcInfo: vi.fn(async () => ({
      value: {
        cachedData: {
          accountInfo: { id: 'account-1' },
          extensionInfo: { id: 'extension-1', contact: { email: 'agent@example.test' } },
        },
      },
    })),
    getRcContactInfo: vi.fn(async () => [
      { id: '101', type: 'User', name: 'Jane User' },
      { id: '201', type: 'Department', name: 'Support Team' },
      { id: 'account', type: 'Company', name: 'Acme' },
    ]),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const analytics = {
    trackPage: vi.fn(),
  };
  vi.doMock('../../src/lib/analytics.js', () => analytics);

  const logRecorder = {
    startRecordingLogs: vi.fn(async () => {}),
    stopRecordingLogs: vi.fn(async () => {}),
    uploadLogs: vi.fn(async () => {}),
    logAction: vi.fn(),
    logBasicInfo: vi.fn(),
    ...overrides.logRecorder,
  };
  vi.doMock('../../src/lib/logRecorder.js', () => ({ default: logRecorder }));

  const adminCore = {
    uploadAdminSettings: vi.fn(async () => {}),
    getUserMapping: vi.fn(async () => [{ crmUser: { id: 'crm-1' }, rcUser: [] }]),
    reinitializeUserMapping: vi.fn(async () => {}),
    saveManagedAuthSettings: vi.fn(async () => {}),
    deleteManagedOAuthAccount: vi.fn(async () => {}),
    updateServerSideDoNotLogNumbers: vi.fn(async () => {}),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.js', () => ({ default: adminCore }));

  const userCore = {
    refreshUserSettings: vi.fn(async ({ changedSettings } = {}) => ({ userSettings: changedSettings ?? {} })),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.js', () => ({ default: userCore }));

  const authCore = {
    handleThirdPartyOAuthWindow: vi.fn(),
    ...overrides.authCore,
  };
  vi.doMock('../../src/core/auth.js', () => ({ default: authCore }));

  const embeddableServices = {
    getServiceManifest: vi.fn(async () => ({ id: 'service-manifest' })),
  };
  vi.doMock('../../src/service/embeddableServices.js', () => ({ default: embeddableServices }));

  const pluginService = {
    getPluginLicenseStatus: vi.fn(async () => ({
      licenseStatus: true,
      licenseStatusDescription: 'Licensed',
    })),
  };
  vi.doMock('../../src/service/pluginService.js', () => ({ default: pluginService }));

  vi.doMock('../../src/i18n/index.js', () => ({
    t: vi.fn((key) => key),
  }));

  const pages = {
    getLogRecordSubmissionPageRender: vi.fn((props) => ({ id: 'logRecordSubmissionPage', props })),
    getErrorLogRecordPageRender: vi.fn((props) => ({ id: 'errorLogRecordPage', props })),
    getAboutPageRender: vi.fn((props) => ({ id: 'aboutPage', props })),
    getDeveloperSettingsPageRender: vi.fn((props) => ({ id: 'developerSettingsPage', props })),
    getImplementedInterfacesPageRender: vi.fn((props) => ({ id: 'implementedInterfacesPage', props })),
    getManagedAuthUserEditPageRender: vi.fn((props) => ({ id: 'managedAuthUserEditPage', props })),
    getUserMappingPageRender: vi.fn((props) => ({ id: 'userMappingPage', props })),
    renderEditUserMappingPage: vi.fn((props) => ({ id: 'editUserMappingPage', props })),
    getPluginConfigurePageRender: vi.fn((props) => ({ id: 'pluginConfigurePage', props })),
    getMergedPluginConfigFromFormData: vi.fn((form) => ({ apiKey: form.apiKey?.value ?? form.apiKey })),
  };
  vi.doMock('../../src/components/logRecordSubmissionPage.js', () => ({
    getLogRecordSubmissionPageRender: pages.getLogRecordSubmissionPageRender,
  }));
  vi.doMock('../../src/components/errorLogRecordPage.js', () => ({
    getErrorLogRecordPageRender: pages.getErrorLogRecordPageRender,
  }));
  vi.doMock('../../src/components/aboutPage.js', () => ({ default: { getAboutPageRender: pages.getAboutPageRender } }));
  vi.doMock('../../src/components/developerSettingsPage/index.js', () => ({ default: { getDeveloperSettingsPageRender: pages.getDeveloperSettingsPageRender } }));
  vi.doMock('../../src/components/developerSettingsPage/implementedInterfacesPage.js', () => ({ default: { getImplementedInterfacesPageRender: pages.getImplementedInterfacesPageRender } }));
  vi.doMock('../../src/components/admin/managedAuthUserEditPage.js', () => ({ default: { getManagedAuthUserEditPageRender: pages.getManagedAuthUserEditPageRender } }));
  vi.doMock('../../src/components/admin/userMappingPage/userMappingPage.js', () => ({ default: { getUserMappingPageRender: pages.getUserMappingPageRender } }));
  vi.doMock('../../src/components/admin/userMappingPage/editUserMappingPage.js', () => ({ default: { renderEditUserMappingPage: pages.renderEditUserMappingPage } }));
  vi.doMock('../../src/components/pluginConfigurePage.js', () => ({
    getPluginConfigurePageRender: pages.getPluginConfigurePageRender,
    getMergedPluginConfigFromFormData: pages.getMergedPluginConfigFromFormData,
  }));

  const handler = await loadModule(modulePath);
  return {
    handler,
    util,
    analytics,
    logRecorder,
    adminCore,
    userCore,
    authCore,
    embeddableServices,
    pluginService,
    pages,
  };
}

describe('custom-button miscellaneous action handlers', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      rcUserInfo: {
        rcUserName: 'Jane Agent',
        rcUserEmail: 'jane@example.test',
      },
      adminSettings: {
        userSettings: {
          serverSideLogging: {},
        },
        userMappings: [
          {
            crmUserId: 'crm-1',
            rcExtensionId: ['101'],
          },
        ],
      },
      managedAuthSettings: {
        orgFields: [{ const: 'clientId' }, { const: 'clientSecret' }],
        orgValues: {
          clientSecret: { hasValue: true },
        },
        userFields: [{ const: 'clientSecret' }],
        userValues: [],
      },
    });
  });

  it('handles navigation actions and banner dismissal/opening', async () => {
    let loaded = await loadAction(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.js',
    );
    await loaded.handler.onEvent({
      data: {
        body: {
          button: {
            id: 'temp-webinar-banner',
            dismissed: true,
            formData: {},
          },
        },
      },
      manifest: manifest(),
    });
    expect(readStorage().myBannerDismissedDate).toEqual(expect.any(Number));

    await loaded.handler.onEvent({
      data: dataFor({}, false),
      manifest: manifest(),
    });
    expect(loaded.pages.getLogRecordSubmissionPageRender).toHaveBeenCalled();
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-update-customized-banner',
          banner: { id: 'log-recording-banner', hidden: true },
        },
      }),
    ]));

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openAboutPage.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest(), platformName: 'salesforce' });
    expect(loaded.pages.getAboutPageRender).toHaveBeenCalledWith({ platformName: 'salesforce', manifest: manifest() });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openDeveloperSettingsPage.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });
    expect(loaded.pages.getDeveloperSettingsPageRender).toHaveBeenCalled();

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openImplementedInterfacesPageButton.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });
    expect(loaded.pages.getImplementedInterfacesPageRender).toHaveBeenCalled();

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/feedbackPage.js');
    await loaded.handler.onEvent({
      data: dataFor({ rating: 'great service' }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(window.open).toHaveBeenCalledWith('https://feedback.example?name=Jane Agent&email=jane@example.test&crm=Salesforce&v=1.7.35&rating=great%20service', '_blank');

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest(), platform: { documentationUrl: 'https://docs.example' } });
    expect(window.open).toHaveBeenCalledWith('https://docs.example');
    expect(loaded.analytics.trackPage).toHaveBeenCalledWith('/documentation');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest(), platform: {} });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Documentation URL is not set',
      ttl: 3000,
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/insightlyGetApiKey.js');
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformInfo: {
        hostname: 'insightly.example',
      },
    });
    expect(window.open).toHaveBeenCalledWith('https://insightly.example/Users/UserSettings');
  });

  it('records and uploads error logs through the issue report flow', async () => {
    let loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/reportIssueButton.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });
    expect(loaded.pages.getErrorLogRecordPageRender).toHaveBeenCalledWith({
      email: 'agent@example.test',
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageNextStep.js');
    await loaded.handler.onEvent({
      data: dataFor({ email: 'agent@example.test', issueDescription: 'Broken flow' }),
      manifest: manifest(),
    });
    expect(readStorage().issueDescription).toBe('Broken flow');
    expect(loaded.pages.getErrorLogRecordPageRender).toHaveBeenCalledWith({
      step: 2,
      email: 'agent@example.test',
      issueDescription: 'Broken flow',
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageStart.js');
    await loaded.handler.onEvent({
      data: dataFor({ email: 'agent@example.test', issueDescription: 'Broken flow' }),
      manifest: manifest(),
      platformInfo: { hostname: 'crm.example' },
    });
    expect(loaded.logRecorder.startRecordingLogs).toHaveBeenCalled();
    expect(loaded.logRecorder.logBasicInfo).toHaveBeenCalledWith(expect.objectContaining({
      version: '1.7.35',
    }));

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });
    expect(loaded.logRecorder.logAction).toHaveBeenCalledWith({ name: 'user description', data: 'Broken flow' });
    expect(loaded.logRecorder.uploadLogs).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Successfully uploaded.',
      ttl: 3000,
    });

    loaded = await loadAction(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.js',
      {
        logRecorder: {
          uploadLogs: vi.fn(async () => {
            throw new Error('upload failed');
          }),
        },
      },
    );
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Failed to upload logs. Please try again.',
      ttl: 3000,
    });
  });

  it('updates admin settings, managed auth, user mapping, and plugin action pages', async () => {
    let loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/doNotLogNumbersSubmit.js');
    await loaded.handler.onEvent({
      data: dataFor({ doNotLogNumbersHolder: { doNotLogNumbers: '+16505550100' } }),
      manifest: manifest(),
      platform: { name: 'salesforce' },
    });
    expect(loaded.adminCore.updateServerSideDoNotLogNumbers).toHaveBeenCalledWith({
      platform: { name: 'salesforce' },
      doNotLogNumbers: '+16505550100',
    });
    expect(loaded.embeddableServices.getServiceManifest).toHaveBeenCalled();

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthOrgPage.js');
    await loaded.handler.onEvent({
      data: dataFor({ clientId: 'client-id', clientSecret: '' }),
      manifest: manifest(),
    });
    expect(loaded.adminCore.saveManagedAuthSettings).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      scope: 'account',
      values: { clientId: 'client-id' },
      fieldsToRemove: ['clientSecret'],
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserEdit.js');
    await loaded.handler.onEvent({
      data: dataFor({ userSearch: { search: 'Jane', filter: 'All' } }),
      listButtonItemId: '101',
    });
    expect(loaded.pages.getManagedAuthUserEditPageRender).toHaveBeenCalledWith(expect.objectContaining({
      rcExtension: { id: '101', type: 'User', name: 'Jane User' },
    }));

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/deleteManagedOAuthAccount.js');
    await loaded.handler.onEvent({ manifest: manifest(), platformName: 'salesforce' });
    expect(loaded.adminCore.deleteManagedOAuthAccount).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingRemove.js');
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platform: { displayName: 'Salesforce' },
      listButtonItemId: 'crm-1',
    });
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      adminSettings: expect.objectContaining({
        userMappings: [
          {
            crmUserId: 'crm-1',
            rcExtensionId: [],
          },
        ],
      }),
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingEdit.js');
    await loaded.handler.onEvent({
      data: dataFor({ allUserMapping: [{ crmUser: { id: 'crm-1' } }] }),
      platform: { displayName: 'Salesforce' },
      listButtonItemId: 'crm-1',
    });
    expect(loaded.pages.renderEditUserMappingPage).toHaveBeenCalledWith(expect.objectContaining({
      userMapping: { crmUser: { id: 'crm-1' } },
    }));

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.js');
    await loaded.handler.onEvent({
      data: dataFor({
        crmUserId: 'crm-1',
        rcExtensionList: ['102'],
      }),
      manifest: manifest(),
      platform: { displayName: 'Salesforce' },
    });
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenLastCalledWith({
      serverUrl: 'https://server.example',
      adminSettings: expect.objectContaining({
        userMappings: [
          {
            crmUserId: 'crm-1',
            rcExtensionId: ['102'],
          },
        ],
      }),
    });
    expect(loaded.adminCore.getUserMapping).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
    });
    expect(loaded.pages.getUserMappingPageRender).toHaveBeenCalledWith({
      userMapping: [{ crmUser: { id: 'crm-1' }, rcUser: [] }],
      platformDisplayName: 'Salesforce',
    });

    seedStorage({
      adminSettings: {
        userMappings: [
          {
            crmUserId: 'crm-1',
            rcExtensionId: ['102'],
          },
        ],
      },
    });
    await loaded.handler.onEvent({
      data: dataFor({
        crmUserId: 'crm-1',
        rcExtensionList: [],
      }),
      manifest: manifest(),
      platform: { displayName: 'Salesforce' },
    });
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenLastCalledWith({
      serverUrl: 'https://server.example',
      adminSettings: {
        userMappings: [],
      },
    });

    seedStorage({
      adminSettings: {},
    });
    await loaded.handler.onEvent({
      data: dataFor({
        crmUserId: 2,
        rcExtensionList: ['103'],
      }),
      manifest: manifest(),
      platform: { displayName: 'Salesforce' },
    });
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenLastCalledWith({
      serverUrl: 'https://server.example',
      adminSettings: {
        userMappings: [
          {
            crmUserId: '2',
            rcExtensionId: ['103'],
          },
        ],
      },
    });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/reinitializeUserMappingButton.js');
    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });
    expect(loaded.adminCore.reinitializeUserMapping).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.js');
    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'user',
        plugin: {
          authorizationUrl: 'https://plugin.example/authorize',
          logoutUrl: 'https://plugin.example/logout',
        },
        apiKey: { value: 'key' },
      }),
      manifest: manifest(),
      buttonId: 'pluginAuthButton',
    });
    expect(loaded.authCore.handleThirdPartyOAuthWindow).toHaveBeenCalledWith('https://plugin.example/auth');
    expect(readStorage().cachedPluginConfigFormData.pluginId).toBe('plugin-1');

    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'user',
        plugin: {
          authorizationUrl: 'https://plugin.example/authorize',
          logoutUrl: 'https://plugin.example/logout',
        },
        apiKey: { value: 'key' },
      }),
      manifest: manifest(),
      buttonId: 'pluginLogoutButton',
    });
    expect(loaded.pages.getPluginConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      isLoggedIn: false,
      hasValidLicense: true,
    }));

    loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginLicenseRefreshButton.js');
    await loaded.handler.onEvent({
      data: dataFor({
        pluginId: 'plugin-1',
        access: 'user',
        isLoggedIn: true,
        plugin: {},
      }),
      manifest: manifest(),
    });
    expect(loaded.pages.getPluginConfigurePageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      isLoggedIn: true,
      hasValidLicense: true,
    }));
  });
});
