const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

test('manifestService loads public, shared, and private connector catalogs with access labels', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url.endsWith('/public-api/connectors?type=connector')) {
        return {
          data: {
            connectors: [
              { id: 'public-connector', name: 'publicCrm' },
            ],
          },
        };
      }
      if (url.endsWith('/public-api/connectors/internal?access=internal&type=connector&accountId=12345')) {
        return {
          data: {
            sharedConnectors: [
              { id: 'shared-connector', name: 'sharedCrm' },
            ],
            privateConnectors: [
              { id: 'private-connector', name: 'privateCrm' },
            ],
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {
        async getRcInfo() {
          return {
            value: {
              cachedData: {
                accountInfo: {
                  id: '12345',
                },
              },
            },
          };
        },
      },
    },
  });

  const platformList = await manifestService.getPlatformList();

  assert.deepEqual(platformList, [
    { id: 'public-connector', name: 'publicCrm', access: 'public' },
    { id: 'shared-connector', name: 'sharedCrm', access: 'shared' },
    { id: 'private-connector', name: 'privateCrm', access: 'private' },
  ]);
  assert.equal(calls.length, 2);
});

test('manifestService follows public connector catalog pagination before merging internal connectors', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url.endsWith('/public-api/connectors?type=connector')) {
        return {
          data: {
            connectors: [
              { id: 'public-connector-1', name: 'publicCrmOne' },
            ],
            nextPageToken: 'page-2',
          },
        };
      }
      if (url.endsWith('/public-api/connectors?type=connector&pageToken=page-2')) {
        return {
          data: {
            connectors: [
              { id: 'public-connector-2', name: 'publicCrmTwo' },
            ],
          },
        };
      }
      if (url.endsWith('/public-api/connectors/internal?access=internal&type=connector&accountId=12345')) {
        return {
          data: {
            sharedConnectors: [
              { id: 'shared-connector', name: 'sharedCrm' },
            ],
            privateConnectors: [
              { id: 'private-connector', name: 'privateCrm' },
            ],
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {
        async getRcInfo() {
          return {
            value: {
              cachedData: {
                accountInfo: {
                  id: '12345',
                },
              },
            },
          };
        },
      },
    },
  });

  const platformList = await manifestService.getPlatformList();

  assert.deepEqual(platformList, [
    { id: 'public-connector-1', name: 'publicCrmOne', access: 'public' },
    { id: 'public-connector-2', name: 'publicCrmTwo', access: 'public' },
    { id: 'shared-connector', name: 'sharedCrm', access: 'shared' },
    { id: 'private-connector', name: 'privateCrm', access: 'private' },
  ]);
  assert.deepEqual(calls.filter((url) => url.includes('/public-api/connectors?type=connector')), [
    'https://appconnect.labs.ringcentral.com/public-api/connectors?type=connector',
    'https://appconnect.labs.ringcentral.com/public-api/connectors?type=connector&pageToken=page-2',
  ]);
});
test('manifestService follows public plugin catalog pagination before merging internal plugins', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url.endsWith('/public-api/connectors?type=plugin')) {
        return {
          data: {
            connectors: [
              { id: 'public-plugin-1', name: 'publicPluginOne' },
            ],
            nextPageToken: 'plugin-page-2',
          },
        };
      }
      if (url.endsWith('/public-api/connectors?type=plugin&pageToken=plugin-page-2')) {
        return {
          data: {
            connectors: [
              { id: 'public-plugin-2', name: 'publicPluginTwo' },
            ],
          },
        };
      }
      if (url.endsWith('/public-api/connectors/internal?access=internal&type=plugin&accountId=12345')) {
        return {
          data: {
            sharedConnectors: [
              { id: 'shared-plugin', name: 'sharedPlugin' },
            ],
            privateConnectors: [
              { id: 'private-plugin', name: 'privatePlugin' },
            ],
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {
        async getRcInfo() {
          return {
            value: {
              cachedData: {
                accountInfo: {
                  id: '12345',
                },
              },
            },
          };
        },
      },
    },
  });

  const pluginList = await manifestService.getPluginList();

  assert.deepEqual(pluginList, [
    { id: 'public-plugin-1', name: 'publicPluginOne', access: 'public' },
    { id: 'public-plugin-2', name: 'publicPluginTwo', access: 'public' },
    { id: 'shared-plugin', name: 'sharedPlugin', access: 'shared' },
    { id: 'private-plugin', name: 'privatePlugin', access: 'private' },
  ]);
  assert.deepEqual(calls.filter((url) => url.includes('/public-api/connectors?type=plugin')), [
    'https://appconnect.labs.ringcentral.com/public-api/connectors?type=plugin',
    'https://appconnect.labs.ringcentral.com/public-api/connectors?type=plugin&pageToken=plugin-page-2',
  ]);
});

test('manifestService applies meta and hostname overrides before persisting active manifest', async () => {
  const storage = createChromeStorage({
    'platform-info': {
      platformName: 'acme',
      hostname: 'tenant.example.com',
    },
  });
  global.chrome = storage.chrome;

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios: {},
      '../lib/util': {},
    },
  });

  const manifest = {
    serverUrl: 'https://default.example.com',
    author: {
      name: 'Original Author',
    },
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'dynamic',
        },
        override: [
          {
            triggerType: 'meta',
            overrideObjects: [
              { path: 'serverUrl', value: 'https://meta.example.com' },
              { path: 'author.name', value: 'Meta Author' },
            ],
          },
          {
            triggerType: 'hostname',
            triggerValue: 'tenant.example.com',
            overrideObjects: [
              { path: 'environment.url', value: 'https://tenant.example.com' },
            ],
          },
        ],
      },
    },
  };

  const savedManifest = await manifestService.saveManifest({ manifest });

  assert.equal(savedManifest.serverUrl, 'https://meta.example.com');
  assert.equal(savedManifest.author.name, 'Meta Author');
  assert.equal(savedManifest.platforms.acme.environment.url, 'https://tenant.example.com');
  assert.deepEqual(storage.store.customCrmManifest, savedManifest);
});
test('manifestService getPluginDetails fetches public plugin details from the approved manifest URL', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url.endsWith('/public-api/connectors/public-plugin/manifest?type=plugin')) {
        return {
          data: {
            platforms: {
              publicPlugin: {
                name: 'publicPlugin',
                displayName: 'Public Plugin',
                permissions: ['read'],
              },
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {
        async getRcInfo() {
          throw new Error('public plugin details should not read current account info');
        },
      },
    },
  });

  const details = await manifestService.getPluginDetails({
    selectedPlugin: {
      id: 'public-plugin',
      name: 'publicPlugin',
      access: 'public',
    },
  });

  assert.deepEqual(details, {
    name: 'publicPlugin',
    displayName: 'Public Plugin',
    permissions: ['read'],
  });
  assert.deepEqual(calls, [
    'https://appconnect.labs.ringcentral.com/public-api/connectors/public-plugin/manifest?type=plugin',
  ]);
});

test('manifestService getPluginDetails fetches shared plugin details with the catalog owner account id', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url.endsWith('/public-api/connectors/shared-plugin/manifest?access=internal&type=plugin&accountId=owner-789')) {
        return {
          data: {
            platforms: {
              sharedPlugin: {
                name: 'sharedPlugin',
                displayName: 'Shared Plugin',
                permissions: ['admin'],
              },
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {
        async getRcInfo() {
          throw new Error('shared plugin details should use selectedPlugin.accountId');
        },
      },
    },
  });

  const details = await manifestService.getPluginDetails({
    selectedPlugin: {
      id: 'shared-plugin',
      name: 'sharedPlugin',
      access: 'shared',
      accountId: 'owner-789',
    },
  });

  assert.deepEqual(details, {
    name: 'sharedPlugin',
    displayName: 'Shared Plugin',
    permissions: ['admin'],
  });
  assert.deepEqual(calls, [
    'https://appconnect.labs.ringcentral.com/public-api/connectors/shared-plugin/manifest?access=internal&type=plugin&accountId=owner-789',
  ]);
});

test('manifestService getPluginDetails fetches private plugin details with the current account id', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url.endsWith('/public-api/connectors/private-plugin/manifest?access=internal&type=plugin&accountId=current-123')) {
        return {
          data: {
            platforms: {
              privatePlugin: {
                name: 'privatePlugin',
                displayName: 'Private Plugin',
                permissions: ['write'],
              },
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {
        async getRcInfo() {
          return {
            value: {
              cachedData: {
                accountInfo: {
                  id: 'current-123',
                },
              },
            },
          };
        },
      },
    },
  });

  const details = await manifestService.getPluginDetails({
    selectedPlugin: {
      id: 'private-plugin',
      name: 'privatePlugin',
      access: 'private',
    },
  });

  assert.deepEqual(details, {
    name: 'privatePlugin',
    displayName: 'Private Plugin',
    permissions: ['write'],
  });
  assert.deepEqual(calls, [
    'https://appconnect.labs.ringcentral.com/public-api/connectors/private-plugin/manifest?access=internal&type=plugin&accountId=current-123',
  ]);
});

test('manifestService refreshManifest fetches manifestUrl and persists the refreshed manifest with overrides', async () => {
  const storage = createChromeStorage({
    manifestUrl: 'https://manifest.example.com/acme.json',
    'platform-info': {
      platformName: 'acme',
      hostname: 'tenant.example.com',
    },
  });
  global.chrome = storage.chrome;

  const calls = [];
  const axios = {
    async get(url) {
      calls.push(url);
      if (url === 'https://manifest.example.com/acme.json') {
        return {
          data: {
            serverUrl: 'https://default.example.com',
            author: {
              name: 'Original Author',
            },
            platforms: {
              acme: {
                name: 'acme',
                override: [
                  {
                    triggerType: 'meta',
                    overrideObjects: [
                      { path: 'serverUrl', value: 'https://refreshed.example.com' },
                    ],
                  },
                  {
                    triggerType: 'hostname',
                    triggerValue: 'tenant.example.com',
                    overrideObjects: [
                      { path: 'environment.url', value: 'https://tenant.example.com' },
                    ],
                  },
                ],
              },
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {},
    },
  });

  const manifest = await manifestService.refreshManifest();

  assert.deepEqual(calls, ['https://manifest.example.com/acme.json']);
  assert.equal(manifest.serverUrl, 'https://refreshed.example.com');
  assert.equal(manifest.platforms.acme.environment.url, 'https://tenant.example.com');
  assert.deepEqual(storage.store.customCrmManifest, manifest);
});

test('manifestService refreshManifest reuses existing local manifest when no manifestUrl is stored', async () => {
  const existingManifest = {
    serverUrl: 'https://local.example.com',
    platforms: {
      acme: {
        name: 'acme',
        override: [
          {
            triggerType: 'hostname',
            triggerValue: 'tenant.example.com',
            overrideObjects: [
              { path: 'environment.url', value: 'https://local-tenant.example.com' },
            ],
          },
        ],
      },
    },
  };
  const storage = createChromeStorage({
    customCrmManifest: existingManifest,
    'platform-info': {
      platformName: 'acme',
      hostname: 'tenant.example.com',
    },
  });
  global.chrome = storage.chrome;

  const axios = {
    async get(url) {
      throw new Error(`refreshManifest should not request a URL when only a local manifest object exists: ${url}`);
    },
  };

  const manifestService = await loadBundledModule('src/service/manifestService.js', {
    stubs: {
      axios,
      '../lib/util': {},
    },
  });

  const manifest = await manifestService.refreshManifest();

  assert.equal(manifest.serverUrl, 'https://local.example.com');
  assert.equal(manifest.platforms.acme.environment.url, 'https://local-tenant.example.com');
  assert.deepEqual(storage.store.customCrmManifest, manifest);
  assert.equal(storage.store.manifestUrl, undefined);
});