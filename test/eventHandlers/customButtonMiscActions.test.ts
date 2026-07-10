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

async function loadAction(modulePath, overrides: Record<string, any> = {}) {
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
  vi.doMock('../../src/lib/util.ts', () => util);

  const analytics = {
    trackPage: vi.fn(),
  };
  vi.doMock('../../src/lib/analytics.ts', () => analytics);

  const logRecorder = {
    startRecordingLogs: vi.fn(async () => {}),
    stopRecordingLogs: vi.fn(async () => {}),
    uploadLogs: vi.fn(async () => {}),
    logAction: vi.fn(),
    logBasicInfo: vi.fn(),
    ...overrides.logRecorder,
  };
  vi.doMock('../../src/lib/logRecorder.ts', () => ({ default: logRecorder }));

  const adminCore = {
    uploadAdminSettings: vi.fn(async () => {}),
    getUserMapping: vi.fn(async () => [{ crmUser: { id: 'crm-1' }, rcUser: [] }]),
    reinitializeUserMapping: vi.fn(async () => {}),
    saveManagedAuthSettings: vi.fn(async () => {}),
    deleteManagedOAuthAccount: vi.fn(async () => {}),
    updateServerSideDoNotLogNumbers: vi.fn(async () => {}),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.ts', () => ({ default: adminCore }));

  const userCore = {
    refreshUserSettings: vi.fn(async ({ changedSettings } = {}) => ({ userSettings: changedSettings ?? {} })),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const authCore = {
    handleThirdPartyOAuthWindow: vi.fn(),
    ...overrides.authCore,
  };
  vi.doMock('../../src/core/auth.ts', () => ({ default: authCore }));

  const embeddableServices = {
    getServiceManifest: vi.fn(async () => ({ id: 'service-manifest' })),
  };
  vi.doMock('../../src/service/embeddableServices.ts', () => ({ default: embeddableServices }));

  const pluginService = {
    getPluginLicenseStatus: vi.fn(async () => ({
      licenseStatus: true,
      licenseStatusDescription: 'Licensed',
    })),
  };
  vi.doMock('../../src/service/pluginService.ts', () => ({ default: pluginService }));

  vi.doMock('../../src/i18n/index.ts', () => ({
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
  vi.doMock('../../src/components/logRecordSubmissionPage.ts', () => ({
    getLogRecordSubmissionPageRender: pages.getLogRecordSubmissionPageRender,
  }));
  vi.doMock('../../src/components/errorLogRecordPage.ts', () => ({
    getErrorLogRecordPageRender: pages.getErrorLogRecordPageRender,
  }));
  vi.doMock('../../src/components/aboutPage.ts', () => ({ default: { getAboutPageRender: pages.getAboutPageRender } }));
  vi.doMock('../../src/components/developerSettingsPage/index.ts', () => ({ default: { getDeveloperSettingsPageRender: pages.getDeveloperSettingsPageRender } }));
  vi.doMock('../../src/components/developerSettingsPage/implementedInterfacesPage.ts', () => ({ default: { getImplementedInterfacesPageRender: pages.getImplementedInterfacesPageRender } }));
  vi.doMock('../../src/components/admin/managedAuthUserEditPage.ts', () => ({ default: { getManagedAuthUserEditPageRender: pages.getManagedAuthUserEditPageRender } }));
  vi.doMock('../../src/components/admin/userMappingPage/userMappingPage.ts', () => ({ default: { getUserMappingPageRender: pages.getUserMappingPageRender } }));
  vi.doMock('../../src/components/admin/userMappingPage/editUserMappingPage.ts', () => ({ default: { renderEditUserMappingPage: pages.renderEditUserMappingPage } }));
  vi.doMock('../../src/components/pluginConfigurePage.ts', () => ({
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

  it('stores the banner dismissal timestamp', async () => {
    const loaded = await loadAction(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.ts',
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
  });

  it('opens the log-record submission page from the customized banner', async () => {
    const loaded = await loadAction(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.ts',
    );

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
  });

  it('opens the about page with platform context', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openAboutPage.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest(), platformName: 'salesforce' });

    expect(loaded.pages.getAboutPageRender).toHaveBeenCalledWith({ platformName: 'salesforce', manifest: manifest() });
  });

  it('opens the developer settings page', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openDeveloperSettingsPage.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });

    expect(loaded.pages.getDeveloperSettingsPageRender).toHaveBeenCalled();
  });

  it('opens the implemented interfaces page', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openImplementedInterfacesPageButton.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });

    expect(loaded.pages.getImplementedInterfacesPageRender).toHaveBeenCalled();
  });

  it('opens the configured feedback URL with encoded user and rating context', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/feedbackPage.ts');

    await loaded.handler.onEvent({
      data: dataFor({ rating: 'great service' }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(window.open).toHaveBeenCalledWith('https://feedback.example?name=Jane Agent&email=jane@example.test&crm=Salesforce&v=1.7.35&rating=great%20service', '_blank');
  });

  it('opens documentation and tracks the documentation page', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest(), platform: { documentationUrl: 'https://docs.example' } });

    expect(window.open).toHaveBeenCalledWith('https://docs.example');
    expect(loaded.analytics.trackPage).toHaveBeenCalledWith('/documentation');
  });

  it('warns when documentation URL is missing', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest(), platform: {} });

    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Documentation URL is not set',
      ttl: 3000,
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('opens the Insightly API key settings page from platform hostname', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/insightlyGetApiKey.ts');

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformInfo: {
        hostname: 'insightly.example',
      },
    });
    expect(window.open).toHaveBeenCalledWith('https://insightly.example/Users/UserSettings');
  });

  it('opens the issue report page with the current RC user email', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/reportIssueButton.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });

    expect(loaded.pages.getErrorLogRecordPageRender).toHaveBeenCalledWith({
      email: 'agent@example.test',
    });
  });

  it('stores issue description before moving the issue report flow to step two', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageNextStep.ts');

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
  });

  it('starts recording logs with basic extension context', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageStart.ts');

    await loaded.handler.onEvent({
      data: dataFor({ email: 'agent@example.test', issueDescription: 'Broken flow' }),
      manifest: manifest(),
      platformInfo: { hostname: 'crm.example' },
    });
    expect(loaded.logRecorder.startRecordingLogs).toHaveBeenCalled();
    expect(loaded.logRecorder.logBasicInfo).toHaveBeenCalledWith(expect.objectContaining({
      version: '1.7.35',
    }));
  });

  it('uploads recorded logs and notifies success', async () => {
    seedStorage({
      issueDescription: 'Broken flow',
    });
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });

    expect(loaded.logRecorder.logAction).toHaveBeenCalledWith({ name: 'user description', data: 'Broken flow' });
    expect(loaded.logRecorder.uploadLogs).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Successfully uploaded.',
      ttl: 3000,
    });
  });

  it('notifies failure when recorded log upload fails', async () => {
    const loaded = await loadAction(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.ts',
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

  it('updates server-side do-not-log numbers and reloads the service manifest', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/doNotLogNumbersSubmit.ts');

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
  });

  it('saves managed-auth org settings and removes blank secret fields', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthOrgPage.ts');

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
  });

  it('opens managed-auth user edit page for the selected extension', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserEdit.ts');

    await loaded.handler.onEvent({
      data: dataFor({ userSearch: { search: 'Jane', filter: 'All' } }),
      listButtonItemId: '101',
    });
    expect(loaded.pages.getManagedAuthUserEditPageRender).toHaveBeenCalledWith(expect.objectContaining({
      rcExtension: { id: '101', type: 'User', name: 'Jane User' },
    }));
  });

  it('deletes the managed OAuth account for the current platform', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/deleteManagedOAuthAccount.ts');

    await loaded.handler.onEvent({ manifest: manifest(), platformName: 'salesforce' });

    expect(loaded.adminCore.deleteManagedOAuthAccount).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
    });
  });

  it('removes RC extension assignments from a selected CRM user mapping', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingRemove.ts');

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
  });

  it('opens the user-mapping edit page for the selected CRM user', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingEdit.ts');

    await loaded.handler.onEvent({
      data: dataFor({ allUserMapping: [{ crmUser: { id: 'crm-1' } }] }),
      platform: { displayName: 'Salesforce' },
      listButtonItemId: 'crm-1',
    });
    expect(loaded.pages.renderEditUserMappingPage).toHaveBeenCalledWith(expect.objectContaining({
      userMapping: { crmUser: { id: 'crm-1' } },
    }));
  });

  it('updates an existing user mapping and re-renders the mapping page', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.ts');

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
  });

  it('removes an existing user mapping when its RC extension list becomes empty', async () => {
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
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.ts');

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
  });

  it('creates a new user mapping when no admin settings exist', async () => {
    seedStorage({
      adminSettings: {},
    });
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.ts');

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
  });

  it('reinitializes user mapping from the server', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/reinitializeUserMappingButton.ts');

    await loaded.handler.onEvent({ data: dataFor(), manifest: manifest() });

    expect(loaded.adminCore.reinitializeUserMapping).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });
  });

  it('opens plugin OAuth and caches the plugin config form data', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.ts');

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
  });

  it('logs out plugin config and renders the plugin configuration page as logged out', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.ts');

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
  });

  it('refreshes plugin license status on the plugin configuration page', async () => {
    const loaded = await loadAction('../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginLicenseRefreshButton.ts');

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
