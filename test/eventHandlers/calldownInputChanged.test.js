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

test('calldown page search typing refreshes records through debounce without showing a spinner', async () => {
  const storage = createChromeStorage({
    userSettings: {
      timezone: 'UTC',
    },
    calldownLastState: {
      search: '',
      filter: 'Open',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pendingDebounces = [];
  const debounceConfigs = [];
  const pageCalls = [];
  const responses = [];

  const calldownPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          createDebounceHandler(name, delay) {
            debounceConfigs.push({ name, delay });
            return function runAndTrack(requestId, handler) {
              const promise = handler(requestId);
              pendingDebounces.push(promise);
              return promise;
            };
          },
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
        },
        '../../../../../components/calldownPage': {
          async getCalldownPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'calldownPage',
              search: args.searchWithFilters.search,
              filter: args.searchWithFilters.filter,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await calldownPage.onEvent({
    data: {
      requestId: 'req-calldown-search',
      body: {
        keys: ['searchWithFilters'],
        formData: {
          searchWithFilters: {
            search: 'Ada',
            filter: 'Open',
          },
        },
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });
  await Promise.all(pendingDebounces);

  assert.deepEqual(debounceConfigs, [
    {
      name: 'calldownSearch',
      delay: 300,
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      searchWithFilters: {
        search: 'Ada',
        filter: 'Open',
      },
      filterName: '',
      filterStatus: 'All',
      userSettings: {
        timezone: 'UTC',
      },
    },
  ]);
  assert.deepEqual(storage.store.calldownLastState, {
    search: 'Ada',
    filter: 'Open',
  });
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          search: 'Ada',
          filter: 'Open',
        },
      },
      targetOrigin: undefined,
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-calldown-search',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('calldown page filter change refreshes immediately with loading state and stores the last filter', async () => {
  const storage = createChromeStorage({
    userSettings: {
      locale: 'en-US',
    },
    calldownLastState: {
      search: 'Ada',
      filter: 'Open',
    },
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pageCalls = [];
  const responses = [];

  const calldownPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          createDebounceHandler() {
            return function shouldNotDebounce() {
              throw new Error('filter changes should refresh immediately');
            };
          },
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
        },
        '../../../../../components/calldownPage': {
          async getCalldownPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'calldownPage',
              filter: args.searchWithFilters.filter,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await calldownPage.onEvent({
    data: {
      requestId: 'req-calldown-filter',
      body: {
        keys: ['searchWithFilters'],
        formData: {
          searchWithFilters: {
            search: 'Ada',
            filter: 'Overdue',
          },
        },
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(storage.store.calldownLastState, {
    search: 'Ada',
    filter: 'Overdue',
  });
  assert.deepEqual(pageCalls, [
    {
      manifest,
      searchWithFilters: {
        search: 'Ada',
        filter: 'Overdue',
      },
      filterName: '',
      filterStatus: 'All',
      userSettings: {
        locale: 'en-US',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          filter: 'Overdue',
        },
      },
      targetOrigin: undefined,
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-calldown-filter',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
