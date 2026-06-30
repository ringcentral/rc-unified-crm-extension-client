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

test('c2d sends widget call intent and responds to Chrome runtime', async () => {
  const postedMessages = [];
  const responses = [];
  installAdapterFrame(postedMessages);

  const c2d = await loadBundledModule('src/messageHandlers/c2d.js');

  await c2d.onMessage({
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
        type: 'rc-adapter-new-call',
        phoneNumber: '+15550100',
        toCall: true,
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
