import { loadModule } from '../helpers/loadModule';

async function loadPage(modulePath) {
  vi.resetModules();
  return loadModule(modulePath);
}

function plugins() {
  return [
    {
      id: 'public-plugin',
      access: 'public',
      name: 'vendor.public',
      displayName: 'Public Plugin',
      developer: { name: 'Vendor' },
      requireLicense: true,
      licenseStatus: false,
      errorMessage: 'License expired',
      description: 'Public plugin',
      supportedLogTypes: ['Call'],
    },
    {
      id: 'private-plugin',
      access: 'private',
      name: 'vendor.private',
      displayName: 'Private Plugin',
      developer: { name: 'Private Vendor' },
      description: 'Private plugin',
      supportedLogTypes: ['Message'],
    },
  ];
}

describe('plugin and developer page renderers', () => {
  it('renders installed plugin list pages with license warnings and empty state', async () => {
    const installedPluginListPage = await loadPage('../../src/components/installedPluginListPage.ts');
    const installed = installedPluginListPage.getInstalledPluginListPageRender({
      pluginList: plugins(),
      isFromAdmin: true,
    });
    expect(installed.schema.properties.plugins.oneOf[0]).toMatchObject({
      const: 'public-plugin=public',
      iconMeta: [expect.objectContaining({ icon: 'warning', message: 'License expired' })],
    });
    expect(installed.uiSchema.submitButtonOptions).toEqual({
      submitText: expect.any(String),
    });

    const emptyInstalled = installedPluginListPage.getInstalledPluginListPageRender({
      pluginList: [],
      isFromAdmin: false,
    });
    expect(emptyInstalled.schema.properties.helperText).toEqual(expect.any(Object));
  });

  it('renders admin plugin configure pages for installed and uninstalled plugins', async () => {
    const pluginAdminConfigurePage = await loadPage('../../src/components/pluginAdminConfigurePage.ts');

    const adminInstalled = pluginAdminConfigurePage.getPluginAdminConfigurePageRender({
      pluginId: 'private-plugin',
      pluginAccess: 'private',
      plugin: plugins()[1],
      installed: true,
      ownerRcAccountId: 'account-1',
    });
    expect(adminInstalled.schema.properties.basicInfo.oneOf[0].actions[0]).toMatchObject({
      id: 'removeButton',
      color: 'danger.b03',
    });
    expect(adminInstalled.formData).toMatchObject({
      isFromAdmin: true,
      installed: true,
      ownerRcAccountId: 'account-1',
    });

    const adminUninstalled = pluginAdminConfigurePage.getPluginAdminConfigurePageRender({
      pluginId: 'public-plugin',
      pluginAccess: 'public',
      plugin: plugins()[0],
      installed: false,
    });
    expect(adminUninstalled.schema.properties.basicInfo.oneOf[0].actions[0].id).toBe('installButton');
  });

  it('renders filtered plugin market pages', async () => {
    const pluginMarketListPage = await loadPage('../../src/components/pluginMarketListPage.ts');

    const market = pluginMarketListPage.getPluginMarketListPageRender({
      pluginList: plugins(),
      searchWord: 'private',
      filter: 'common.labels.private',
    });
    expect(market.schema.properties.plugins.oneOf).toEqual([
      expect.objectContaining({ const: 'private-plugin=private' }),
    ]);
  });

  it('renders developer settings page admin-only controls', async () => {
    const developerSettingsPage = await loadPage('../../src/components/developerSettingsPage/index.ts');

    const developer = developerSettingsPage.getDeveloperSettingsPageRender({ isAdmin: true });
    expect(developer.schema.properties).toHaveProperty('reinitializeUserMappingButton');
    expect(developerSettingsPage.getDeveloperSettingsPageRender({ isAdmin: false }).schema.properties)
      .not.toHaveProperty('reinitializeUserMappingButton');
  });

  it('renders implemented interfaces status pages', async () => {
    const implementedInterfacesPage = await loadPage('../../src/components/developerSettingsPage/implementedInterfacesPage.ts');

    const interfaces = implementedInterfacesPage.getImplementedInterfacesPageRender({
      implementedInterfaces: {
        findContactWithName: true,
        upsertCallDisposition: false,
      },
    });
    expect(interfaces.schema.properties.implementedInterfaces.oneOf).toEqual([
      { const: 'findContactWithName', title: 'findContactWithName', meta: 'Implemented' },
      { const: 'upsertCallDisposition', title: 'upsertCallDisposition', meta: 'Not implemented' },
    ]);
  });
});

describe('google sheets and server-side logging page renderers', () => {
  it('renders managed user Google Sheets pages', async () => {
    const googleSheetsPage = await loadPage('../../src/components/platformSpecific/googleSheetsPage.ts');
    const managedUserPage = googleSheetsPage.renderGoogleSheetsPage({
      userSettings: {
        googleSheetsName: { customizable: false, value: 'Admin Sheet' },
        googleSheetsUrl: { customizable: false, value: 'https://sheet.example' },
      },
    });
    expect(managedUserPage.schema.properties.warning.description).toContain('managed by your administrator');
    expect(managedUserPage.uiSchema.removeSheetButton['ui:disabled']).toBe(true);
    expect(managedUserPage.formData.sheetUrl).toBe('https://sheet.example');
  });

  it('enables user Google Sheets create button after a sheet name is entered', async () => {
    const googleSheetsPage = await loadPage('../../src/components/platformSpecific/googleSheetsPage.ts');

    const emptyUserPage = googleSheetsPage.renderGoogleSheetsPage({
      userSettings: {},
    });
    expect(emptyUserPage.schema.required).toEqual(['newSheetName']);
    expect(emptyUserPage.uiSchema.newSheetButton['ui:disabled']).toBe(true);
    expect(googleSheetsPage.getUpdatedGoogleSheetsPage({
      page: emptyUserPage,
      formData: { newSheetName: 'New Sheet' },
    }).uiSchema.newSheetButton).not.toHaveProperty('ui:disabled');
  });

  it('renders existing admin Google Sheets settings', async () => {
    const adminGoogleSheetsPage = await loadPage('../../src/components/admin/adminGoogleSheetsPage.ts');
    const adminExisting = adminGoogleSheetsPage.renderAdminGoogleSheetsPage({
      adminSettings: {
        userSettings: {
          googleSheetsName: { customizable: false, value: 'Managed Sheet' },
          googleSheetsUrl: { value: 'https://admin-sheet.example' },
        },
      },
    });
    expect(adminExisting.schema.properties).toHaveProperty('adminRemoveSheetButton');
    expect(adminExisting.formData.forceGoogleSheets.customizable).toBe(false);
  });

  it('updates admin Google Sheets create button from sheet name state', async () => {
    const adminGoogleSheetsPage = await loadPage('../../src/components/admin/adminGoogleSheetsPage.ts');
    const adminNew = adminGoogleSheetsPage.renderAdminGoogleSheetsPage({
      adminSettings: {},
    });
    expect(adminNew.schema.required).toEqual(['newSheetName']);
    expect(adminGoogleSheetsPage.getUpdatedAdminGoogleSheetsPage({
      page: adminNew,
      formData: {},
    }).uiSchema.adminNewSheetButton['ui:disabled']).toBe(true);
    expect(adminGoogleSheetsPage.getUpdatedAdminGoogleSheetsPage({
      page: adminNew,
      formData: { newSheetName: 'Created by admin' },
    }).uiSchema.adminNewSheetButton).not.toHaveProperty('ui:disabled');
  });

  it('renders server-side logging with warning, sources, additional fields, and user mapping section', async () => {
    const serverSideLoggingPage = await loadPage('../../src/components/admin/serverSideLoggingPage.ts');

    const page = serverSideLoggingPage.getServerSideLoggingSettingPageRender({
      subscriptionLevel: 'Account',
      doNotLogNumbers: '+16505550100,101',
      loggingByAdmin: true,
      subscribedByOtherAdmin: { name: 'Admin Jane' },
      enableUserMapping: true,
      userPermissions: {
        ringCX: true,
        ringSenseInsights: true,
      },
      sources: ['ex', 'cx'],
      additionalFields: [
        {
          const: 'region',
          title: 'Region',
          description: 'Logging region',
          oneOf: [{ const: 'us', title: 'US' }],
          uiSchema: { 'ui:widget': 'select' },
        },
        {
          const: 'owner',
          title: 'Owner',
          enum: ['admin'],
          enumNames: ['Admin'],
        },
      ],
      additionalFieldValues: {
        region: 'us',
        owner: 'admin',
      },
    });

    expect(page.schema.properties.warning.description).toContain('Admin Jane');
    expect(page.schema.properties.section.oneOf[0]).toEqual({
      const: 'userMapping',
      title: 'User mapping',
    });
    expect(page.schema.properties.serverSideLoggingHolder.properties.sources.enum).toEqual(['ex', 'cx']);
    expect(page.schema.properties.serverSideLoggingHolder.properties.region.oneOf).toEqual([
      { const: 'us', title: 'US' },
    ]);
    expect(page.formData.serverSideLoggingHolder).toMatchObject({
      serverSideLogging: 'Account',
      activityRecordOwner: 'admin',
      sources: ['ex', 'cx'],
      region: 'us',
      owner: 'admin',
    });
    expect(page.uiSchema.serverSideLoggingHolder.region).toEqual({ 'ui:widget': 'select' });
  });

  it('renders server-side logging defaults without RingCX permissions', async () => {
    const serverSideLoggingPage = await loadPage('../../src/components/admin/serverSideLoggingPage.ts');
    const noCxPage = serverSideLoggingPage.getServerSideLoggingSettingPageRender({
      subscriptionLevel: 'Disable',
      doNotLogNumbers: '',
      loggingByAdmin: false,
      userPermissions: {},
    });
    expect(noCxPage.formData.serverSideLoggingHolder.sources).toEqual(['ex']);
    expect(noCxPage.schema.properties.serverSideLoggingHolder.properties).not.toHaveProperty('sources');
  });
});

describe('user mapping and reports page renderers', () => {
  it('renders mapped user mapping lists with search and mapped filters', async () => {
    const userMappingPage = await loadPage('../../src/components/admin/userMappingPage/userMappingPage.ts');
    const mappings = [
      {
        crmUser: { id: 'crm-1', name: 'Jane CRM', email: 'jane@example.test' },
        rcUser: [
          { extensionId: 'ext-1', name: 'Jane RC', extensionNumber: '101' },
          { extensionId: 'ext-2', name: 'Backup RC', extensionNumber: '102' },
        ],
      },
      {
        crmUser: { id: 'crm-2', name: 'Alex CRM', email: 'alex@example.test' },
        rcUser: [],
      },
    ];

    const mapped = userMappingPage.getUserMappingPageRender({
      userMapping: mappings,
      platformDisplayName: 'Salesforce',
      searchWord: 'jane',
      filter: 'Mapped',
    });
    expect(mapped.schema.properties.userMappingList.oneOf).toEqual([
      expect.objectContaining({
        const: 'crm-1',
        meta: 'Mapped',
        description: 'Jane RC - ext: 101 (+1 others)',
      }),
    ]);
  });

  it('renders unmapped user mapping lists', async () => {
    const userMappingPage = await loadPage('../../src/components/admin/userMappingPage/userMappingPage.ts');
    const mappings = [
      {
        crmUser: { id: 'crm-1', name: 'Jane CRM', email: 'jane@example.test' },
        rcUser: [
          { extensionId: 'ext-1', name: 'Jane RC', extensionNumber: '101' },
          { extensionId: 'ext-2', name: 'Backup RC', extensionNumber: '102' },
        ],
      },
      {
        crmUser: { id: 'crm-2', name: 'Alex CRM', email: 'alex@example.test' },
        rcUser: [],
      },
    ];
    const unmapped = userMappingPage.getUserMappingPageRender({
      userMapping: mappings,
      platformDisplayName: 'Salesforce',
      filter: 'Unmapped',
    });
    expect(unmapped.schema.properties.userMappingList.oneOf).toEqual([
      expect.objectContaining({
        const: 'crm-2',
        meta: 'Unmapped',
        description: '(Unknown)',
      }),
    ]);
  });

  it('renders edit user mapping pages with selected RC extensions', async () => {
    const editUserMappingPage = await loadPage('../../src/components/admin/userMappingPage/editUserMappingPage.ts');
    const mappings = [
      {
        crmUser: { id: 'crm-1', name: 'Jane CRM', email: 'jane@example.test' },
        rcUser: [
          { extensionId: 'ext-1', name: 'Jane RC', extensionNumber: '101' },
          { extensionId: 'ext-2', name: 'Backup RC', extensionNumber: '102' },
        ],
      },
    ];
    const edit = editUserMappingPage.renderEditUserMappingPage({
      userMapping: mappings[0],
      platformDisplayName: 'Salesforce',
      rcExtensions: [
        { id: 'ext-1', name: 'Jane RC', email: 'jane.rc@example.test', extensionNumber: '101' },
        { id: 'ext-3', firstName: 'Chris', lastName: 'Green', email: '', extensionNumber: '103' },
      ],
      selectedRcExtensionId: ['ext-3'],
    });
    expect(edit.schema.required).toEqual(['rcExtensionList']);
    expect(edit.formData).toMatchObject({
      crmUserId: 'crm-1',
      crmUserName: 'Jane CRM',
      crmUserEmail: 'jane@example.test',
      rcExtensionList: ['ext-3'],
    });
    expect(edit.uiSchema.rcExtensionList['ui:options'].enumOptions).toHaveLength(2);
  });

  it('renders user report tabs with metrics, date ranges, and admin-only tab options', async () => {
    const reportPage = await loadPage('../../src/components/reportPage/reportPage.ts');
    const userPage = reportPage.getReportsPageRender({
      selectedTab: 'userReportTab',
      selectedRcExtension: 'me',
      isAdmin: true,
      userSettings: {
        showUserReportTab: { value: true },
      },
      rcExtensions: [
        { id: 'ext-1', name: 'Jane RC', email: 'jane@example.test', extensionNumber: '101' },
      ],
      userStats: {
        dateRange: 'Select date range...',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        callLogStats: {
          inboundCallCount: 1,
          outboundCallCount: 2,
          answeredCallCount: 1,
          answeredCallPercentage: '50%',
          totalTalkTime: 10,
          averageTalkTime: 5,
        },
        smsLogStats: {
          smsReceivedCount: 3,
          smsSentCount: 4,
        },
        unloggedCallStats: {
          unloggedCallCount: 2,
          calls: [{ sessionId: 'call-1' }],
        },
      },
    });
    expect(userPage.schema.properties.tab.enum).toEqual(['userReportTab', 'companyReportTab']);
    expect(userPage.schema.properties).toHaveProperty('startDate');
    expect(userPage.schema.properties).toHaveProperty('unloggedCallSummary');
    expect(userPage.formData.unloggedCalls).toEqual([{ sessionId: 'call-1' }]);
    expect(userPage.schema.properties.rcExtensionList.enum).toEqual(['ext-1', 'me']);
  });

  it('renders company report tabs with selected grouping and SMS metrics', async () => {
    const reportPage = await loadPage('../../src/components/reportPage/reportPage.ts');
    const companyPage = reportPage.getReportsPageRender({
      selectedTab: 'companyReportTab',
      selectedGroupKey: 'department',
      groupKeys: ['department'],
      selectedItemKey: 'Sales',
      itemKeys: ['Sales'],
      isAdmin: true,
      userSettings: {
        showUserReportTab: { value: true },
      },
      companyStats: {
        dateRange: 'Select date range...',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        callLogStats: [
          {
            name: 'Sales',
            inboundCallCount: 2,
            outboundCallCount: 1,
            answeredCallCount: 1,
            answeredCallPercentage: '33%',
            totalTalkTime: 9,
            averageTalkTime: 3,
            smsReceivedCount: 5,
            smsSentCount: 6,
          },
        ],
        smsLogStats: true,
      },
    });
    expect(companyPage.schema.properties).toHaveProperty('smsActivitySummary');
    expect(companyPage.schema.properties).toHaveProperty('startDate');
    expect(companyPage.formData).toMatchObject({
      groupKeyEnums: 'department',
      itemKeyEnums: 'Sales',
      smsActivitySummary: 'smsMessageReceivedCount',
    });
  });

  it('renders company report tabs with read-only N/A item selection when no item keys exist', async () => {
    const reportPage = await loadPage('../../src/components/reportPage/reportPage.ts');
    const companyWithoutItems = reportPage.getReportsPageRender({
      selectedTab: 'companyReportTab',
      groupKeys: [],
      itemKeys: [],
      isAdmin: true,
      userSettings: {
        showUserReportTab: { value: true },
      },
      companyStats: {},
    });
    expect(companyWithoutItems.formData.itemKeyEnums).toBe('N/A');
    expect(companyWithoutItems.uiSchema.itemKeyEnums['ui:readonly']).toBe(true);
  });
});
