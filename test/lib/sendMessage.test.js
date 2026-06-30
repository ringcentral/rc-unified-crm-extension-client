const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

test('sendMessageToExtension delegates to chrome.runtime.sendMessage', async () => {
  const sentMessages = [];
  global.chrome = {
    runtime: {
      sendMessage(message, callback) {
        sentMessages.push({ message, callback });
        callback?.({ result: 'ok' });
        return Promise.resolve({ result: 'ok' });
      },
    },
  };

  const { sendMessageToExtension } = await loadBundledModule('src/lib/sendMessage.js', {
    stubs: {
      './analytics': {
        trackChromeAPIError() {
          throw new Error('analytics should not run for successful sendMessage');
        },
      },
    },
  });

  const callbackResults = [];
  const result = await sendMessageToExtension(
    {
      type: 'c2d',
      phoneNumber: '+15550100',
    },
    (response) => callbackResults.push(response)
  );

  assert.deepEqual(result, {
    result: 'ok',
  });
  assert.deepEqual(callbackResults, [
    {
      result: 'ok',
    },
  ]);
  assert.deepEqual(sentMessages.map(({ message }) => message), [
    {
      type: 'c2d',
      phoneNumber: '+15550100',
    },
  ]);
});

test('sendMessageToExtension tracks Chrome API errors and alerts after extension context invalidation', async () => {
  const trackedErrors = [];
  const alerts = [];
  const consoleErrors = [];
  const originalConsoleError = console.error;
  console.error = (error) => {
    consoleErrors.push(error);
  };
  global.alert = (message) => {
    alerts.push(message);
  };
  global.chrome = {
    runtime: {
      sendMessage() {
        throw new Error('Extension context invalidated.');
      },
    },
  };

  try {
    const { sendMessageToExtension } = await loadBundledModule('src/lib/sendMessage.js', {
      stubs: {
        './analytics': {
          trackChromeAPIError(message) {
            trackedErrors.push(message);
          },
        },
      },
    });

    const result = sendMessageToExtension({
      type: 'c2d',
      phoneNumber: '+15550100',
    });

    assert.equal(result, undefined);
    assert.equal(consoleErrors.length, 1);
    assert.equal(consoleErrors[0].message, 'Extension context invalidated.');
    assert.deepEqual(trackedErrors, ['Extension context invalidated.']);
    assert.deepEqual(alerts, [
      'RingCentral App Connect has been upgraded. Please refresh current page to continue.',
    ]);
  } finally {
    console.error = originalConsoleError;
  }
});
