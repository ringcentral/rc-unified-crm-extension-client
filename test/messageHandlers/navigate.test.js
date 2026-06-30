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

function createNavigateStubs(overrides = {}) {
  return {
    '../components/feedbackPage': {},
    '../components/supportPage': {},
    axios: {},
    '../service/manifestService': {
      async getManifest() {
        return {
          version: '1.7.35',
          serverUrl: 'https://server.example.com',
          platforms: {
            acme: {
              page: {},
            },
          },
        };
      },
    },
    '../service/platformService': {
      async getPlatformInfo() {
        return {
          platformName: 'acme',
        };
      },
    },
    '../lib/analytics': {
      trackOpenFeedback() {
        throw new Error('feedback tracking should not run for generic navigation');
      },
    },
    '../lib/util': {},
    ...overrides,
  };
}

test('navigate forwards generic widget path and responds to Chrome runtime', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  const responses = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const navigate = await loadBundledModule('src/messageHandlers/navigate.js', {
    stubs: createNavigateStubs(),
  });

  await navigate.onMessage({
    request: {
      path: '/dialer',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/dialer',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      result: 'ok',
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
});

test('navigate registers feedback page with platform feedback config and tracks the open event', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  const responses = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const feedbackPageCalls = [];
  const trackedEvents = [];

  const navigate = await loadBundledModule('src/messageHandlers/navigate.js', {
    stubs: createNavigateStubs({
      '../components/feedbackPage': {
        getFeedbackPageRender(args) {
          feedbackPageCalls.push(args);
          return {
            id: 'feedbackPage',
            title: 'Feedback',
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return {
            version: '1.7.35',
            serverUrl: 'https://server.example.com',
            platforms: {
              acme: {
                page: {
                  feedback: {
                    url: 'https://feedback.example.com/form',
                  },
                },
              },
            },
          };
        },
      },
      '../lib/analytics': {
        trackOpenFeedback() {
          trackedEvents.push('openFeedback');
        },
      },
    }),
  });

  await navigate.onMessage({
    request: {
      path: '/feedback',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(feedbackPageCalls, [
    {
      pageConfig: {
        url: 'https://feedback.example.com/form',
      },
      version: '1.7.35',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'feedbackPage',
          title: 'Feedback',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/feedbackPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(trackedEvents, ['openFeedback']);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('navigate builds support page with server health and RingCentral account context', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  const responses = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const healthCheckUrls = [];
  const supportPageCalls = [];
  const manifest = {
    version: '1.7.35',
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        page: {},
      },
    },
  };

  const navigate = await loadBundledModule('src/messageHandlers/navigate.js', {
    stubs: createNavigateStubs({
      axios: {
        async get(url) {
          healthCheckUrls.push(url);
          return {
            status: 200,
          };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return manifest;
        },
      },
      '../components/supportPage': {
        getSupportPageRender(args) {
          supportPageCalls.push(args);
          return {
            id: 'supportPage',
            online: args.isOnline,
            accountId: args.rcAccountId,
          };
        },
      },
      '../lib/util': {
        async getRcInfo() {
          return {
            value: {
              cachedData: {
                extensionInfo: {
                  account: {
                    id: 'rc-account-1',
                  },
                },
              },
            },
          };
        },
      },
    }),
  });

  await navigate.onMessage({
    request: {
      path: '/support',
    },
    sendResponse(response) {
      responses.push(response);
    },
  });

  assert.deepEqual(healthCheckUrls, ['https://server.example.com/isAlive']);
  assert.deepEqual(supportPageCalls, [
    {
      manifest,
      platformName: 'acme',
      isOnline: true,
      rcAccountId: 'rc-account-1',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'supportPage',
          online: true,
          accountId: 'rc-account-1',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/supportPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('navigate still opens support page when server health and RingCentral info are unavailable', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const supportPageCalls = [];
  const manifest = {
    version: '1.7.35',
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        page: {},
      },
    },
  };

  const navigate = await loadBundledModule('src/messageHandlers/navigate.js', {
    stubs: createNavigateStubs({
      axios: {
        async get() {
          throw new Error('server unavailable');
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return manifest;
        },
      },
      '../components/supportPage': {
        getSupportPageRender(args) {
          supportPageCalls.push(args);
          return {
            id: 'supportPage',
            online: args.isOnline,
            accountId: args.rcAccountId,
          };
        },
      },
      '../lib/util': {
        async getRcInfo() {
          throw new Error('RingCentral info unavailable');
        },
      },
    }),
  });

  await navigate.onMessage({
    request: {
      path: '/support',
    },
    sendResponse() {},
  });

  assert.deepEqual(supportPageCalls, [
    {
      manifest,
      platformName: 'acme',
      isOnline: false,
      rcAccountId: null,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'supportPage',
          online: false,
          accountId: null,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/supportPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
