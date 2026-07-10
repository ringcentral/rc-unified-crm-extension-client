import { loadModule } from '../helpers/loadModule';

async function loadPage(modulePath) {
  vi.resetModules();
  return loadModule(modulePath);
}

function adminUserSettings() {
  return {
    autoOpenExtension: { customizable: false, value: true },
    developerMode: { customizable: false, value: true },
    popupLogPageAfterCall: { customizable: false, value: true },
    popupLogPageAfterSMS: { customizable: true, value: false },
    autoLogCall: { customizable: false, value: true },
    autoLogSMS: { customizable: false, value: true },
    autoLogVoicemail: { customizable: true, value: true },
    autoLogInboundFax: { customizable: false, value: true },
    autoLogOutboundFax: { customizable: false, value: false },
    enableRetroCallLogSync: { customizable: false, value: false },
    oneTimeLog: { customizable: false, value: true },
    openContactPageFromIncomingCall: { customizable: false, value: 'onFirstRing' },
    openContactPageFromOutgoingCall: { customizable: false, value: 'onAnswer' },
    multiContactMatchBehavior: { customizable: false, value: 'openAllMatches' },
    openContactPageAfterCreation: { customizable: false, value: true },
    allowExtensionNumberLogging: { customizable: false, value: true },
    unknownContactPreference: { customizable: false, value: 'createNewPlaceholderContact' },
    newContactType: { customizable: false, value: 'Lead' },
    multipleContactsPreference: { customizable: false, value: 'firstAlphabetical' },
    newContactNamePrefix: { customizable: false, value: 'AutoCreated' },
    addCallLogNote: { customizable: false, value: true },
    addCallSessionId: { customizable: false, value: true },
    addRingCentralUserName: { customizable: false, value: true },
    addRingCentralNumber: { customizable: false, value: true },
    addCallLogSubject: { customizable: false, value: true },
    addCallLogContactNumber: { customizable: false, value: true },
    addCallLogDateTime: { customizable: false, value: true },
    logDateFormat: { customizable: false, value: 'MM/DD/YYYY HH:mm:ss' },
    addCallLogDuration: { customizable: false, value: true },
    addCallLogResult: { customizable: false, value: true },
    addCallLogRecording: { customizable: false, value: true },
    addCallLogAiNote: { customizable: false, value: true },
    addCallLogTranscript: { customizable: false, value: true },
    addCallLogRingSenseRecordingTranscript: { value: true },
    addCallLogRingSenseRecordingAIScore: { value: true },
    addCallLogRingSenseRecordingSummary: { value: true },
    addCallLogRingSenseRecordingBulletedSummary: { value: true },
    addCallLogRingSenseRecordingLink: { value: true },
    addCallLogLegs: { value: true },
    clickToDialEmbedMode: { customizable: false, value: 'whitelist' },
    clickToDialUrls: { customizable: false, value: ['https://crm.example'] },
    quickAccessButtonEmbedMode: { customizable: false, value: 'blacklist' },
    quickAccessButtonUrls: { customizable: false, value: ['https://blocked.example'] },
    showChatTab: { customizable: false, value: false },
    showAppointmentsTab: { customizable: false, value: false },
    staticText: { customizable: false, value: 'custom value' },
    boolSetting: { customizable: false, value: true },
    optionSingle: { customizable: false, value: 'b' },
    optionMulti: { customizable: false, value: ['x'] },
    dynamicSingle: { customizable: false, value: 'dyn-2' },
    dynamicMulti: { customizable: false, value: ['dyn-1'] },
    overridingNumberFormat: {
      customizable: false,
      numberFormatter1: '(###) ###-####',
      numberFormatter2: '+1##########',
      numberFormatter3: '',
    },
  };
}

function crmManifest() {
  return {
    settings: [
      {
        id: 'general',
        name: 'General',
        items: [
          { id: 'warningText', type: 'warning', value: 'Check custom config.' },
          { id: 'staticText', type: 'inputField', name: 'Static text', defaultValue: 'default' },
          { id: 'boolSetting', type: 'boolean', name: 'Boolean setting', defaultValue: false },
          {
            id: 'optionSingle',
            type: 'option',
            name: 'Single option',
            defaultValue: 'a',
            options: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
          },
          {
            id: 'optionMulti',
            type: 'option',
            name: 'Multi option',
            checkbox: true,
            defaultValue: ['y'],
            options: [
              { id: 'x', name: 'X' },
              { id: 'y', name: 'Y' },
            ],
          },
          {
            id: 'dynamicSingle',
            type: 'option',
            name: 'Dynamic single',
            dynamicOptions: true,
            defaultValue: 'dyn-1',
          },
          {
            id: 'dynamicMulti',
            type: 'option',
            name: 'Dynamic multi',
            dynamicOptions: true,
            checkbox: true,
            defaultValue: ['dyn-1'],
          },
        ],
      },
    ],
  };
}

function userSettings() {
  return {
    dynamicSingle: {
      options: [
        { id: 'dyn-1', name: 'Dynamic 1' },
        { id: 'dyn-2', name: 'Dynamic 2' },
      ],
    },
    dynamicMulti: {
      options: [
        { id: 'dyn-1', name: 'Dynamic 1' },
        { id: 'dyn-2', name: 'Dynamic 2' },
      ],
    },
  };
}

describe('managed settings page renderers', () => {
  it('renders advanced feature settings with saved values', async () => {
    const advancedPage = await loadPage('../../src/components/admin/managedSettings/advancedFeaturesSettingPage.ts');

    expect(advancedPage.getAdvancedFeaturesSettingPageRender({
      adminUserSettings: adminUserSettings(),
    }).formData).toMatchObject({
      autoOpenExtension: { customizable: false, value: true },
      developerMode: { customizable: false, value: true },
      popupLogPageAfterCall: { customizable: false, value: true },
    });
  });

  it('renders call and SMS logging setting navigation with saved values', async () => {
    const loggingPage = await loadPage('../../src/components/admin/managedSettings/callAndSMSLoggingSettingPage.ts');

    const logging = loggingPage.getCallAndSMSLoggingSettingPageRender({
      adminUserSettings: adminUserSettings(),
    });
    expect(logging.schema.properties.section.oneOf.map((item) => item.const)).toEqual([
      'callLogDetailsSetting',
      'autoLogPreferences',
    ]);
    expect(logging.formData).toMatchObject({
      autoLogCall: { customizable: false, value: true },
      enableRetroCallLogSync: { customizable: false, value: false },
      oneTimeLog: { customizable: false, value: true },
    });
  });

  it('renders call and SMS logging setting defaults when admin settings are missing', async () => {
    const loggingPage = await loadPage('../../src/components/admin/managedSettings/callAndSMSLoggingSettingPage.ts');

    const logging = loggingPage.getCallAndSMSLoggingSettingPageRender({});

    expect(logging.formData).toMatchObject({
      autoLogCall: { customizable: true, value: false },
      autoLogSMS: { customizable: true, value: false },
      autoLogVoicemail: { customizable: true, value: false },
      autoLogInboundFax: { customizable: true, value: false },
      autoLogOutboundFax: { customizable: true, value: false },
      enableRetroCallLogSync: { customizable: true, value: true },
      oneTimeLog: { customizable: true, value: false },
    });
  });

  it('renders contact settings with extension-number logging controls', async () => {
    const contactPage = await loadPage('../../src/components/admin/managedSettings/contactSettingPage.ts');

    const contact = contactPage.getContactSettingPageRender({
      adminUserSettings: adminUserSettings(),
      renderAllowExtensionNumberLogging: true,
    });
    expect(contact.schema.properties.allowExtensionNumberLogging).toMatchObject({
      title: 'Allow extension number logging',
    });
    expect(contact.formData).toMatchObject({
      openContactPageFromIncomingCall: { customizable: false, value: 'onFirstRing' },
      multiContactMatchBehavior: { customizable: false, value: 'openAllMatches' },
      allowExtensionNumberLogging: { customizable: false, value: true },
    });
  });

  it('renders plugin setting navigation from installed plugins', async () => {
    const pluginsPage = await loadPage('../../src/components/admin/managedSettings/pluginsSettingPage.ts');

    const plugins = pluginsPage.getPluginsSettingPageRender({
      installedPluginList: [
        { id: 'p1', displayName: 'Plugin One' },
        { id: 'p2', displayName: 'Plugin Two' },
      ],
    });
    expect(plugins.schema.properties.section.oneOf).toEqual([
      { const: 'p1', title: 'Plugin One' },
      { const: 'p2', title: 'Plugin Two' },
    ]);
  });

  it('renders custom CRM settings for static, dynamic, checkbox, warning, and number-format fields', async () => {
    const customSettingsPage = await loadPage('../../src/components/admin/managedSettings/customSettingsPage.ts');

    expect(customSettingsPage.getCustomSettingsPageRender({ crmManifest: {} })).toBeNull();

    const page = customSettingsPage.getCustomSettingsPageRender({
      crmManifest: crmManifest(),
      adminUserSettings: adminUserSettings(),
      userSettings: userSettings(),
    });

    expect(page.schema.properties).toMatchObject({
      warningText: {
        type: 'string',
        description: 'Check custom config.',
      },
      staticText: {
        type: 'object',
      },
      boolSetting: {
        type: 'object',
      },
      overridingNumberFormatTitle: {
        description: 'Overriding number format',
      },
    });
    expect(page.schema.properties.optionMulti.properties.value.items).toEqual({
      type: 'string',
      enum: ['x', 'y'],
      enumNames: ['X', 'Y'],
    });
    expect(page.schema.properties.dynamicSingle.properties.value.oneOf).toEqual([
      { const: 'dyn-1', title: 'Dynamic 1' },
      { const: 'dyn-2', title: 'Dynamic 2' },
    ]);
    expect(page.schema.properties.dynamicMulti.properties.value.items.enum).toEqual(['dyn-1', 'dyn-2']);
    expect(page.formData).toMatchObject({
      staticText: { customizable: false, value: 'custom value' },
      boolSetting: { customizable: false, value: true },
      optionSingle: { customizable: false, value: 'b' },
      optionMulti: { customizable: false, value: ['x'] },
      dynamicSingle: {
        customizable: false,
        value: 'dyn-2',
        options: userSettings().dynamicSingle.options,
      },
      dynamicMulti: {
        customizable: false,
        value: ['dyn-1'],
        options: userSettings().dynamicMulti.options,
      },
      overridingNumberFormatCustomizable: false,
      overridingNumberFormat1: '(###) ###-####',
      overridingNumberFormat2: '+1##########',
      overridingNumberFormat3: '',
    });
  });

  it('renders call log detail pages with AI and RingSense controls disabled by permissions', async () => {
    const callLogDetailsPage = await loadPage('../../src/components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage.ts');

    const disabled = callLogDetailsPage.getCallLogDetailsSettingPageRender({
      adminUserSettings: adminUserSettings(),
      userPermissions: {
        aiNote: false,
        ringSenseInsights: false,
      },
      serverSideLoggingSubscribed: false,
    });
    expect(disabled.formData).toMatchObject({
      addCallLogNote: { customizable: false, value: true },
      logDateFormat: { customizable: false, value: 'MM/DD/YYYY HH:mm:ss' },
      addCallLogRingSenseRecordingTranscript: { customizable: false, value: true },
      addCallLogLegs: { customizable: false, value: true },
    });
    expect(disabled.uiSchema.addCallLogAiNote['ui:disabled']).toBe(true);
    expect(disabled.uiSchema.addCallLogRingSenseRecordingTranscript['ui:disabled']).toBe(true);
    expect(disabled.schema.properties.addCallLogAiNote.properties.value.description).toEqual(expect.any(String));
  });

  it('renders call log detail pages with AI and RingSense controls enabled by permissions', async () => {
    const callLogDetailsPage = await loadPage('../../src/components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage.ts');
    const enabled = callLogDetailsPage.getCallLogDetailsSettingPageRender({
      adminUserSettings: {},
      userPermissions: {
        aiNote: true,
        ringSenseInsights: true,
      },
      serverSideLoggingSubscribed: true,
    });
    expect(enabled.uiSchema.addCallLogAiNote['ui:disabled']).toBe(false);
    expect(enabled.uiSchema.addCallLogRingSenseRecordingTranscript['ui:disabled']).toBe(false);
    expect(enabled.schema.properties.addCallLogAiNote.properties.value.description).toBe('');
    expect(enabled.formData.logDateFormat.value).toBe('YYYY-MM-DD hh:mm:ss A');
  });

  it('renders auto-log preference pages with saved contact preferences', async () => {
    const autoLogPreferencePage = await loadPage('../../src/components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage.ts');
    const preferences = autoLogPreferencePage.getAutoLogPreferenceSettingPageRender({
      adminUserSettings: adminUserSettings(),
      contactTypes: [
        { value: 'Lead', display: 'Lead' },
        { value: 'Contact', display: 'Contact' },
      ],
    });
    expect(preferences.schema.properties.newContactType.properties.value.oneOf).toEqual([
      { const: 'Lead', title: 'Lead' },
      { const: 'Contact', title: 'Contact' },
    ]);
    expect(preferences.formData).toMatchObject({
      unknownContactPreference: { customizable: false, value: 'createNewPlaceholderContact' },
      newContactType: { customizable: false, value: 'Lead' },
      multipleContactsPreference: { customizable: false, value: 'firstAlphabetical' },
      newContactNamePrefix: { customizable: false, value: 'AutoCreated' },
    });
  });

  it('renders auto-log preference defaults from available contact types', async () => {
    const autoLogPreferencePage = await loadPage('../../src/components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage.ts');
    const defaults = autoLogPreferencePage.getAutoLogPreferenceSettingPageRender({
      adminUserSettings: {},
      contactTypes: [{ value: 'Lead', display: 'Lead' }],
    });
    expect(defaults.formData.newContactType.value).toEqual({ value: 'Lead', display: 'Lead' });
  });

  it('renders plugin detail settings with hidden config fields', async () => {
    const pluginDetailsPage = await loadPage('../../src/components/admin/managedSettings/pluginsSetting/pluginDetailsSettingPage.ts');

    const plugin = pluginDetailsPage.getPluginDetailsSettingPageRender({
      pluginId: 'plugin-1',
      pluginDetails: {
        displayName: 'Workflow Plugin',
        pageContent: [
          {
            const: 'region',
            type: 'selection',
            title: 'Region',
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
            const: 'secret',
            type: 'string',
            title: 'Secret',
            hidden: true,
          },
        ],
      },
      pluginSetting: {
        config: {
          region: { customizable: false, value: 'us' },
          scopes: { customizable: true, value: ['read'] },
        },
      },
    });
    expect(plugin.formData).toMatchObject({
      pluginId: 'plugin-1',
      hiddenConfigFields: ['secret'],
      region: { customizable: false, value: 'us' },
      scopes: { customizable: true, value: ['read'] },
      secret: { customizable: false, value: null },
    });
    expect(plugin.schema.properties.scopes.properties.value).toMatchObject({
      type: 'array',
      uniqueItems: true,
    });
    expect(plugin.uiSchema.secret.customizable).toEqual({ 'ui:widget': 'hidden' });
  });

  it('renders click-to-dial embed settings with saved URL lists', async () => {
    const clickToDialEmbedPage = await loadPage('../../src/components/admin/generalSettings/clickToDialEmbedPage.ts');
    const embed = clickToDialEmbedPage.getClickToDialEmbedPageRender({
      adminUserSettings: adminUserSettings(),
    });
    expect(embed.formData).toMatchObject({
      clickToDialEmbedMode: { customizable: false, value: 'whitelist' },
      clickToDialUrls: { customizable: false, value: ['https://crm.example'] },
      quickAccessButtonEmbedMode: { customizable: false, value: 'blacklist' },
      quickAccessButtonUrls: { customizable: false, value: ['https://blocked.example'] },
    });
    expect(embed.uiSchema.clickToDialUrls.value['ui:options'].orderable).toBe(false);
  });

  it('renders customize-tabs settings with appointment tab title from manifest', async () => {
    const customizeTabsPage = await loadPage('../../src/components/admin/generalSettings/customizeTabsSettingPage.ts');
    const tabs = customizeTabsPage.getCustomizeTabsSettingPageRender({
      adminUserSettings: adminUserSettings(),
      manifest: {
        platforms: {
          salesforce: {
            page: {
              appointment: {
                supported: true,
                title: 'Visits',
              },
            },
          },
        },
      },
      platformName: 'salesforce',
    });
    expect(tabs.schema.properties.showAppointmentsTab.title).toBe('Show Visits tab');
    expect(tabs.formData).toMatchObject({
      showChatTab: { customizable: false, value: false },
      showAppointmentsTab: { customizable: false, value: false },
    });
  });

  it('hides customize-tabs appointment settings when appointments are unsupported', async () => {
    const customizeTabsPage = await loadPage('../../src/components/admin/generalSettings/customizeTabsSettingPage.ts');
    const tabsWithoutAppointments = customizeTabsPage.getCustomizeTabsSettingPageRender({
      adminUserSettings: {},
      manifest: {
        platforms: {
          salesforce: {
            page: {
              appointment: {
                supported: false,
              },
            },
          },
        },
      },
      platformName: 'salesforce',
    });
    expect(tabsWithoutAppointments.schema.properties).not.toHaveProperty('showAppointmentsTab');
    expect(tabsWithoutAppointments.formData).not.toHaveProperty('showAppointmentsTab');
  });
});
