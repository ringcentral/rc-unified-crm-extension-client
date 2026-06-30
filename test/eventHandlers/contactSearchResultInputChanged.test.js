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

test('call-log contact search result selection caches the CRM contact and updates the call log page', async () => {
  const cacheLogPageData = {
    id: 'call-session-1',
    contactInfo: [
      {
        id: 'existing-contact',
        name: 'Existing Contact',
        type: 'Contact',
      },
    ],
    call: {
      sessionId: 'call-session-1',
    },
  };
  const storage = createChromeStorage({
    cacheLogPageData,
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];
  const updateCalls = [];

  const contactSearchResultCallLog = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultCallLog.js',
    {
      stubs: {
        '../../../../../components/logPage': {
          getLogPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'callLogPage',
              formData: {
                note: 'cached note',
              },
            };
          },
          getUpdatedLogPageRender(args) {
            updateCalls.push(args);
            return {
              id: 'callLogPage',
              selectedContact: args.updateData.formData.contact,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await contactSearchResultCallLog.onEvent({
    data: {
      body: {
        page: {
          formData: {
            contactInfo: [
              {
                id: 'crm-contact-1',
                name: 'Ada Lovelace',
                type: 'Lead',
                isNewContact: true,
              },
            ],
          },
        },
        formData: {
          contactList: 'crm-contact-1',
          contactPhoneNumber: '+15550100',
        },
      },
    },
    manifest,
    platformName: 'salesforce',
  });

  const expectedContact = {
    id: 'crm-contact-1',
    name: 'Ada Lovelace',
    type: 'Lead',
  };
  assert.deepEqual(storage.store['rc-crm-search-contact-+15550100'], [expectedContact]);
  assert.deepEqual(renderCalls, [
    {
      ...cacheLogPageData,
      contactInfo: [
        {
          id: 'existing-contact',
          name: 'Existing Contact',
          type: 'Contact',
          isNewContact: undefined,
        },
        {
          ...expectedContact,
          isNewContact: undefined,
        },
      ],
    },
  ]);
  assert.deepEqual(updateCalls, [
    {
      manifest,
      platformName: 'salesforce',
      logType: 'Call',
      updateData: {
        page: {
          id: 'callLogPage',
          formData: {
            note: 'cached note',
          },
        },
        formData: {
          note: 'cached note',
          contact: 'crm-contact-1',
          contactType: 'Lead',
          contactName: 'Ada Lovelace',
          contactInfo: [
            {
              id: 'existing-contact',
              name: 'Existing Contact',
              type: 'Contact',
              isNewContact: undefined,
            },
            {
              ...expectedContact,
              isNewContact: undefined,
            },
          ],
          returnToHistoryPage: true,
        },
        keys: ['contact'],
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-contact-match',
        phoneNumbers: ['+15550100'],
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-update-call-log-page',
        page: {
          id: 'callLogPage',
          selectedContact: 'crm-contact-1',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/history',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/log/call/call-session-1',
      },
      targetOrigin: '*',
    },
  ]);
});

test('message-log contact search result selection caches the CRM contact and updates the message log page', async () => {
  const cacheLogPageData = {
    id: 'conversation-1',
    contactInfo: [
      {
        id: 'existing-message-contact',
        name: 'Existing Message Contact',
        type: 'Contact',
      },
    ],
    conversation: {
      id: 'conversation-1',
    },
  };
  const storage = createChromeStorage({
    cacheLogPageData,
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];
  const updateCalls = [];

  const contactSearchResultMessageLog = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultMessageLog.js',
    {
      stubs: {
        '../../../../../components/logPage': {
          getLogPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'messageLogPage',
              formData: {
                subject: 'cached subject',
              },
            };
          },
          getUpdatedLogPageRender(args) {
            updateCalls.push(args);
            return {
              id: 'messageLogPage',
              selectedContact: args.updateData.formData.contact,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await contactSearchResultMessageLog.onEvent({
    data: {
      body: {
        keys: ['contactList'],
        page: {
          formData: {
            contactInfo: [
              {
                id: 'crm-contact-2',
                name: 'Grace Hopper',
                type: 'Contact',
                isNewContact: true,
              },
            ],
          },
        },
        formData: {
          contactList: 'crm-contact-2',
          contactPhoneNumber: '+15550101',
        },
      },
    },
    manifest,
    platformName: 'hubspot',
  });

  const expectedContact = {
    id: 'crm-contact-2',
    name: 'Grace Hopper',
    type: 'Contact',
  };
  assert.deepEqual(storage.store['rc-crm-search-contact-+15550101'], [expectedContact]);
  assert.equal(renderCalls.length, 1);
  assert.deepEqual(updateCalls, [
    {
      manifest,
      platformName: 'hubspot',
      logType: 'Call',
      updateData: {
        page: {
          id: 'messageLogPage',
          formData: {
            subject: 'cached subject',
          },
        },
        formData: {
          subject: 'cached subject',
          contact: 'crm-contact-2',
          contactType: 'Contact',
          contactName: 'Grace Hopper',
          contactInfo: [
            {
              id: 'existing-message-contact',
              name: 'Existing Message Contact',
              type: 'Contact',
              isNewContact: undefined,
            },
            {
              ...expectedContact,
              isNewContact: undefined,
            },
          ],
          returnToHistoryPage: true,
        },
        keys: ['contact'],
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-contact-match',
        phoneNumbers: ['+15550101'],
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-update-messages-log-page',
        page: {
          id: 'messageLogPage',
          selectedContact: 'crm-contact-2',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/history',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/log/messages/conversation-1',
      },
      targetOrigin: '*',
    },
  ]);
});
