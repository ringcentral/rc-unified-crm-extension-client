const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

const translations = {
  'common.buttons.connect': 'Connect',
  'common.buttons.logout': 'Logout',
  'common.buttons.refresh': 'Refresh',
  'common.buttons.save': 'Save',
  'common.labels.all': 'All',
  'common.labels.filter': 'Filter',
  'common.labels.licenseStatus': 'License status',
  'common.labels.private': 'Private',
  'common.labels.search': 'Search',
  'common.labels.sharedWithYou': 'Shared with you',
  'pages.platformSelection.searchPlaceholder': 'Search with filters...',
  'pages.platformSelection.title': 'Select platform',
  'plugins.basicInfo': 'Basic info',
  'plugins.by': 'by {author}',
  'plugins.configurePage': 'Configure plugin',
  'plugins.explore': 'Explore',
  'plugins.install': 'Install',
  'plugins.noPluginInstalled': 'No plugin installed',
  'plugins.pluginMarket': 'Available plugins',
  'plugins.searchPlaceholder': 'Search with filters...',
  'plugins.title': 'Plugins',
  'plugins.uninstall': 'Uninstall'
};

function t(key, params = {}) {
  const value = translations[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (match, paramKey) => (
    params[paramKey] === undefined ? match : params[paramKey]
  ));
}

async function loadRootComponent(entryPoint) {
  return loadBundledModule(entryPoint, {
    stubs: {
      '../i18n': { t },
    },
  });
}

const catalogItems = [
  {
    id: 'salesforce',
    access: 'public',
    name: 'salesforce',
    displayName: 'Salesforce',
    iconUrl: 'https://example.com/salesforce.png',
    developer: { name: 'RingCentral' },
  },
  {
    id: 'private-crm',
    access: 'private',
    name: 'private-crm',
    displayName: 'Private CRM',
    developer: { name: 'Acme' },
  },
  {
    id: 'shared-crm',
    access: 'shared',
    name: 'shared-crm',
    displayName: 'Shared CRM',
    developer: { name: 'Partner' },
  },
];

function createPlugin(overrides = {}) {
  return {
    id: 'plugin-1',
    access: 'private',
    name: 'acme.plugin',
    displayName: 'Acme Plugin',
    iconUrl: 'https://example.com/plugin.png',
    developer: { name: 'Acme' },
    description: 'Adds Acme actions.',
    requireLicense: false,
    isAsync: true,
    phase: 'postLog',
    supportedLogTypes: ['Call'],
    pageContent: [],
    ...overrides,
  };
}

test('platform selection page filters catalog items and preserves selected search state', async () => {
  const platformSelectionPage = await loadRootComponent('src/components/platformSelectionPage.js');

  const privatePage = platformSelectionPage.getPlatformSelectionPageRender({
    platformList: catalogItems,
    searchWord: 'crm',
    selectedPlatform: 'private-crm=private',
    filter: 'Private',
  });

  assert.equal(privatePage.id, 'platformSelectionPage');
  assert.equal(privatePage.title, 'Select platform');
  assert.deepEqual(privatePage.schema.properties.platforms.oneOf, [
    {
      const: 'private-crm=private',
      title: 'Private CRM',
      icon: 'https://raw.githubusercontent.com/ringcentral/rc-unified-crm-extension-client/refs/heads/main/public/images/logo48.png',
      description: 'by Acme',
      meta: 'Private',
      actions: [
        { id: 'selectPlatform', title: 'Connect', icon: 'connect' },
      ],
    },
  ]);
  assert.deepEqual(privatePage.uiSchema.platformSearch['ui:filters'], ['All', 'Private', 'Shared with you']);
  assert.deepEqual(privatePage.formData.platformSearch, {
    search: 'crm',
    filter: 'Private',
  });
  assert.equal(privatePage.formData.platforms, 'private-crm=private');
});

test('plugin market page filters plugins and renders install actions', async () => {
  const pluginMarketListPage = await loadRootComponent('src/components/pluginMarketListPage.js');
  const plugins = [
    createPlugin({ id: 'public-plugin', access: 'public', displayName: 'Public Plugin', developer: { name: 'RingCentral' } }),
    createPlugin({ id: 'shared-plugin', access: 'shared', displayName: 'Shared Insights', developer: { name: 'Partner' } }),
    createPlugin({ id: 'private-plugin', access: 'private', displayName: 'Private Tools', developer: { name: 'Acme' } }),
  ];

  const page = pluginMarketListPage.getPluginMarketListPageRender({
    pluginList: plugins,
    searchWord: 'shared',
    filter: 'Shared with you',
  });

  assert.equal(page.id, 'pluginMarketListPage');
  assert.equal(page.title, 'Available plugins');
  assert.deepEqual(page.schema.properties.plugins.oneOf, [
    {
      const: 'shared-plugin=shared',
      title: 'Shared Insights',
      icon: 'https://example.com/plugin.png',
      description: 'by Partner',
      meta: 'Shared with you',
      authorAvatar: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
      actions: [
        { id: 'selectPlugin', title: 'Install', icon: 'info' },
      ],
    },
  ]);
  assert.deepEqual(page.formData.pluginSearch, {
    search: 'shared',
    filter: 'Shared with you',
  });
  assert.equal(page.formData.isFromAdmin, true);
});

test('installed plugin list page shows admin explore action, license warning, and empty helper text', async () => {
  const installedPluginListPage = await loadRootComponent('src/components/installedPluginListPage.js');
  const plugin = createPlugin({
    requireLicense: true,
    licenseStatus: false,
    errorMessage: 'License expired',
  });

  const page = installedPluginListPage.getInstalledPluginListPageRender({
    pluginList: [plugin],
    isFromAdmin: true,
  });
  const emptyPage = installedPluginListPage.getInstalledPluginListPageRender({
    pluginList: [],
    isFromAdmin: false,
  });

  assert.equal(page.id, 'installedPluginListPage');
  assert.equal(page.uiSchema.submitButtonOptions.submitText, 'Explore');
  assert.deepEqual(page.schema.properties.plugins.oneOf[0].iconMeta, [
    {
      icon: 'warning',
      color: 'danger.b03',
      size: 'large',
      message: 'License expired',
    },
  ]);
  assert.equal(page.formData.isFromAdmin, true);

  assert.equal(emptyPage.schema.properties.plugins, undefined);
  assert.equal(emptyPage.schema.properties.helperText.description, 'No plugin installed');
  assert.equal(emptyPage.uiSchema.helperText['ui:field'], 'typography');
});

test('plugin configure page renders visible config fields, auth action, and license status', async () => {
  const pluginConfigurePage = await loadRootComponent('src/components/pluginConfigurePage.js');
  const plugin = createPlugin({
    requireLicense: true,
    showAuthorizationButton: true,
    pageContent: [
      { const: 'apiKey', type: 'string', title: 'API key', required: true, description: 'CRM API key' },
      {
        const: 'mode',
        type: 'selection',
        title: 'Mode',
        oneOf: [
          { const: 'basic', title: 'Basic' },
          { const: 'advanced', title: 'Advanced' },
        ],
      },
      {
        const: 'logTypes',
        type: 'selection',
        title: 'Log types',
        multiSelect: true,
        oneOf: [
          { const: 'call', title: 'Call' },
          { const: 'sms', title: 'SMS' },
        ],
      },
      { const: 'hiddenSecret', type: 'string', title: 'Hidden secret', hidden: true },
    ],
  });

  const page = pluginConfigurePage.getPluginConfigurePageRender({
    pluginId: 'plugin-1',
    pluginAccess: 'private',
    plugin,
    config: {
      apiKey: { value: 'stored-key', customizable: false },
      mode: { value: 'advanced' },
      logTypes: { value: ['call'] },
    },
    isLoggedIn: false,
    hasValidLicense: false,
    licenseStatusDescription: 'License expired',
  });
  const loggedInPage = pluginConfigurePage.getPluginConfigurePageRender({
    pluginId: 'plugin-1',
    pluginAccess: 'private',
    plugin,
    config: {},
    isLoggedIn: true,
    hasValidLicense: true,
    licenseStatusDescription: 'Licensed',
  });

  assert.equal(page.id, 'pluginConfigurePage');
  assert.deepEqual(page.schema.required, ['apiKey']);
  assert.equal(page.schema.properties.config.properties.apiKey.default, 'stored-key');
  assert.equal(page.schema.properties.config.properties.apiKey.readOnly, true);
  assert.equal(page.schema.properties.config.properties.apiKey.description, 'CRM API key');
  assert.deepEqual(page.schema.properties.config.properties.mode.oneOf, [
    { const: 'basic', title: 'Basic' },
    { const: 'advanced', title: 'Advanced' },
  ]);
  assert.equal(page.uiSchema.config.mode['ui:widget'], 'select');
  assert.equal(page.schema.properties.config.properties.logTypes.type, 'array');
  assert.deepEqual(page.schema.properties.config.properties.logTypes.items.enum, ['call', 'sms']);
  assert.equal(page.uiSchema.config.logTypes['ui:widget'], 'checkboxes');
  assert.equal(page.schema.properties.config.properties.hiddenSecret, undefined);
  assert.deepEqual(page.schema.properties.basicInfo.oneOf[0].actions, [
    { id: 'pluginAuthButton', type: 'button', title: 'Connect', variant: 'contained', color: 'primary' },
  ]);
  assert.deepEqual(page.schema.properties.basicInfo.oneOf[1], {
    const: 'licenseStatus',
    title: 'License status',
    description: 'License expired',
    descriptionColor: 'error',
    actions: [
      { id: 'pluginLicenseRefreshButton', icon: 'refresh', title: 'Refresh' },
    ],
  });
  assert.equal(page.formData.existingConfig.apiKey.value, 'stored-key');
  assert.deepEqual(loggedInPage.schema.properties.basicInfo.oneOf[0].actions, [
    { id: 'pluginLogoutButton', type: 'button', variant: 'contained', color: 'danger.b03', title: 'Logout' },
  ]);
  assert.equal(loggedInPage.schema.properties.basicInfo.oneOf[1].descriptionColor, 'success');
});

test('plugin configuration form data merges submitted values into existing config metadata', async () => {
  const pluginConfigurePage = await loadRootComponent('src/components/pluginConfigurePage.js');

  const config = pluginConfigurePage.getMergedPluginConfigFromFormData({
    existingConfig: {
      apiKey: { value: 'old', customizable: false, encrypted: true },
      mode: { value: 'basic' },
    },
    config: {
      apiKey: 'new-key',
      retries: 3,
    },
  });

  assert.deepEqual(config, {
    apiKey: { value: 'new-key', customizable: false, encrypted: true },
    mode: { value: 'basic' },
    retries: { value: 3 },
  });
});

test('plugin admin configure page switches install and uninstall actions by installed state', async () => {
  const pluginAdminConfigurePage = await loadRootComponent('src/components/pluginAdminConfigurePage.js');
  const plugin = createPlugin();

  const installPage = pluginAdminConfigurePage.getPluginAdminConfigurePageRender({
    pluginId: 'plugin-1',
    pluginAccess: 'public',
    plugin,
    installed: false,
  });
  const uninstallPage = pluginAdminConfigurePage.getPluginAdminConfigurePageRender({
    pluginId: 'plugin-1',
    pluginAccess: 'public',
    plugin,
    installed: true,
  });

  assert.equal(installPage.id, 'pluginConfigurePage');
  assert.equal(installPage.formData.isFromAdmin, true);
  assert.deepEqual(installPage.schema.properties.basicInfo.oneOf[0].actions, [
    { id: 'installButton', type: 'button', title: 'Install', variant: 'contained', color: 'primary' },
  ]);
  assert.deepEqual(uninstallPage.schema.properties.basicInfo.oneOf[0].actions, [
    { id: 'removeButton', type: 'button', title: 'Uninstall', variant: 'contained', color: 'danger.b03' },
  ]);
  assert.equal(uninstallPage.formData.installed, true);
});