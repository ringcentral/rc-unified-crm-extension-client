import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
        displayName: 'Salesforce',
        contactTypes: [{ value: 'Lead', display: 'Lead' }],
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

function dataFor(overrides = {}) {
  return {
    requestId: 'request-1',
    body: {
      keys: [],
      formData: {},
      page: {
        id: 'page',
        schema: { properties: {} },
        uiSchema: {},
        formData: {},
      },
      ...overrides,
    },
  };
}

function mockStorageGetFromSnapshot() {
  vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
    const snapshot = readStorage();
    if (keys == null) {
      return snapshot;
    }
    if (typeof keys === 'string') {
      return Object.prototype.hasOwnProperty.call(snapshot, keys)
        ? { [keys]: snapshot[keys] }
        : {};
    }
    if (Array.isArray(keys)) {
      return keys.reduce((result, key) => {
        if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
          result[key] = snapshot[key];
        }
        return result;
      }, {});
    }
    if (typeof keys === 'object') {
      return Object.keys(keys).reduce((result, key) => {
        result[key] = Object.prototype.hasOwnProperty.call(snapshot, key)
          ? snapshot[key]
          : keys[key];
        return result;
      }, {});
    }
    return {};
  });
}

async function loadPageHandler(modulePath, overrides = {}) {
  vi.resetModules();

  const util = {
    createDebounceHandler: vi.fn(() => async (request, handler) => handler(request)),
    responseMessage: vi.fn((responseId, response) => {
      document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-post-message-response',
        responseId,
        response,
      }, '*');
    }),
    getRcInfo: vi.fn(async () => ({
      value: {
        cachedData: {
          accountInfo: { id: 'account-1' },
          extensionInfo: { id: 'extension-1' },
        },
      },
    })),
    showNotification: vi.fn(),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const authCore = {
    getManagedAuthState: vi.fn(async () => ({ allRequiredFieldsSatisfied: true })),
    ...overrides.authCore,
  };
  vi.doMock('../../src/core/auth.ts', () => ({ default: authCore }));

  const contactCore = {
    refreshContactPromptPage: vi.fn(),
    openContactPage: vi.fn(async () => {}),
    ...overrides.contactCore,
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const logCore = {
    getCachedNote: vi.fn(async () => 'cached note'),
    ...overrides.logCore,
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const adminCore = {
    uploadAdminSettings: vi.fn(async () => {}),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.ts', () => ({ default: adminCore }));

  const userCore = {
    getPluginSetting: vi.fn((settings, pluginId) => settings?.[`plugin_${pluginId}`]?.value ?? settings?.[`plugin_${pluginId}`]),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.ts', () => ({
    default: userCore,
    getPluginSetting: userCore.getPluginSetting,
  }));

  const manifestService = {
    getPlatformList: vi.fn(async () => [{ id: 'salesforce', name: 'salesforce' }]),
    getPluginDetails: vi.fn(async ({ pluginId, selectedPlugin }) => ({
      id: pluginId,
      name: selectedPlugin?.name ?? 'Plugin One',
      pageContent: [],
    })),
    ...overrides.manifestService,
  };
  vi.doMock('../../src/service/manifestService.ts', () => manifestService);

  const googleSheetsPage = {
    getUpdatedGoogleSheetsPage: vi.fn((props) => ({ id: 'googleSheetsPage', props })),
    ...overrides.googleSheetsPage,
  };
  vi.doMock('../../src/components/platformSpecific/googleSheetsPage.ts', () => ({ default: googleSheetsPage }));

  const adminGoogleSheetsPage = {
    getUpdatedAdminGoogleSheetsPage: vi.fn((props) => ({ id: 'adminGoogleSheetsPage', props })),
    ...overrides.adminGoogleSheetsPage,
  };
  vi.doMock('../../src/components/admin/adminGoogleSheetsPage.ts', () => ({ default: adminGoogleSheetsPage }));

  const platformSelectionPage = {
    getPlatformSelectionPageRender: vi.fn((props) => ({ id: 'platformSelectionPage', props })),
    ...overrides.platformSelectionPage,
  };
  vi.doMock('../../src/components/platformSelectionPage.ts', () => ({ default: platformSelectionPage }));

  const hostnameInputPage = {
    getHostnameInputPageRender: vi.fn((props) => ({ id: 'hostnameInputPage', props })),
    ...overrides.hostnameInputPage,
  };
  vi.doMock('../../src/components/hostnameInputPage.ts', () => ({ default: hostnameInputPage }));

  const logRecordSubmissionPage = {
    getLogRecordSubmissionPageRender: vi.fn((props) => ({ id: 'logRecordSubmissionPage', props })),
    ...overrides.logRecordSubmissionPage,
  };
  vi.doMock('../../src/components/logRecordSubmissionPage.ts', () => logRecordSubmissionPage);

  const errorLogRecordPage = {
    getErrorLogRecordPageRender: vi.fn((props) => ({ id: 'errorLogRecordPage', props })),
    ...overrides.errorLogRecordPage,
  };
  vi.doMock('../../src/components/errorLogRecordPage.ts', () => errorLogRecordPage);

  const logPage = {
    getLogPageRender: vi.fn((props) => ({ id: 'logPage', props })),
    getUpdatedLogPageRender: vi.fn((props) => ({ id: 'updatedLogPage', props })),
    ...overrides.logPage,
  };
  vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));

  const managedAuthUserPage = {
    getManagedAuthUserPageRender: vi.fn((props) => ({ id: 'managedAuthUserPage', props })),
  };
  vi.doMock('../../src/components/admin/managedAuthUserPage.ts', () => ({ default: managedAuthUserPage }));

  const managedAuthUserEditPage = {
    getManagedAuthUserEditPageRender: vi.fn((props) => ({ id: 'managedAuthUserEditPage', props })),
  };
  vi.doMock('../../src/components/admin/managedAuthUserEditPage.ts', () => ({ default: managedAuthUserEditPage }));

  const userMappingPage = {
    getUserMappingPageRender: vi.fn((props) => ({ id: 'userMappingPage', props })),
  };
  vi.doMock('../../src/components/admin/userMappingPage/userMappingPage.ts', () => ({ default: userMappingPage }));

  const editUserMappingPage = {
    renderEditUserMappingPage: vi.fn((props) => ({ id: 'editUserMappingPage', props })),
  };
  vi.doMock('../../src/components/admin/userMappingPage/editUserMappingPage.ts', () => ({ default: editUserMappingPage }));

  const pluginDetailsSettingPage = {
    getPluginDetailsSettingPageRender: vi.fn((props) => ({ id: 'pluginDetailsSettingPage', props })),
  };
  vi.doMock('../../src/components/admin/managedSettings/pluginsSetting/pluginDetailsSettingPage.ts', () => pluginDetailsSettingPage);

  const rcContacts = [
    { id: '101', type: 'User', name: 'Jane User' },
    { id: '201', type: 'Department', name: 'Support Team' },
  ];
  util.getRcContactInfo = vi.fn(async () => rcContacts);

  const handler = await loadModule(modulePath);
  return {
    handler,
    util,
    authCore,
    contactCore,
    logCore,
    adminCore,
    userCore,
    manifestService,
    googleSheetsPage,
    adminGoogleSheetsPage,
    platformSelectionPage,
    hostnameInputPage,
    logRecordSubmissionPage,
    errorLogRecordPage,
    logPage,
    managedAuthUserPage,
    managedAuthUserEditPage,
    userMappingPage,
    editUserMappingPage,
    pluginDetailsSettingPage,
  };
}

const context = {
  manifest: manifest(),
  platformName: 'salesforce',
  platform: {
    displayName: 'Salesforce',
  },
};

describe('customizedPage inputChanged remaining page handlers', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    seedStorage({
      userSettings: {},
      adminSettings: {
        userSettings: {
          googleSheetsName: { value: 'Sheet', customizable: true },
          googleSheetsUrl: { value: 'https://sheets.example', customizable: true },
          'plugin_plugin-1': {
            value: {
              name: 'Plugin One',
              config: {},
            },
          },
        },
      },
      managedAuthSettings: {
        userFields: [{ const: 'clientSecret' }],
        userValues: [],
      },
    });
  });

  it('updates c2d schedule form state for new contacts and valid callback dates', async () => {
    const { handler } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/c2dSchedulePage.ts',
    );
    await handler.onEvent({
      data: dataFor({
        keys: ['contact'],
        page: {
          id: 'c2dSchedulePage',
          title: 'Schedule',
          type: 'page',
          schema: {
            properties: {
              callbackDateTime: {},
            },
          },
          uiSchema: {
            scheduleSubmit: {},
          },
        },
        formData: {
          contact: 'newContact',
          callbackDateTime: '2000-01-01T10:00:00',
          newContactName: '',
        },
      }),
      ...context,
    });
    let page = getWidgetPostMessages().at(-1).message.page;
    expect(page.formData.callbackDateTime).toBe('');
    expect(page.formData.newContactType).toBe('Lead');
    expect(page.uiSchema.scheduleSubmit['ui:disabled']).toBe(true);

    await handler.onEvent({
      data: dataFor({
        keys: ['callbackDateTime'],
        page: {
          id: 'c2dSchedulePage',
          title: 'Schedule',
          type: 'page',
          schema: {
            properties: {
              callbackDateTime: {},
            },
          },
          uiSchema: {
            scheduleSubmit: {},
          },
        },
        formData: {
          contact: 'contact-1',
          callbackDateTime: '2099-01-01T10:00:00',
          newContactName: 'Ignored',
        },
      }),
      ...context,
    });
    page = getWidgetPostMessages().at(-1).message.page;
    expect(page.formData.newContactName).toBe('');
    expect(page.uiSchema.scheduleSubmit['ui:disabled']).toBe(false);
  });

  it('updates the Google Sheets customized page from current form data', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/googleSheetsPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ formData: { sheet: 'Sheet' } }),
      ...context,
    });
    expect(loaded.googleSheetsPage.getUpdatedGoogleSheetsPage).toHaveBeenCalledWith(expect.objectContaining({
      formData: { sheet: 'Sheet' },
      userSettings: {},
    }));
  });

  it('updates the log-record submission page with PII consent state', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/logRecordSubmissionPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ formData: { piiConsent: true } }),
      ...context,
    });
    expect(loaded.logRecordSubmissionPage.getLogRecordSubmissionPageRender).toHaveBeenCalledWith({
      piiConsent: true,
    });
  });

  it('filters platform selection page results by search text and selected platform', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/platformSelectionPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          platforms: 'salesforce=public',
          platformSearch: {
            search: 'sales',
            filter: 'All',
          },
        },
      }),
      ...context,
    });
    expect(loaded.platformSelectionPage.getPlatformSelectionPageRender).toHaveBeenCalledWith({
      platformList: [{ id: 'salesforce', name: 'salesforce' }],
      searchWord: 'sales',
      selectedPlatform: 'salesforce=public',
      filter: 'All',
    });
  });

  it('validates hostname input and refreshes managed-auth state for private connectors', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/hostnameInputPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        keys: ['url'],
        formData: {
          platformId: 'salesforce',
          url: 'https://crm.example',
          connectorId: 'connector-1',
          isPrivate: true,
        },
      }),
      ...context,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(loaded.authCore.getManagedAuthState).toHaveBeenCalledWith(expect.objectContaining({
      connectorId: 'connector-1',
      isPrivate: true,
    }));
    expect(loaded.hostnameInputPage.getHostnameInputPageRender).toHaveBeenCalledWith(expect.objectContaining({
      isUrlValid: true,
      submitText: 'Connect',
      connectorId: 'connector-1',
    }));
  });

  it('renders managed-auth user page search results', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          userSearch: {
            search: 'Jane',
            filter: 'Configured',
          },
        },
      }),
      ...context,
    });
    expect(loaded.managedAuthUserPage.getManagedAuthUserPageRender).toHaveBeenCalledWith(expect.objectContaining({
      searchWord: 'Jane',
      filter: 'Configured',
    }));
  });

  it('renders the managed-auth user edit page for the selected extension', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserEditPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          rcExtensionId: '101',
          searchWord: 'Jane',
          filter: 'Configured',
        },
      }),
      ...context,
    });
    expect(loaded.managedAuthUserEditPage.getManagedAuthUserEditPageRender).toHaveBeenCalledWith(expect.objectContaining({
      rcExtension: { id: '101', type: 'User', name: 'Jane User' },
      searchWord: 'Jane',
    }));
  });

  it('renders user mapping page search results', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/userMappingPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          allUserMapping: [{ crmUser: { id: 'crm-1' } }],
          userSearch: {
            search: 'Jane',
            filter: 'Mapped',
          },
        },
      }),
      ...context,
    });
    expect(loaded.userMappingPage.getUserMappingPageRender).toHaveBeenCalledWith({
      userMapping: [{ crmUser: { id: 'crm-1' } }],
      platformDisplayName: 'Salesforce',
      searchWord: 'Jane',
      filter: 'Mapped',
    });
  });

  it('updates selected RC extensions on the edit user mapping page', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/editUserMappingPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          searchWord: 'Jane',
          userMapping: [{ crmUser: { id: 'crm-1' } }],
          rcExtensions: [{ id: '101' }],
          rcExtensionList: ['101'],
        },
      }),
      ...context,
    });
    expect(loaded.editUserMappingPage.renderEditUserMappingPage).toHaveBeenCalledWith(expect.objectContaining({
      selectedRcExtensionId: ['101'],
    }));
  });

  it('updates the error log record page as issue details change', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getErrorLogRecordPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        keys: ['issueDescription'],
        formData: {
          email: 'user@example.test',
          issueDescription: 'Something broke',
        },
      }),
      ...context,
    });
    expect(loaded.errorLogRecordPage.getErrorLogRecordPageRender).toHaveBeenCalledWith({
      step: 1,
      email: 'user@example.test',
      issueDescription: 'Something broke',
    });
  });

  it('opens developer documentation for the selected implemented interface', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/developerSettingsPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          implementedInterfaces: 'getUserList',
        },
      }),
      ...context,
    });
    expect(window.open).toHaveBeenCalledWith('https://appconnect.labs.ringcentral.com/developers/interfaces/getUserList', '_blank');
  });

  it('updates call-log contact search result pages and caches the selected contact', async () => {
    seedStorage({
      cacheLogPageData: {
        id: 'log-1',
        contactInfo: [{ id: 'existing', type: 'Lead', name: 'Existing' }],
      },
      'rc-crm-search-contact-+16505550100': [{ id: 'cached', type: 'Lead', name: 'Cached', phone: '+16505550100' }],
    });
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultCallLog.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        page: {
          formData: {
            contactInfo: [
              { id: 'selected', type: 'Contact', name: 'Selected', isNewContact: true },
            ],
          },
        },
        formData: {
          contactList: 'selected',
          contactPhoneNumber: '+16505550100',
        },
      }),
      ...context,
    });
    expect(loaded.logPage.getUpdatedLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      logType: 'Call',
      updateData: expect.objectContaining({
        formData: expect.objectContaining({
          contact: 'selected',
          contactType: 'Contact',
          returnToHistoryPage: true,
        }),
      }),
    }));
    expect(readStorage()['rc-crm-search-contact-+16505550100']).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'selected' }),
    ]));
  });

  it('updates message-log contact search result pages and navigates back to the message log', async () => {
    seedStorage({
      cacheLogPageData: {
        id: 'log-1',
        contactInfo: [{ id: 'existing', type: 'Lead', name: 'Existing' }],
      },
      'rc-crm-search-contact-+16505550200': [{ id: 'cached', type: 'Lead', name: 'Cached', phone: '+16505550200' }],
    });
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultMessageLog.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        keys: ['contactList'],
        page: {
          formData: {
            contactInfo: [
              { id: 'message-selected', type: 'Lead', name: 'Message Selected', isNewContact: true },
            ],
          },
        },
        formData: {
          contactList: 'message-selected',
          contactPhoneNumber: '+16505550200',
        },
      }),
      ...context,
    });
    expect(loaded.logPage.getUpdatedLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      logType: 'Call',
      updateData: expect.objectContaining({
        formData: expect.objectContaining({
          contact: 'message-selected',
          returnToHistoryPage: true,
        }),
      }),
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/messages/log-1',
        },
      }),
    ]));
  });

  it('refreshes the multi-contact prompt when the search text changes', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getMultiContactPopPromptPage.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        keys: ['search'],
        page: {
          formData: {
            contactInfo: [{ id: 'contact-1' }],
          },
        },
        formData: {
          search: 'Jane',
        },
      }),
      ...context,
    });
    expect(loaded.contactCore.refreshContactPromptPage).toHaveBeenCalledWith({
      contactInfo: [{ id: 'contact-1' }],
      searchWord: 'Jane',
    });
  });

  it('opens the selected contact from the multi-contact prompt', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getMultiContactPopPromptPage.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        keys: ['contactList'],
        formData: {
          contactList: 'contact-1',
          contactInfo: [{ id: 'contact-1', type: 'Lead' }],
        },
      }),
      ...context,
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      contactType: 'Lead',
      contactId: 'contact-1',
    });
    expect(loaded.util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('opens a cached unlogged call as a create-log page with contact search enabled', async () => {
    const record = { sessionId: 'call-1' };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      if (typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, 'unloggedCallPageDataCache')) {
        return {
          unloggedCallPageDataCache: [
            {
              sessionId: record,
              contactInfo: [{ id: 'contact-1' }],
              direction: 'Inbound',
              phoneNumber: '+16505550100',
            },
          ],
        };
      }
      if (typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, 'implementedInterfaces')) {
        return {
          implementedInterfaces: {
            findContactWithName: true,
          },
        };
      }
      return {};
    });
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/unloggedCallPage.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        formData: {
          record,
        },
      }),
      ...context,
    });
    expect(loaded.logCore.getCachedNote).toHaveBeenCalledWith({ sessionId: 'call-1' });
    expect(loaded.logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: record,
      logType: 'Call',
      triggerType: 'createLog',
      contactPhoneNumber: '+16505550100',
      useContactSearch: true,
    }));
  });

  it('enforces admin Google Sheets settings for all users', async () => {
    mockStorageGetFromSnapshot();
    seedStorage({
      adminSettings: {
        userSettings: {
          googleSheetsName: { value: 'Sheet', customizable: true },
          googleSheetsUrl: { value: 'https://sheets.example', customizable: true },
          'plugin_plugin-1': {
            value: {
              name: 'Plugin One',
              config: {},
            },
          },
        },
      },
    });
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/adminGoogleSheetsPage.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        keys: ['forceGoogleSheets'],
        formData: {
          forceGoogleSheets: {
            customizable: false,
          },
        },
      }),
      ...context,
    });
    expect(loaded.adminCore.uploadAdminSettings).toHaveBeenCalled();
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Google Sheets setting enforced for all users',
      ttl: 3000,
    });
    expect(readStorage().adminSettings.userSettings.googleSheetsName.customizable).toBe(false);
  });

  it('renders plugin admin details from stored admin plugin settings', async () => {
    const loaded = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/pluginAdminSettingsPage.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      pluginId: 'plugin-1',
      ...context,
    });
    expect(loaded.manifestService.getPluginDetails).toHaveBeenCalledWith({
      pluginId: 'plugin-1',
      selectedPlugin: {
        name: 'Plugin One',
        config: {},
      },
    });
    expect(loaded.pluginDetailsSettingPage.getPluginDetailsSettingPageRender).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
      pluginSetting: {
        name: 'Plugin One',
        config: {},
      },
    }));
  });
});
