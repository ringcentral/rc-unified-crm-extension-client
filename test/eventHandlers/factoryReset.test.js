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

test('factory reset disconnects CRM, clears platform state, and logs out the widget', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const calls = [];
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const factoryReset = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/auth/factoryResetButton.js', {
    stubs: {
      '../../../../core/user': {
        async updateSSCLToken(args) {
          calls.push({ name: 'updateSSCLToken', args });
        },
      },
      '../../../../core/auth': {
        async unAuthorize(args) {
          calls.push({ name: 'unAuthorize', args });
        },
        async refreshLicenseStatus(args) {
          calls.push({ name: 'refreshLicenseStatus', args });
        },
      },
      '../../../../lib/analytics': {
        trackFactoryReset() {
          calls.push({ name: 'trackFactoryReset' });
        },
      },
      '../../../../service/platformService': {
        async clearPlatformInfo() {
          calls.push({ name: 'clearPlatformInfo' });
        },
      },
    },
  });

  await factoryReset.onEvent({
    data: {},
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platform: {
      name: 'acme',
      useLicense: true,
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-logout',
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
  assert.deepEqual(calls, [
    {
      name: 'updateSSCLToken',
      args: {
        serverUrl: 'https://server.example.com',
        platform: {
          name: 'acme',
          useLicense: true,
        },
        token: '',
      },
    },
    {
      name: 'unAuthorize',
      args: {
        serverUrl: 'https://server.example.com',
        rcUnifiedCrmExtJwt: 'crm-jwt',
      },
    },
    {
      name: 'refreshLicenseStatus',
      args: {
        serverUrl: 'https://server.example.com',
      },
    },
    {
      name: 'clearPlatformInfo',
    },
    {
      name: 'trackFactoryReset',
    },
  ]);
});
