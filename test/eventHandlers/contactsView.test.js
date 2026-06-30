const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindow(windowMessages) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
}

function createContactsViewStubs(openContactPageCalls, responses) {
  return {
    '../../../core/contact': {
      async openContactPage(args) {
        openContactPageCalls.push(args);
      },
    },
    '../../../core/user': {
      getCallPopMultiMatchBehavior(userSettings) {
        return {
          value: userSettings?.multiMatchBehavior ?? 'prompt',
        };
      },
    },
    '../../../lib/util': {
      showNotification() {},
      responseMessage(requestId, payload) {
        responses.push({ requestId, payload });
      },
    },
  };
}

test('/contacts/view opens a selected CRM contact when no call is ongoing', async () => {
  const storage = createChromeStorage({
    hasOngoingCall: false,
    userSettings: {
      multiMatchBehavior: 'prompt',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  installWindow(windowMessages);

  const openContactPageCalls = [];
  const responses = [];
  const contactsView = await loadBundledModule('src/eventHandlers/rc-post-message-request/contacts/view.js', {
    stubs: createContactsViewStubs(openContactPageCalls, responses),
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await contactsView.onEvent({
    data: {
      requestId: 'req-contact-view',
      body: {
        id: 'crm-contact-1',
        contactType: 'Lead',
        phoneNumbers: [
          {
            phoneNumber: '+15550100',
          },
        ],
      },
    },
    manifest,
    platformName: 'acme',
  });

  assert.deepEqual(openContactPageCalls, [
    {
      manifest,
      platformName: 'acme',
      phoneNumber: '+15550100',
      contactId: 'crm-contact-1',
      contactType: 'Lead',
      multiContactMatchBehavior: 'prompt',
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
      requestId: 'req-contact-view',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('/contacts/view opens call-pop contact resolution without forcing a contact id during ongoing calls', async () => {
  const storage = createChromeStorage({
    hasOngoingCall: true,
    userSettings: {
      multiMatchBehavior: 'firstMatch',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  installWindow(windowMessages);

  const openContactPageCalls = [];
  const responses = [];
  const contactsView = await loadBundledModule('src/eventHandlers/rc-post-message-request/contacts/view.js', {
    stubs: createContactsViewStubs(openContactPageCalls, responses),
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await contactsView.onEvent({
    data: {
      requestId: 'req-contact-view-ringing',
      body: {
        id: 'crm-contact-1',
        contactType: 'Contact',
        phoneNumbers: [
          {
            phoneNumber: '+15550101',
          },
        ],
      },
    },
    manifest,
    platformName: 'acme',
  });

  assert.deepEqual(openContactPageCalls, [
    {
      manifest,
      platformName: 'acme',
      phoneNumber: '+15550101',
      contactType: 'Contact',
      multiContactMatchBehavior: 'firstMatch',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-contact-view-ringing',
      payload: {
        data: 'ok',
      },
    },
  ]);
});
