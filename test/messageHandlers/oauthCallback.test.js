const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installAdapterFrame(postedMessages) {
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            postedMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };
}

test('oauth callback forwards RingCentral authorization code and clears stale CRM JWT', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'old-crm-jwt',
  });
  global.chrome = storage.chrome;

  const postedMessages = [];
  const responses = [];
  installAdapterFrame(postedMessages);

  const oauthCallback = await loadBundledModule('src/messageHandlers/oauthCallBack.js', {
    stubs: {
      '../core/auth': {},
      '../core/user': {},
      '../core/admin': {},
      '../components/reportPage/reportPage': {},
      '../components/calldownPage': {},
      '../components/appointmentsPage/appointmentsPage': {},
      '../components/admin/adminPage': {},
      '../service/platformService': {},
      '../service/manifestService': {},
    },
  });

  await oauthCallback.onMessage({
    request: {
      platform: 'rc',
      callbackUri: 'https://redirect.example.com/?code=rc-code',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-authorization-code',
        callbackUri: 'https://redirect.example.com/?code=rc-code',
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(storage.store.rcUnifiedCrmExtJwt, undefined);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
});
