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

test('/contacts/match processes one number and schedules remaining numbers', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const postedMessages = [];
  const responses = [];
  const contactCalls = [];
  installAdapterFrame(postedMessages);

  const contactsMatchHandler = await loadBundledModule('src/eventHandlers/rc-post-message-request/contacts/match.js', {
    stubs: {
      '../../../core/contact': {
        async getContact(args) {
          contactCalls.push(args);
          return {
            matched: true,
            returnMessage: null,
            contactInfo: [
              {
                id: 'contact-1',
                name: 'Ada Lovelace',
                type: 'Lead',
                additionalInfo: { account: 'Acme' },
                mostRecentActivityDate: '2026-06-01T00:00:00Z',
              },
              {
                id: 'contact-new',
                name: 'New Contact Draft',
                type: 'Lead',
                isNewContact: true,
              },
            ],
          };
        },
      },
      '../../../lib/util': {
        showNotification() {},
        responseMessage(requestId, payload) {
          responses.push({ requestId, payload });
        },
      },
    },
  });

  await contactsMatchHandler.onEvent({
    data: {
      requestId: 'req-1',
      body: {
        phoneNumbers: ['+15550100', '+15550200'],
        triggerFrom: 'auto',
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(contactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550100',
      platformName: 'acme',
      isFromManual: false,
      isExtensionNumber: false,
      isForceRefresh: true,
      isToTriggerContactMatch: false,
    },
  ]);
  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-contact-match',
        phoneNumbers: ['+15550200'],
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-1',
      payload: {
        data: {
          '+15550100': [
            {
              id: 'contact-1',
              type: 'acme',
              name: 'Ada Lovelace',
              phoneNumbers: [
                {
                  phoneNumber: '+15550100',
                  phoneType: 'direct',
                },
              ],
              entityType: 'acme',
              contactType: 'Lead',
              additionalInfo: { account: 'Acme' },
              mostRecentActivityDate: '2026-06-01T00:00:00Z',
            },
          ],
        },
      },
    },
  ]);
});

