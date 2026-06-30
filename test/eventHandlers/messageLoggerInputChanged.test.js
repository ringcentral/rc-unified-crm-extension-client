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

test('/messageLogger/inputChanged updates the message log page and responds to the widget', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const updateCalls = [];
  const responses = [];

  const inputChanged = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/inputChanged/index.js', {
    stubs: {
      '../../../../components/logPage': {
        getUpdatedLogPageRender(args) {
          updateCalls.push(args);
          return {
            id: 'messageLogPage',
            updatedContact: args.updateData.formData.contact,
          };
        },
      },
      '../../../../core/customContactSearch': {
        getCustomContactSearch() {
          throw new Error('custom contact search should not open for normal message form edits');
        },
      },
      '../../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const body = {
    formData: {
      contact: 'contact-1',
      note: 'Follow up tomorrow',
    },
  };

  await inputChanged.onEvent({
    data: {
      requestId: 'req-message-input',
      body,
    },
    manifest,
    platformName: 'acme',
  });

  assert.deepEqual(updateCalls, [
    {
      manifest,
      logType: 'Message',
      platformName: 'acme',
      updateData: body,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-messages-log-page',
        page: {
          id: 'messageLogPage',
          updatedContact: 'contact-1',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-message-input',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('/messageLogger/inputChanged opens custom contact search when contact is searchContact', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const searchCalls = [];
  const responses = [];

  const inputChanged = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/inputChanged/index.js', {
    stubs: {
      '../../../../components/logPage': {
        getUpdatedLogPageRender() {
          return {
            id: 'messageLogPage',
          };
        },
      },
      '../../../../core/customContactSearch': {
        getCustomContactSearch(args) {
          searchCalls.push(args);
          return {
            id: 'messageContactSearchPage',
            phoneNumber: args.contactPhoneNumber,
          };
        },
      },
      '../../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  await inputChanged.onEvent({
    data: {
      requestId: 'req-message-search',
      body: {
        formData: {
          contact: 'searchContact',
          contactPhoneNumber: '+15550100',
        },
      },
    },
    manifest: {},
    platformName: 'acme',
  });

  assert.deepEqual(searchCalls, [
    {
      contactSearchAdapterButton: 'contactSearchAdapterButtonMessageLog',
      contactPhoneNumber: '+15550100',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-messages-log-page',
        page: {
          id: 'messageLogPage',
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'messageContactSearchPage',
          phoneNumber: '+15550100',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/messageContactSearchPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-message-search',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('/messageLogger/match returns dummy match rows for non-empty cached message log records', async () => {
  const storage = createChromeStorage({
    'rc-crm-conversation-log-log-1': {
      id: 'saved-message-log-1',
    },
    'rc-crm-conversation-log-log-2': {},
  });
  global.chrome = storage.chrome;

  const responses = [];

  const match = await loadBundledModule('src/eventHandlers/rc-post-message-request/messageLogger/match/index.js', {
    stubs: {
      '../../../../lib/util': {
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
        isObjectEmpty(value) {
          return Object.keys(value).length === 0;
        },
      },
    },
  });

  await match.onEvent({
    data: {
      requestId: 'req-message-match',
      body: {
        conversationLogIds: ['log-1', 'log-2', 'log-3'],
      },
    },
  });

  assert.deepEqual(responses, [
    {
      requestId: 'req-message-match',
      payload: {
        data: {
          'log-1': [
            {
              id: 'dummyId',
            },
          ],
        },
      },
    },
  ]);
});
