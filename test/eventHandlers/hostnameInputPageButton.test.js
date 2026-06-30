const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installAdapter(widgetMessages) {
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

test('hostnameInputPage saves submitted hostname before starting CRM authorization', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const initialManifest = {
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'dynamic',
        },
      },
    },
  };
  const refreshedManifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'dynamic',
        },
        auth: {
          type: 'oauth',
        },
      },
    },
  };

  const getManifestCalls = [];
  const saveManifestCalls = [];
  const managedOAuthChecks = [];
  const connectCalls = [];

  const hostnameInputPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.js',
    {
      stubs: {
        '../../../../service/embeddableServices': {
          async getServiceManifest() {
            return {
              name: 'acme',
              displayName: 'Acme CRM',
            };
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
        '../../../../service/manifestService': {
          async getManifest(force) {
            getManifestCalls.push(force);
            return refreshedManifest;
          },
          async saveManifest({ manifest }) {
            saveManifestCalls.push(manifest);
          },
        },
      },
    }
  );

  await hostnameInputPage.onEvent({
    data: {
      body: {
        button: {
          formData: {
            platformId: 'acme',
            platformDisplayName: 'Acme CRM',
            url: 'https://tenant.user.example.com/path',
            connectorId: 'connector-1',
            isPrivate: true,
          },
        },
      },
    },
    manifest: initialManifest,
    platformInfo: {},
    platformName: '',
    platform: null,
  });

  assert.deepEqual(storage.store['platform-info'], {
    platformName: 'acme',
    platformDisplayName: 'Acme CRM',
    hostname: 'tenant.user.example.com',
    connectorId: 'connector-1',
    isPrivate: true,
  });
  assert.deepEqual(getManifestCalls, [true]);
  assert.deepEqual(saveManifestCalls, [refreshedManifest]);
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
      manifest: refreshedManifest,
      platformName: 'acme',
      platform: refreshedManifest.platforms.acme,
    },
  ]);
  assert.deepEqual(connectCalls, [
    {
      platform: refreshedManifest.platforms.acme,
      platformName: 'acme',
      manifest: refreshedManifest,
    },
  ]);
});
