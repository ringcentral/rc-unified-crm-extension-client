const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            widgetMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };
}

test('selectPlatform uses a public fixed-environment connector to start CRM authorization', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const publicManifestUrl = 'https://appconnect.labs.ringcentral.com/public-api/connectors/connector-1/manifest?type=connector';
  const fetchedManifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'fixed',
          url: 'https://tenant.example.com/app',
        },
        auth: {
          type: 'oauth',
        },
      },
    },
  };

  const getUrls = [];
  const savedManifestUrls = [];
  const savedManifests = [];
  const managedOAuthChecks = [];
  const connectCalls = [];

  const selectPlatform = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.js',
    {
      stubs: {
        axios: {
          async get(url) {
            getUrls.push(url);
            return {
              data: fetchedManifest,
            };
          },
        },
        '../../../../service/manifestService': {
          async saveManifestUrl({ manifestUrl }) {
            savedManifestUrls.push(manifestUrl);
          },
          async saveManifest({ manifest }) {
            savedManifests.push(manifest);
            return manifest;
          },
        },
        '../../../../components/hostnameInputPage': {
          getHostnameInputPageRender() {
            throw new Error('fixed environment connectors should not request hostname input');
          },
        },
        '../../../../core/auth': {
          async checkManagedOAuthBeforeCrmVisible(args) {
            managedOAuthChecks.push(args);
            return {
              blocked: false,
            };
          },
          async onUserClickConnectButton(args) {
            connectCalls.push(args);
          },
        },
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-1',
                  },
                },
              },
            };
          },
        },
        '../../../../service/embeddableServices': {
          async getServiceManifest() {
            return {
              name: 'acme',
              displayName: 'Acme CRM',
            };
          },
        },
      },
    }
  );

  await selectPlatform.onEvent({
    data: {
      body: {
        button: {
          formData: {
            platformList: [
              {
                id: 'connector-1',
                name: 'acme',
                displayName: 'Acme CRM',
              },
            ],
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: '',
    platform: null,
    listButtonItemId: 'connector-1=public',
  });

  assert.deepEqual(getUrls, [publicManifestUrl]);
  assert.deepEqual(savedManifestUrls, [publicManifestUrl]);
  assert.deepEqual(savedManifests, [fetchedManifest]);
  assert.deepEqual(storage.store['platform-info'], {
    platformName: 'acme',
    platformDisplayName: 'Acme CRM',
    hostname: 'tenant.example.com',
    connectorId: 'connector-1',
    isPrivate: false,
  });
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: {
          name: 'acme',
          displayName: 'Acme CRM',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/settings',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(managedOAuthChecks, [
    {
      manifest: fetchedManifest,
      platformName: 'acme',
      platform: fetchedManifest.platforms.acme,
    },
  ]);
  assert.deepEqual(connectCalls, [
    {
      platform: fetchedManifest.platforms.acme,
      platformName: 'acme',
      manifest: fetchedManifest,
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-on',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      targetOrigin: '*',
    },
  ]);
});

test('selectPlatform stops fixed-environment authorization when managed OAuth blocks CRM visibility', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const fetchedManifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'fixed',
          url: 'https://tenant.example.com/app',
        },
        auth: {
          type: 'oauth',
          oauth: {
            adminManaged: {
              enabled: true,
            },
          },
        },
      },
    },
  };

  const managedOAuthChecks = [];

  const selectPlatform = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.js',
    {
      stubs: {
        axios: {
          async get() {
            return {
              data: fetchedManifest,
            };
          },
        },
        '../../../../service/manifestService': {
          async saveManifestUrl() {},
          async saveManifest({ manifest }) {
            return manifest;
          },
        },
        '../../../../components/hostnameInputPage': {
          getHostnameInputPageRender() {
            throw new Error('fixed environment connectors should not request hostname input');
          },
        },
        '../../../../core/auth': {
          async checkManagedOAuthBeforeCrmVisible(args) {
            managedOAuthChecks.push(args);
            return {
              blocked: true,
            };
          },
          async onUserClickConnectButton() {
            throw new Error('connect flow should not run when managed OAuth blocks CRM visibility');
          },
        },
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-1',
                  },
                },
              },
            };
          },
        },
        '../../../../service/embeddableServices': {
          async getServiceManifest() {
            return {
              name: 'acme',
            };
          },
        },
      },
    }
  );

  await selectPlatform.onEvent({
    data: {
      body: {
        button: {
          formData: {
            platformList: [
              {
                id: 'connector-1',
                name: 'acme',
                displayName: 'Acme CRM',
              },
            ],
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: '',
    platform: null,
    listButtonItemId: 'connector-1=public',
  });

  assert.deepEqual(storage.store['platform-info'], {
    platformName: 'acme',
    platformDisplayName: 'Acme CRM',
    hostname: 'tenant.example.com',
    connectorId: 'connector-1',
    isPrivate: false,
  });
  assert.deepEqual(widgetMessages.map(({ message }) => message.type), [
    'rc-adapter-register-third-party-service',
    'rc-adapter-navigate-to',
  ]);
  assert.deepEqual(managedOAuthChecks, [
    {
      manifest: fetchedManifest,
      platformName: 'acme',
      platform: fetchedManifest.platforms.acme,
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-on',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      targetOrigin: '*',
    },
  ]);
});

test('selectPlatform registers hostname input page when the connector requires user hostname input', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const fetchedManifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'fixed',
          url: 'https://tenant.example.com/app',
          instructions: ['Confirm the tenant hostname before connecting.'],
        },
        auth: {
          type: 'oauth',
        },
      },
    },
  };

  const hostnamePageCalls = [];

  const selectPlatform = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.js',
    {
      stubs: {
        axios: {
          async get() {
            return {
              data: fetchedManifest,
            };
          },
        },
        '../../../../service/manifestService': {
          async saveManifestUrl() {},
          async saveManifest({ manifest }) {
            return manifest;
          },
        },
        '../../../../components/hostnameInputPage': {
          getHostnameInputPageRender(args) {
            hostnamePageCalls.push(args);
            return {
              id: 'hostnameInputPage',
              title: 'Connect Acme CRM',
            };
          },
        },
        '../../../../core/auth': {
          async getManagedAuthState() {
            throw new Error('OAuth hostname input should not request API key managed auth state');
          },
          async checkManagedOAuthBeforeCrmVisible() {
            throw new Error('hostname input page should be shown before CRM visibility check');
          },
          async onUserClickConnectButton() {
            throw new Error('connect flow should wait for hostname input submission');
          },
        },
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-1',
                  },
                },
              },
            };
          },
        },
        '../../../../service/embeddableServices': {},
      },
    }
  );

  await selectPlatform.onEvent({
    data: {
      body: {
        button: {
          formData: {
            platformList: [
              {
                id: 'connector-1',
                name: 'acme',
                displayName: 'Acme CRM',
              },
            ],
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: '',
    platform: null,
    listButtonItemId: 'connector-1=public',
  });

  assert.deepEqual(hostnamePageCalls, [
    {
      platform: fetchedManifest.platforms.acme,
      isUrlValid: true,
      submitText: undefined,
      readyMessage: '',
      connectorId: 'connector-1',
      isPrivate: false,
    },
  ]);
  assert.equal(storage.store['platform-info'], undefined);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'hostnameInputPage',
          title: 'Connect Acme CRM',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/hostnameInputPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-on',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      targetOrigin: '*',
    },
  ]);
});

test('selectPlatform loads private connector manifest with RingCentral account scope', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const privateManifestUrl = 'https://appconnect.labs.ringcentral.com/public-api/connectors/connector-private/manifest?access=internal&type=connector&accountId=rc-account-private';
  const fetchedManifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      privatecrm: {
        name: 'privatecrm',
        displayName: 'Private CRM',
        environment: {
          type: 'fixed',
          url: 'https://private.example.com/app',
        },
        auth: {
          type: 'oauth',
        },
      },
    },
  };

  const getUrls = [];
  const savedManifestUrls = [];
  const connectCalls = [];

  const selectPlatform = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.js',
    {
      stubs: {
        axios: {
          async get(url) {
            getUrls.push(url);
            return {
              data: fetchedManifest,
            };
          },
        },
        '../../../../service/manifestService': {
          async saveManifestUrl({ manifestUrl }) {
            savedManifestUrls.push(manifestUrl);
          },
          async saveManifest({ manifest }) {
            return manifest;
          },
        },
        '../../../../components/hostnameInputPage': {
          getHostnameInputPageRender() {
            throw new Error('fixed environment connectors should not request hostname input');
          },
        },
        '../../../../core/auth': {
          async checkManagedOAuthBeforeCrmVisible() {
            return {
              blocked: false,
            };
          },
          async onUserClickConnectButton(args) {
            connectCalls.push(args);
          },
        },
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-private',
                  },
                },
              },
            };
          },
        },
        '../../../../service/embeddableServices': {
          async getServiceManifest() {
            return {
              name: 'privatecrm',
            };
          },
        },
      },
    }
  );

  await selectPlatform.onEvent({
    data: {
      body: {
        button: {
          formData: {
            platformList: [
              {
                id: 'connector-private',
                name: 'privatecrm',
                displayName: 'Private CRM',
              },
            ],
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: '',
    platform: null,
    listButtonItemId: 'connector-private=private',
  });

  assert.deepEqual(getUrls, [privateManifestUrl]);
  assert.deepEqual(savedManifestUrls, [privateManifestUrl]);
  assert.deepEqual(storage.store['platform-info'], {
    platformName: 'privatecrm',
    platformDisplayName: 'Private CRM',
    hostname: 'private.example.com',
    connectorId: 'connector-private',
    isPrivate: true,
  });
  assert.deepEqual(connectCalls, [
    {
      platform: fetchedManifest.platforms.privatecrm,
      platformName: 'privatecrm',
      manifest: fetchedManifest,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message.type), [
    'rc-adapter-register-third-party-service',
    'rc-adapter-navigate-to',
  ]);
});

test('selectPlatform loads shared connector manifest with owner account scope', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const sharedManifestUrl = 'https://appconnect.labs.ringcentral.com/public-api/connectors/connector-shared/manifest?access=internal&type=connector&accountId=owner-account';
  const fetchedManifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      sharedcrm: {
        name: 'sharedcrm',
        displayName: 'Shared CRM',
        environment: {
          type: 'fixed',
          url: 'https://shared.example.com/app',
        },
        auth: {
          type: 'oauth',
        },
      },
    },
  };

  const getUrls = [];
  const savedManifestUrls = [];
  const connectCalls = [];

  const selectPlatform = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.js',
    {
      stubs: {
        axios: {
          async get(url) {
            getUrls.push(url);
            return {
              data: fetchedManifest,
            };
          },
        },
        '../../../../service/manifestService': {
          async saveManifestUrl({ manifestUrl }) {
            savedManifestUrls.push(manifestUrl);
          },
          async saveManifest({ manifest }) {
            return manifest;
          },
        },
        '../../../../components/hostnameInputPage': {
          getHostnameInputPageRender() {
            throw new Error('fixed environment connectors should not request hostname input');
          },
        },
        '../../../../core/auth': {
          async checkManagedOAuthBeforeCrmVisible() {
            return {
              blocked: false,
            };
          },
          async onUserClickConnectButton(args) {
            connectCalls.push(args);
          },
        },
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'current-rc-account',
                  },
                },
              },
            };
          },
        },
        '../../../../service/embeddableServices': {
          async getServiceManifest() {
            return {
              name: 'sharedcrm',
            };
          },
        },
      },
    }
  );

  await selectPlatform.onEvent({
    data: {
      body: {
        button: {
          formData: {
            platformList: [
              {
                id: 'connector-shared',
                accountId: 'owner-account',
                name: 'sharedcrm',
                displayName: 'Shared CRM',
              },
            ],
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: '',
    platform: null,
    listButtonItemId: 'connector-shared=shared',
  });

  assert.deepEqual(getUrls, [sharedManifestUrl]);
  assert.deepEqual(savedManifestUrls, [sharedManifestUrl]);
  assert.deepEqual(storage.store['platform-info'], {
    platformName: 'sharedcrm',
    platformDisplayName: 'Shared CRM',
    hostname: 'shared.example.com',
    connectorId: 'connector-shared',
    isPrivate: true,
  });
  assert.deepEqual(connectCalls, [
    {
      platform: fetchedManifest.platforms.sharedcrm,
      platformName: 'sharedcrm',
      manifest: fetchedManifest,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(widgetMessages.map(({ message }) => message.type), [
    'rc-adapter-register-third-party-service',
    'rc-adapter-navigate-to',
  ]);
});