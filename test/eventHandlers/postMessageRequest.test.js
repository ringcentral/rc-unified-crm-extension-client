const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

function createHandlerStub(calls, name) {
  return {
    async onEvent() {
      calls.push(name);
    },
  };
}

test('post-message router blocks call logging when CRM is not authorized', async () => {
  const notifications = [];
  const responses = [];
  const handlerCalls = [];

  const router = await loadBundledModule('src/eventHandlers/rc-post-message-request/index.js', {
    stubs: {
      '../../service/manifestService': {
        async getManifest() {
          return {
            platforms: {
              acme: {
                displayName: 'Acme CRM',
              },
            },
          };
        },
        async getPlatformList() {
          return [];
        },
      },
      '../../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      '../../lib/util': {
        showNotification(notification) {
          notifications.push(notification);
        },
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
      '../../core/auth': {
        async syncCrmAuthedFromStorage() {
          return false;
        },
        async checkAndOpenPlatformSelectionPage() {},
      },
      './authorize': createHandlerStub(handlerCalls, 'authorize'),
      './customizedPage/inputChanged': createHandlerStub(handlerCalls, 'customizedPage/inputChanged'),
      './contacts/match': createHandlerStub(handlerCalls, 'contacts/match'),
      './contacts/view': createHandlerStub(handlerCalls, 'contacts/view'),
      './callLogger': createHandlerStub(handlerCalls, 'callLogger'),
      './callLogger/inputChanged': createHandlerStub(handlerCalls, 'callLogger/inputChanged'),
      './callLogger/match': createHandlerStub(handlerCalls, 'callLogger/match'),
      './messageLogger': createHandlerStub(handlerCalls, 'messageLogger'),
      './messageLogger/inputChanged': createHandlerStub(handlerCalls, 'messageLogger/inputChanged'),
      './messageLogger/match': createHandlerStub(handlerCalls, 'messageLogger/match'),
      './settings': createHandlerStub(handlerCalls, 'settings'),
      './custom-button-click': createHandlerStub(handlerCalls, 'custom-button-click'),
    },
  });

  await router.onEvent({
    data: {
      requestId: 'req-call-log',
      path: '/callLogger',
    },
  });

  assert.deepEqual(handlerCalls, []);
  assert.deepEqual(responses, [
    {
      requestId: 'req-call-log',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, 'warning');
  assert.match(notifications[0].message, /connect to your Acme CRM account/);
});

