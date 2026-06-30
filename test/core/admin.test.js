const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

test('admin.getManagedAuthSettings fetches connector-scoped settings and caches them', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const getCalls = [];

  const admin = await loadBundledModule('src/core/admin.js', {
    stubs: {
      axios: {
        async get(url) {
          getCalls.push(url);
          return {
            data: {
              orgFields: ['apiKey'],
              userFields: ['username'],
            },
          };
        },
      },
      moment: () => ({
        format() {
          return '2026-01-01';
        },
      }),
      '../components/admin/adminPage': {},
      '../core/auth': {},
      '../lib/rcAPI': {
        RcAPI: class RcAPI {},
      },
      'awesome-phonenumber': {
        parsePhoneNumber() {
          return {};
        },
      },
      '../lib/util': {
        getRcAccessToken() {
          return 'rc-access-token';
        },
        async getRcContactInfo() {
          return [];
        },
        showNotification() {},
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            connectorId: 'shared connector',
            isPrivate: true,
          };
        },
      },
      '../service/manifestService': {},
    },
  });

  const settings = await admin.getManagedAuthSettings({
    serverUrl: 'https://server.example.com',
  });

  assert.deepEqual(getCalls, [
    'https://server.example.com/admin/managedAuth?jwtToken=crm-jwt&rcAccessToken=rc-access-token&connectorId=shared%20connector&isPrivate=true',
  ]);
  assert.deepEqual(settings, {
    orgFields: ['apiKey'],
    userFields: ['username'],
  });
  assert.deepEqual(storage.store.managedAuthSettings, settings);
});
