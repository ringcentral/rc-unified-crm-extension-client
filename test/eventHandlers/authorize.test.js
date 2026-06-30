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

test('/authorize disconnects CRM account and hides calldown page when already authorized', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    userSettings: {
      showCalldownTab: {
        value: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  const responses = [];
  const calls = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const authorize = await loadBundledModule('src/eventHandlers/rc-post-message-request/authorize.js', {
    stubs: {
      '../../core/user': {
        async updateSSCLToken(args) {
          calls.push({ name: 'updateSSCLToken', args });
        },
        getShowCalldownTabSetting() {
          return { value: true };
        },
      },
      '../../core/auth': {
        async onUserClickConnectButton() {
          throw new Error('connect flow should not run when CRM JWT exists');
        },
        async unAuthorize(args) {
          calls.push({ name: 'unAuthorize', args });
        },
        async refreshLicenseStatus(args) {
          calls.push({ name: 'refreshLicenseStatus', args });
        },
      },
      '../../components/calldownPage': {
        getCalldownPageRender() {
          return {
            id: 'calldownPage',
          };
        },
      },
      '../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  await authorize.onEvent({
    data: {
      requestId: 'req-authorize',
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      name: 'acme',
      useLicense: true,
    },
  });

  assert.equal(storage.store.crmAuthed, true);
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
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          hidden: true,
          unreadCount: 0,
        },
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
  assert.deepEqual(responses, [
    {
      requestId: 'req-authorize',
      payload: {
        data: 'ok',
      },
    },
  ]);
});
