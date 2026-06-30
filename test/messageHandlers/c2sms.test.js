const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

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

test('c2sms sends widget SMS intent with cached recipient name', async () => {
  const postedMessages = [];
  const responses = [];
  installAdapterFrame(postedMessages);

  const c2sms = await loadBundledModule('src/messageHandlers/c2sms.js', {
    stubs: {
      '../core/contact': {
        getLocalCachedContact({ phoneNumber, platformName }) {
          assert.equal(phoneNumber, '+15550100');
          assert.equal(platformName, 'acme');
          return [
            {
              name: 'Ada Lovelace',
            },
          ];
        },
      },
      '../service/platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
    },
  });

  await c2sms.onMessage({
    request: {
      phoneNumber: '+15550100',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+15550100',
        conversation: true,
        recipient: {
          name: 'Ada Lovelace',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
});
