const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

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

test('contact search button for call logs opens call-log search results with the submitted name and phone', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const searchCalls = [];

  const contactSearchAdapterButtonCallLog = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonCallLog.js',
    {
      stubs: {
        '../../../../core/customContactSearch': {
          async getCustomContactSearchData(args) {
            searchCalls.push(args);
            return {
              id: 'contactSearchResultCallLog',
              contacts: ['crm-contact-1'],
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'salesforce',
  };
  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await contactSearchAdapterButtonCallLog.onEvent({
    data: {
      body: {
        button: {
          formData: {
            contactNameToSearch: 'Ada',
            contactPhoneNumber: '+15550100',
          },
        },
      },
    },
    manifest,
    platform,
  });

  assert.deepEqual(searchCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      contactSearch: 'Ada',
      pageId: 'contactSearchResultCallLog',
      contactPhoneNumber: '+15550100',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'contactSearchResultCallLog',
          contacts: ['crm-contact-1'],
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/contactSearchResultCallLog',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('contact search button for message logs opens message-log search results with the submitted name and phone', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const searchCalls = [];

  const contactSearchAdapterButtonMessageLog = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonMessageLog.js',
    {
      stubs: {
        '../../../../core/customContactSearch': {
          async getCustomContactSearchData(args) {
            searchCalls.push(args);
            return {
              id: 'contactSearchResultMessageLog',
              contacts: ['crm-contact-2'],
            };
          },
        },
      },
    }
  );

  const platform = {
    name: 'hubspot',
  };
  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await contactSearchAdapterButtonMessageLog.onEvent({
    data: {
      body: {
        button: {
          formData: {
            contactNameToSearch: 'Grace',
            contactPhoneNumber: '+15550101',
          },
        },
      },
    },
    manifest,
    platform,
  });

  assert.deepEqual(searchCalls, [
    {
      serverUrl: 'https://server.example.com',
      platform,
      contactSearch: 'Grace',
      pageId: 'contactSearchResultMessageLog',
      contactPhoneNumber: '+15550101',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'contactSearchResultMessageLog',
          contacts: ['crm-contact-2'],
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/contactSearchResultMessageLog',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
