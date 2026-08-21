import { loadModule } from '../helpers/loadModule';

async function loadPluginConfigurePage() {
  vi.resetModules();
  return loadModule('../../src/components/pluginConfigurePage.ts');
}

describe('pluginConfigurePage', () => {
  it('merges submitted plugin config into existing config entries', async () => {
    const pageModule = await loadPluginConfigurePage();

    expect(pageModule.getMergedPluginConfigFromFormData({
      existingConfig: {
        apiKey: { value: 'old', customizable: false },
        untouched: { value: 'keep' },
      },
      config: {
        apiKey: 'new',
        region: 'us',
      },
    })).toEqual({
      apiKey: { value: 'new', customizable: false },
      untouched: { value: 'keep' },
      region: { value: 'us' },
    });
  });

  it('renders custom plugin fields, authorization actions, and license status', async () => {
    const pageModule = await loadPluginConfigurePage();

    const page = pageModule.getPluginConfigurePageRender({
      pluginId: 'plugin-1',
      pluginAccess: 'account',
      isLoggedIn: true,
      hasValidLicense: false,
      licenseStatusDescription: 'Expired',
      config: {
        apiKey: { value: 'secret', customizable: false },
        region: { value: 'us' },
        tags: { value: ['vip'] },
      },
      plugin: {
        name: 'vendor.plugin',
        displayName: 'Vendor Plugin',
        description: 'Adds vendor sync',
        iconUrl: 'https://plugin.example/icon.png',
        isAsync: true,
        phase: 'beta',
        supportedLogTypes: ['callLog'],
        showAuthorizationButton: true,
        requireLicense: true,
        pageContent: [
          {
            const: 'apiKey',
            type: 'string',
            title: 'API key',
            description: 'Token',
            required: true,
          },
          {
            const: 'region',
            type: 'selection',
            title: 'Region',
            oneOf: [
              { const: 'us', title: 'US' },
              { const: 'eu', title: 'EU' },
            ],
            uiSchema: { 'ui:placeholder': 'Choose region' },
          },
          {
            const: 'tags',
            type: 'selection',
            title: 'Tags',
            multiSelect: true,
            oneOf: [
              { const: 'vip', title: 'VIP' },
              { const: 'trial', title: 'Trial' },
            ],
          },
          {
            const: 'hiddenField',
            type: 'string',
            title: 'Hidden',
            hidden: true,
          },
        ],
      },
    });

    expect(page.schema.required).toEqual([]);
    expect(page.schema.properties.config.required).toEqual(['apiKey']);
    expect(page.schema.properties.basicInfo.oneOf[0]).toMatchObject({
      title: 'Vendor Plugin',
      icon: 'https://plugin.example/icon.png',
      description: 'by vendor',
      actions: [
        expect.objectContaining({ id: 'pluginLogoutButton' }),
      ],
    });
    expect(page.schema.properties.basicInfo.oneOf[1]).toMatchObject({
      const: 'licenseStatus',
      description: 'Expired',
      descriptionColor: 'error',
      actions: [
        expect.objectContaining({ id: 'pluginLicenseRefreshButton' }),
      ],
    });
    expect(page.schema.properties.config.properties).toMatchObject({
      apiKey: {
        type: 'string',
        title: 'API key',
        default: 'secret',
        readOnly: true,
        description: 'Token',
      },
      region: {
        type: 'string',
        title: 'Region',
        default: 'us',
        readOnly: false,
        oneOf: [
          { const: 'us', title: 'US' },
          { const: 'eu', title: 'EU' },
        ],
      },
      tags: {
        type: 'array',
        title: 'Tags',
        default: ['vip'],
        readOnly: false,
        items: {
          type: 'string',
          enum: ['vip', 'trial'],
          enumNames: ['VIP', 'Trial'],
        },
        uniqueItems: true,
      },
    });
    expect(page.schema.properties.config.properties).not.toHaveProperty('hiddenField');
    expect(page.uiSchema.config).toMatchObject({
      region: {
        'ui:placeholder': 'Choose region',
        'ui:widget': 'select',
      },
      tags: {
        'ui:widget': 'checkboxes',
      },
    });
    expect(page.formData).toMatchObject({
      access: 'account',
      pluginId: 'plugin-1',
      isAsync: true,
      phase: 'beta',
      logTypes: ['callLog'],
      isLoggedIn: true,
    });
  });

  it('finds only visible required plugin config fields with missing values', async () => {
    const pageModule = await loadPluginConfigurePage();
    const plugin = {
      pageContent: [
        { const: 'apiKey', title: 'API key', required: true },
        { const: 'region', title: 'Region', required: true },
        { const: 'notes', title: 'Notes', required: false },
        { const: 'hiddenKey', title: 'Hidden key', required: true, hidden: true },
      ],
    };

    expect(pageModule.getMissingRequiredPluginConfigFields(plugin, {
      apiKey: { value: '' },
      region: { value: 'us' },
      notes: { value: '' },
    })).toEqual([
      expect.objectContaining({ const: 'apiKey' }),
    ]);

    expect(pageModule.getMissingRequiredPluginConfigFields(plugin, {
      apiKey: { value: false },
      region: 'us',
    })).toEqual([]);
  });

  it('renders fallback plugin info and connect action without custom fields', async () => {
    const pageModule = await loadPluginConfigurePage();

    const page = pageModule.getPluginConfigurePageRender({
      pluginId: 'plugin-2',
      pluginAccess: 'user',
      isLoggedIn: false,
      config: {},
      plugin: {
        name: 'solo',
        description: 'No custom form',
        showAuthorizationButton: true,
        pageContent: [
          { const: 'hiddenOnly', type: 'string', title: 'Hidden', hidden: true },
        ],
      },
    });

    expect(page.schema.properties.basicInfo.oneOf[0]).toMatchObject({
      title: 'solo',
      icon: 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
      description: 'by solo',
      actions: [
        expect.objectContaining({ id: 'pluginAuthButton' }),
      ],
    });
    expect(page.schema.properties).not.toHaveProperty('config');
    expect(page.uiSchema).not.toHaveProperty('config');
  });

  it('uses plugin manifest logoUrl as the basic info icon when iconUrl is absent', async () => {
    const pageModule = await loadPluginConfigurePage();

    const page = pageModule.getPluginConfigurePageRender({
      pluginId: 'plugin-3',
      pluginAccess: 'public',
      isLoggedIn: false,
      config: {},
      plugin: {
        name: 'vendor.logoOnly',
        displayName: 'Logo Only Plugin',
        description: 'Plugin detail manifest provides logoUrl',
        logoUrl: 'https://plugin.example/logo.png',
      },
    });

    expect(page.schema.properties.basicInfo.oneOf[0]).toMatchObject({
      title: 'Logo Only Plugin',
      icon: 'https://plugin.example/logo.png',
    });
  });
});
