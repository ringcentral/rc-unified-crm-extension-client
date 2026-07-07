// @ts-nocheck
import axios from 'axios';
import authCore from '../../src/core/auth.ts';
import { loadModule } from '../helpers/loadModule';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/core/auth.ts', () => ({
  default: {
    isAdminManagedOAuthEnabled: vi.fn(),
  },
}));

async function loadPage(modulePath) {
  vi.resetModules();
  return loadModule(modulePath);
}

function manifest() {
  return {
    version: '1.7.35',
    serverUrl: 'https://server.example',
    author: {
      name: 'RingCentral',
      websiteUrl: 'https://developer.example',
      supportUrl: 'https://support.example',
    },
    platforms: {
      salesforce: {
        name: 'salesforce',
        displayName: 'Salesforce',
        logoUrl: 'https://logo.example/salesforce.png',
        supportReportIssue: true,
        auth: {
          type: 'apiKey',
          apiKey: {
            page: {
              title: 'Connect Salesforce',
              warning: 'Use admin credentials',
              content: [
                {
                  const: 'apiUrl',
                  title: 'API URL',
                  type: 'string',
                  description: 'CRM API URL',
                  required: true,
                  defaultValue: 'https://crm.example',
                },
                {
                  const: 'secret',
                  title: 'Secret',
                  type: 'string',
                  required: true,
                  hidden: true,
                  managed: true,
                  uiSchema: { 'ui:widget': 'password' },
                },
                {
                  const: 'token',
                  title: 'Token',
                  type: 'string',
                  managed: true,
                },
              ],
            },
          },
        },
        serverSideLogging: true,
        settings: {
          customThreshold: {
            type: 'number',
            title: 'Threshold',
          },
        },
      },
    },
  };
}

describe('basic page renderers', () => {
  it('renders about, support, feedback, and auth pages from manifest configuration', async () => {
    const aboutPage = await loadPage('../../src/components/aboutPage.ts');
    const supportPage = await loadPage('../../src/components/supportPage.ts');
    const feedbackPage = await loadPage('../../src/components/feedbackPage.ts');
    const authPage = await loadPage('../../src/components/authPage.ts');

    const about = aboutPage.getAboutPageRender({ manifest: manifest(), platformName: 'salesforce' });
    expect(about).toMatchObject({
      id: 'aboutPage',
      schema: {
        properties: {
          adapterAuthorInfo: {
            oneOf: [
              expect.objectContaining({
                title: 'pages.about.adapterAuthor',
                description: 'Developed by RingCentral',
                icon: 'https://logo.example/salesforce.png',
              }),
            ],
          },
          extensionVersionInfo: expect.any(Object),
        },
      },
    });

    const support = supportPage.getSupportPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      isOnline: false,
      rcAccountId: 'account-1',
    });
    expect(support.schema.properties).toMatchObject({
      reportIssueButton: expect.any(Object),
      clearLogConflictsButton: expect.any(Object),
      factoryResetButton: expect.any(Object),
    });

    const feedback = feedbackPage.getFeedbackPageRender({
      version: '1.7.35',
      pageConfig: {
        elements: [
          { const: 'intro', type: 'string', title: 'Tell us more', bold: true },
          { const: 'comment', type: 'inputField', title: 'Comment', placeholder: 'Type here', required: true },
          {
            const: 'rating',
            type: 'selection',
            title: 'Rating',
            selections: [{ const: 'good', title: 'Good' }],
          },
        ],
      },
    });
    expect(feedback.schema.required).toEqual(['comment']);
    expect(feedback.schema.properties.rating.oneOf).toHaveLength(1);
    expect(feedback.formData.version).toBe('1.7.35');

    const userAuth = authPage.getAuthPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      isAdmin: false,
      visibleFieldConsts: ['apiUrl', 'token'],
      warningMessage: 'Custom warning',
    });
    expect(userAuth.schema.required).toEqual(['apiUrl']);
    expect(userAuth.schema.properties).toHaveProperty('warning');
    expect(userAuth.schema.properties).not.toHaveProperty('secret');
    expect(userAuth.formData.apiUrl).toBe('https://crm.example');

    const adminAuth = authPage.getAuthPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      isAdmin: true,
    });
    expect(adminAuth.schema.properties.secret).toMatchObject({
      title: 'Secret',
      type: 'string',
    });
    expect(adminAuth.uiSchema.secret).toEqual({ 'ui:widget': 'password' });
  });

  it('renders setup, selection, schedule, temporary-note, and error-record pages', async () => {
    const hostnamePage = await loadPage('../../src/components/hostnameInputPage.ts');
    const platformSelectionPage = await loadPage('../../src/components/platformSelectionPage.ts');
    const managedOAuthSetupPage = await loadPage('../../src/components/managedOAuthSetupPage.ts');
    const managedOAuthMissingPage = await loadPage('../../src/components/managedOAuthMissingPage.ts');
    const multiContactPromptPage = await loadPage('../../src/components/multiContactPopPromptPage.ts');
    const logRecordSubmissionPage = await loadPage('../../src/components/logRecordSubmissionPage.ts');
    const tempLogNotePage = await loadPage('../../src/components/tempLogNotePage.ts');
    const schedulePage = await loadPage('../../src/components/schedulePage.ts');
    const errorLogRecordPage = await loadPage('../../src/components/errorLogRecordPage.ts');

    const dynamicHost = hostnamePage.getHostnameInputPageRender({
      platform: {
        name: 'salesforce',
        displayName: 'Salesforce',
        environment: {
          type: 'dynamic',
          url: 'https://{hostname}.example',
          instructions: ['Copy the CRM hostname.', 'Paste it here.'],
        },
      },
      inputUrl: 'bad-url',
      isUrlValid: false,
      readyMessage: 'Ready to connect',
      connectorId: 'connector-1',
      isPrivate: true,
    });
    expect(dynamicHost.schema.required).toContain('url');
    expect(dynamicHost.uiSchema.url['ui:help']).toEqual(expect.any(String));
    expect(dynamicHost.formData).toMatchObject({
      platformId: 'salesforce',
      connectorId: 'connector-1',
      isPrivate: true,
    });

    const selectableHost = hostnamePage.getHostnameInputPageRender({
      platform: {
        name: 'sandbox',
        environment: {
          type: 'selectable',
          selections: [{ const: 'prod', name: 'Production' }],
        },
      },
      selection: 'prod',
    });
    expect(selectableHost.schema.properties.selection.oneOf[0]).toMatchObject({
      const: 'prod',
      title: 'Production',
    });

    const overriddenHost = hostnamePage.getHostnameInputPageRender({
      platform: {
        name: 'custom',
        environment: { type: 'dynamic' },
        overrides: {
          schema: { properties: { customField: { type: 'string' } } },
          uiSchema: { customField: { 'ui:widget': 'textarea' } },
        },
      },
    });
    expect(overriddenHost.schema.properties).toHaveProperty('customField');

    const selection = platformSelectionPage.getPlatformSelectionPageRender({
      platformList: [
        {
          id: 'p1',
          access: 'public',
          displayName: 'Salesforce',
          developer: { name: 'RingCentral' },
        },
        {
          id: 'p2',
          access: 'private',
          name: 'Hidden CRM',
          developer: { name: 'Private Dev' },
        },
      ],
      searchWord: 'hidden',
      selectedPlatform: 'p2=private',
      filter: 'common.labels.all',
    });
    expect(selection.schema.properties.platforms.oneOf).toHaveLength(1);
    expect(selection.formData.platforms).toBe('p2=private');

    const oauth = managedOAuthSetupPage.getManagedOAuthSetupPageRender({
      platform: {
        auth: {
          oauth: {
            adminManaged: {
              setupNotes: 'Create a connected app first.',
            },
          },
        },
      },
      pendingValues: {
        clientId: 'client-1',
        hostname: 'crm.example',
      },
    });
    expect(oauth.schema.required).toEqual(expect.arrayContaining(['clientId', 'clientSecret', 'hostname']));
    expect(oauth.schema.properties).toHaveProperty('setupNotes');
    expect(oauth.formData).toMatchObject({
      clientId: 'client-1',
      hostname: 'crm.example',
    });

    expect(managedOAuthMissingPage.getManagedOAuthMissingPageRender().uiSchema.submitButtonOptions.norender).toBe(true);

    const prompt = multiContactPromptPage.getMultiContactPopPromptPageRender({
      searchWord: 'alex',
      contactInfo: [
        { id: 1, name: 'Jane Smith', type: 'Lead' },
        { id: 2, name: 'Alex Green', type: 'Contact' },
      ],
    });
    expect(prompt.schema.properties.contactList.oneOf).toEqual([
      expect.objectContaining({ const: 2, title: 'Alex Green' }),
    ]);

    expect(logRecordSubmissionPage.getLogRecordSubmissionPageRender({ piiConsent: false }).uiSchema.logRecordSubmitButton['ui:disabled']).toBe(true);
    expect(logRecordSubmissionPage.getLogRecordSubmissionPageRender({ piiConsent: true }).uiSchema.logRecordSubmitButton['ui:disabled']).toBe(false);
    expect(tempLogNotePage.getTempLogNotePageRender({ cachedNote: 'Draft', sessionId: 'session-1' }).formData).toEqual({
      note: 'Draft',
      sessionId: 'session-1',
    });

    const scheduled = schedulePage.getSchedulePageRender({
      phoneNumber: '+16505550100',
      listOneOf: [{ const: 'new-contact', title: 'New Contact', isNewContact: true }],
      isDefaultNew: true,
      preselect: 'new-contact',
      contactTypes: [{ value: 'Lead', display: 'Lead' }],
    });
    expect(scheduled.schema.required).toEqual(['callbackDateTime']);
    expect(scheduled.formData.newContactType).toBe('Lead');

    expect(errorLogRecordPage.getErrorLogRecordPageRender({ step: 1, email: 'user@example.test' }).uiSchema.getErrorLogRecordPageNextStepButton['ui:disabled']).toBe(true);
    expect(errorLogRecordPage.getErrorLogRecordPageRender({ step: 2 }).schema.properties).toHaveProperty('errorLogRecordPageStartButton');
    expect(errorLogRecordPage.getErrorLogRecordPageRender({ step: 3 }).title).toBe('Recording in process');
  });

  it('renders plugin configuration, release notes, and release-note empty states', async () => {
    const pluginConfigurePage = await loadPage('../../src/components/pluginConfigurePage.ts');
    const releaseNotesPage = await loadPage('../../src/components/releaseNotesPage.ts');

    const plugin = {
      name: 'vendor.workflow',
      displayName: 'Workflow Plugin',
      description: 'Adds custom workflow fields.',
      iconUrl: 'https://plugin.example/icon.png',
      isAsync: true,
      phase: 'beta',
      supportedLogTypes: ['Call', 'Message'],
      showAuthorizationButton: true,
      requireLicense: true,
      pageContent: [
        {
          const: 'region',
          type: 'selection',
          title: 'Region',
          required: true,
          oneOf: [{ const: 'us', title: 'United States' }],
        },
        {
          const: 'scopes',
          type: 'selection',
          title: 'Scopes',
          multiSelect: true,
          oneOf: [
            { const: 'read', title: 'Read' },
            { const: 'write', title: 'Write' },
          ],
        },
        {
          const: 'hiddenField',
          type: 'string',
          title: 'Hidden',
          hidden: true,
        },
      ],
    };
    const page = pluginConfigurePage.getPluginConfigurePageRender({
      pluginId: 'plugin-1',
      pluginAccess: 'private',
      plugin,
      config: {
        region: { value: 'us', customizable: false },
        scopes: { value: ['read'] },
      },
      isLoggedIn: true,
      hasValidLicense: false,
      licenseStatusDescription: 'Expired',
    });

    expect(page.schema.required).toEqual(['region']);
    expect(page.schema.properties.config.properties.region).toMatchObject({
      readOnly: true,
      default: 'us',
    });
    expect(page.schema.properties.config.properties.scopes).toMatchObject({
      type: 'array',
      uniqueItems: true,
    });
    expect(page.uiSchema.config.scopes['ui:widget']).toBe('checkboxes');
    expect(page.schema.properties.basicInfo.oneOf).toEqual(expect.arrayContaining([
      expect.objectContaining({ const: 'licenseStatus', descriptionColor: 'error' }),
    ]));
    expect(page.schema.properties.basicInfo.oneOf[0].actions[0].id).toBe('pluginLogoutButton');
    expect(pluginConfigurePage.getMergedPluginConfigFromFormData({
      existingConfig: {
        region: { value: 'eu', customizable: true },
      },
      config: {
        region: 'us',
        scopes: ['read', 'write'],
      },
    })).toEqual({
      region: { value: 'us', customizable: true },
      scopes: { value: ['read', 'write'] },
    });

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        '1.7.35': {
          global: [
            { type: 'Feature', description: 'New dashboard [Button]Open|https://docs.example' },
          ],
          salesforce: [
            { type: 'Fix', description: 'Fixed auth' },
          ],
        },
      },
    });
    const releasePage = await releaseNotesPage.getReleaseNotesPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      registeredVersion: '1.7.34',
    });
    expect(releasePage.schema.properties).toHaveProperty('Feature-0');
    expect(releasePage.formData['link-button-Open']).toBe('https://docs.example');

    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });
    await expect(releaseNotesPage.getReleaseNotesPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      registeredVersion: '1.7.35',
    })).resolves.toBeNull();

    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network'));
    await expect(releaseNotesPage.getReleaseNotesPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      registeredVersion: '1.7.34',
    })).resolves.toBeNull();
  });
});

describe('admin page renderers', () => {
  beforeEach(() => {
    vi.mocked(authCore.isAdminManagedOAuthEnabled).mockReset();
  });

  it('renders admin navigation pages with optional sections', async () => {
    vi.mocked(authCore.isAdminManagedOAuthEnabled).mockReturnValue(true);
    const adminPage = await loadPage('../../src/components/admin/adminPage.ts');
    const generalSettingPage = await loadPage('../../src/components/admin/generalSettingPage.ts');
    const managedSettingsPage = await loadPage('../../src/components/admin/managedSettingsPage.ts');
    const managedAuthenticationPage = await loadPage('../../src/components/admin/managedAuthenticationPage.ts');
    const managedOAuthAdminPage = await loadPage('../../src/components/admin/managedOAuthAdminPage.ts');

    const admin = adminPage.getAdminPageRender({ platform: manifest().platforms.salesforce });
    expect(admin.schema.properties.section.oneOf.map((item) => item.const)).toEqual([
      'managedSettings',
      'managedAuthentication',
      'managedOAuth',
      'serverSideLoggingSetting',
      'plugins',
    ]);

    expect(generalSettingPage.getGeneralSettingPageRender().schema.properties.section.oneOf.map((item) => item.const)).toEqual([
      'appearance',
      'clickToDialMatcher',
      'clickToDialEmbed',
    ]);

    const managedSettings = managedSettingsPage.getManagedSettingsPageRender({
      crmManifest: {
        name: 'googleSheets',
        settings: manifest().platforms.salesforce.settings,
      },
    });
    expect(managedSettings.schema.properties.section.oneOf.map((item) => item.const)).toEqual(expect.arrayContaining([
      'googleSheetsAdminConfig',
      'customSettings',
    ]));

    const managedAuth = managedAuthenticationPage.getManagedAuthenticationPageRender({
      hasOrgFields: true,
      hasUserFields: true,
    });
    expect(managedAuth.schema.properties.section.oneOf.map((item) => item.const)).toEqual([
      'managedAuthOrg',
      'managedAuthUser',
    ]);

    const oauthAdmin = managedOAuthAdminPage.getManagedOAuthAdminPageRender();
    expect(oauthAdmin.uiSchema.submitButtonOptions.norender).toBe(true);
    expect(oauthAdmin.schema.properties.managedOAuthAccount.oneOf[0].actions[0]).toMatchObject({
      id: 'deleteManagedOAuthAccount',
      color: 'danger.b03',
    });
  });

  it('renders managed auth org/user pages with stored values, search, and filter branches', async () => {
    const managedAuthOrgPage = await loadPage('../../src/components/admin/managedAuthOrgPage.ts');
    const managedAuthUserPage = await loadPage('../../src/components/admin/managedAuthUserPage.ts');
    const managedAuthUserEditPage = await loadPage('../../src/components/admin/managedAuthUserEditPage.ts');

    const userFields = [
      { const: 'apiKey', title: 'API key', type: 'string', description: 'Key' },
      { const: 'region', title: 'Region', type: 'string' },
    ];
    const userValues = [
      {
        rcExtensionId: 'ext-1',
        fields: {
          apiKey: { hasValue: true, value: 'secret' },
          region: { hasValue: false },
        },
      },
    ];
    const extensions = [
      { id: 'ext-1', name: 'Jane Smith' },
      { id: 'ext-2', firstName: 'Alex', lastName: 'Green' },
    ];

    const org = managedAuthOrgPage.getManagedAuthOrgPageRender({
      orgFields: userFields,
      orgValues: {
        apiKey: { hasValue: true, value: 'org-secret' },
      },
      formData: {
        region: 'apac',
      },
    });
    expect(org.formData).toMatchObject({
      apiKey: 'org-secret',
      region: 'apac',
    });
    expect(org.schema.properties.apiKey).toMatchObject({
      title: 'API key',
      type: 'string',
    });

    const userPage = managedAuthUserPage.getManagedAuthUserPageRender({
      userFields,
      userValues,
      rcExtensions: extensions,
      searchWord: 'api',
      filter: 'Configured',
    });
    expect(userPage.schema.properties.managedAuthUserList.oneOf).toEqual([
      expect.objectContaining({
        const: 'ext-1',
        description: 'API key',
        meta: 'Configured',
      }),
    ]);

    const edit = managedAuthUserEditPage.getManagedAuthUserEditPageRender({
      userFields,
      userValues,
      rcExtension: extensions[0],
      searchWord: 'jane',
      filter: 'Configured',
    });
    expect(edit.title).toContain('Jane Smith');
    expect(edit.formData).toMatchObject({
      rcExtensionId: 'ext-1',
      apiKey: 'secret',
      searchWord: 'jane',
      filter: 'Configured',
    });
  });

  it('renders general setting detail pages with defaults and saved admin settings', async () => {
    const appearancePage = await loadPage('../../src/components/admin/generalSettings/appearancePage.ts');
    const c2dMatcherPage = await loadPage('../../src/components/admin/generalSettings/clickToDialMatcherSettingPage.ts');
    const notificationLevelPage = await loadPage('../../src/components/admin/generalSettings/notificationLevelSettingPage.ts');
    const phoneNumberFormatPage = await loadPage('../../src/components/admin/generalSettings/phoneNumberFormatPage.ts');
    const widgetSettingsPage = await loadPage('../../src/components/admin/generalSettings/widgetSettingsPage.ts');

    expect(appearancePage.getAppearancePageRender().schema.properties.section.oneOf.map((item) => item.const)).toEqual([
      'customizeTabs',
      'widgetSettings',
      'notificationLevel',
      'phoneNumberFormat',
    ]);
    expect(c2dMatcherPage.getClickToDialMatcherSettingPageRender({}).formData.c2dMatcherType).toEqual({
      customizable: true,
      value: 'libPhone',
    });
    expect(c2dMatcherPage.getClickToDialMatcherSettingPageRender({
      adminUserSettings: {
        c2dMatcherType: { customizable: false, value: 'regExp' },
      },
    }).formData.c2dMatcherType).toEqual({
      customizable: false,
      value: 'regExp',
    });
    expect(notificationLevelPage.getNotificationLevelSettingPageRender({
      adminUserSettings: {
        notificationLevelSetting: { customizable: false, value: ['error'] },
      },
    }).formData.notificationLevelSetting).toEqual({
      customizable: false,
      value: ['error'],
    });
    expect(phoneNumberFormatPage.getPhoneNumberFormatPageRender({
      adminUserSettings: {
        phoneNumberDisplayFormatType: { customizable: false, value: 'custom' },
        phoneNumberDisplayFormatTemplate: { customizable: false, value: '(###) ###-####' },
      },
    }).formData).toMatchObject({
      phoneNumberDisplayFormatType: { customizable: false, value: 'custom' },
      phoneNumberDisplayFormatTemplate: { customizable: false, value: '(###) ###-####' },
    });
    expect(widgetSettingsPage.getWidgetSettingsPageRender({
      adminUserSettings: {
        quickAccessButtonSize: { customizable: false, value: 'small' },
      },
    }).formData.quickAccessButtonSize).toEqual({
      customizable: false,
      value: 'small',
    });
  });
});
