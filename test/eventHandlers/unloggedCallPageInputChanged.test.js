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

test('unlogged call page selection opens the cached call log page for the selected session id', async () => {
  const cachedCall = {
    sessionId: 'session-unlogged-1',
    direction: 'Inbound',
    phoneNumber: '+15550100',
    contactInfo: [
      {
        id: 'crm-contact-1',
        name: 'Ada Lovelace',
      },
    ],
  };
  const storage = createChromeStorage({
    unloggedCallPageDataCache: [cachedCall],
    implementedInterfaces: {
      findContactWithName: true,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const cachedNoteCalls = [];
  const logPageCalls = [];

  const unloggedCallPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/unloggedCallPage.js',
    {
      stubs: {
        '../../../../../core/log': {
          async getCachedNote(args) {
            cachedNoteCalls.push(args);
            return 'Follow up from report';
          },
        },
        '../../../../../components/logPage': {
          getLogPageRender(args) {
            logPageCalls.push(args);
            return {
              id: args.id,
              note: args.logInfo.note,
              contactPhoneNumber: args.contactPhoneNumber,
              useContactSearch: args.useContactSearch,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await unloggedCallPage.onEvent({
    data: {
      body: {
        formData: {
          record: 'session-unlogged-1',
        },
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(cachedNoteCalls, [
    {
      sessionId: 'session-unlogged-1',
    },
  ]);
  assert.deepEqual(logPageCalls, [
    {
      id: 'session-unlogged-1',
      manifest,
      logType: 'Call',
      contactInfo: cachedCall.contactInfo,
      triggerType: 'createLog',
      platformName: 'acme',
      direction: 'Inbound',
      logInfo: {
        note: 'Follow up from report',
      },
      contactPhoneNumber: '+15550100',
      useContactSearch: true,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-call-log-page',
        page: {
          id: 'session-unlogged-1',
          note: 'Follow up from report',
          contactPhoneNumber: '+15550100',
          useContactSearch: true,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/log/call/session-unlogged-1',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
