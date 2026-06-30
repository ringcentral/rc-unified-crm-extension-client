const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

test('pluginService fetches required plugin license status for the RingCentral account', async () => {
  const getCalls = [];

  const pluginService = await loadBundledModule('src/service/pluginService.js', {
    stubs: {
      axios: {
        async get(url) {
          getCalls.push(url);
          return {
            data: {
              licenseStatus: false,
              licenseStatusDescription: 'License expired',
            },
          };
        },
      },
      './manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
          };
        },
        async getPluginList() {
          return [];
        },
        async getPluginDetails() {
          return {};
        },
      },
      '../lib/util': {
        async getRcInfo() {
          return {
            value: {
              cachedData: {
                accountInfo: {
                  id: 12345,
                },
              },
            },
          };
        },
        showNotification() {},
      },
    },
  });

  const status = await pluginService.getPluginLicenseStatus({
    pluginId: 'plugin-1',
    plugin: {
      id: 'plugin-1',
      requireLicense: true,
    },
  });

  assert.deepEqual(getCalls, [
    'https://server.example.com/plugin/licenseStatus?rcAccountId=12345&pluginId=plugin-1',
  ]);
  assert.deepEqual(status, {
    id: 'plugin-1',
    licenseStatus: false,
    licenseStatusDescription: 'License expired',
  });
});

test('pluginService prepares setting updates and notification for upgraded installed plugins', async () => {
  const { createChromeStorage } = require('../helpers/chromeStorage.cjs');
  const storage = createChromeStorage({
    userSettings: {
      plugin_calendar: {
        value: {
          name: 'Calendar Plugin',
          version: '1.0.0',
          access: 'shared',
        },
      },
      autoLogSMS: {
        value: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const notifications = [];

  const pluginService = await loadBundledModule('src/service/pluginService.js', {
    stubs: {
      axios: {},
      './manifestService': {
        async getManifest() {
          return {
            serverUrl: 'https://server.example.com',
          };
        },
        async getPluginList() {
          return [
            {
              id: 'calendar',
              name: 'Calendar Plugin',
              version: '2.0.0',
            },
          ];
        },
        async getPluginDetails({ selectedPlugin }) {
          assert.equal(selectedPlugin.id, 'calendar');
          return {
            isAsync: true,
            phase: 'afterLog',
            supportedLogTypes: ['Call', 'Message'],
          };
        },
      },
      '../lib/util': {
        async getRcInfo() {
          return {};
        },
        showNotification(notification) {
          notifications.push(notification);
        },
      },
    },
  });

  const changedSettings = await pluginService.checkAndUpdatePluginVersion();

  assert.deepEqual(changedSettings, {
    plugin_calendar: {
      value: {
        name: 'Calendar Plugin',
        version: '2.0.0',
        isAsync: true,
        phase: 'afterLog',
        access: 'shared',
        logTypes: ['Call', 'Message'],
      },
    },
  });
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Calendar Plugin upgraded to 2.0.0\n',
      ttl: 5000,
    },
  ]);
});
