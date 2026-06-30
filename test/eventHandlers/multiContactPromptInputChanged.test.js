const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

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

test('multi-contact prompt search refreshes the prompt through debounce', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const pendingDebounces = [];
  const debounceConfigs = [];
  const refreshCalls = [];

  const promptPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getMultiContactPopPromptPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          createDebounceHandler(name) {
            debounceConfigs.push(name);
            return function runAndTrack(requestId, handler) {
              const promise = handler(requestId);
              pendingDebounces.push(promise);
              return promise;
            };
          },
          responseMessage() {
            throw new Error('search changes should not send an extra response');
          },
        },
        '../../../../../core/contact': {
          refreshContactPromptPage(args) {
            refreshCalls.push(args);
          },
        },
      },
    }
  );

  const contactInfo = [
    {
      id: 'crm-contact-1',
      name: 'Ada Lovelace',
    },
  ];

  await promptPage.onEvent({
    data: {
      requestId: 'req-contact-search',
      body: {
        keys: ['search'],
        page: {
          formData: {
            contactInfo,
          },
        },
        formData: {
          search: 'Ada',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });
  await Promise.all(pendingDebounces);

  assert.deepEqual(debounceConfigs, ['contactSearch']);
  assert.deepEqual(refreshCalls, [
    {
      contactInfo,
      searchWord: 'Ada',
    },
  ]);
  assert.deepEqual(widgetMessages, []);
});

test('multi-contact prompt selection opens the CRM contact and restores the ringing dialog', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const openContactCalls = [];
  const responses = [];

  const promptPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getMultiContactPopPromptPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          createDebounceHandler() {
            return function shouldNotDebounce() {
              throw new Error('contact selection should not use search debounce');
            };
          },
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
        },
        '../../../../../core/contact': {
          openContactPage(args) {
            openContactCalls.push(args);
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const contactInfo = [
    {
      id: 'crm-contact-1',
      type: 'Lead',
      name: 'Ada Lovelace',
    },
    {
      id: 'crm-contact-2',
      type: 'Contact',
      name: 'Grace Hopper',
    },
  ];

  await promptPage.onEvent({
    data: {
      requestId: 'req-contact-select',
      body: {
        keys: ['contactList'],
        formData: {
          contactList: 'crm-contact-2',
          contactInfo,
        },
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(openContactCalls, [
    {
      manifest,
      platformName: 'acme',
      contactType: 'Contact',
      contactId: 'crm-contact-2',
    },
  ]);
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
        type: 'rc-adapter-control-call',
        callAction: 'toggleRingingDialog',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-contact-select',
      payload: {
        data: 'ok',
      },
    },
  ]);
});
