const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installAdapter(widgetMessages) {
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

test('save temp note button navigates back and caches the note by call session id', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const cacheCalls = [];
  const saveTempNoteButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/saveTempNoteButton.js',
    {
      stubs: {
        '../../../../core/log': {
          async cacheCallNote(args) {
            cacheCalls.push(args);
          },
        },
      },
    }
  );

  await saveTempNoteButton.onEvent({
    data: {
      body: {
        button: {
          formData: {
            sessionId: 'call-session-1',
            note: 'Customer asked for pricing follow-up',
          },
        },
      },
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
  ]);
  assert.deepEqual(cacheCalls, [
    {
      sessionId: 'call-session-1',
      note: 'Customer asked for pricing follow-up',
    },
  ]);
});

test('calldown text action starts a widget SMS from the cached callback row', async () => {
  const storage = createChromeStorage({
    calldownListCache: [
      {
        id: 'callback-1',
        phoneNumber: '+15550100',
      },
    ],
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calldownActionText = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionText.js'
  );

  await calldownActionText.onEvent({
    data: {
      body: {
        button: {
          formData: {
            recordId: 'callback-1',
          },
        },
      },
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+15550100',
        conversation: true,
      },
      targetOrigin: '*',
    },
  ]);
});

test('calldown text action falls back to the button additionalInfo phone number when cache misses', async () => {
  const storage = createChromeStorage({
    calldownListCache: [],
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calldownActionText = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionText.js'
  );

  await calldownActionText.onEvent({
    data: {
      body: {
        button: {
          additionalInfo: {
            recordId: 'missing-callback',
            phoneNumber: '+15550101',
          },
        },
      },
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+15550101',
        conversation: true,
      },
      targetOrigin: '*',
    },
  ]);
});

test('calldown text action stays quiet when neither cache nor button data has a phone number', async () => {
  const storage = createChromeStorage({
    calldownListCache: [],
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calldownActionText = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionText.js'
  );

  await calldownActionText.onEvent({
    data: {
      body: {
        button: {
          formData: {
            recordId: 'missing-callback',
          },
        },
      },
    },
  });

  assert.deepEqual(widgetMessages, []);
});
