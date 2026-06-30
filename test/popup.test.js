const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('./helpers/bundledModule.cjs');
const { createChromeStorage } = require('./helpers/chromeStorage.cjs');

function createHandler(overrides = {}) {
  return {
    async onEvent() {},
    async onMessage() {},
    ...overrides,
  };
}

async function loadPopup(overrides = {}) {
  const storage = createChromeStorage(overrides.storage ?? {});
  const windowMessages = [];
  const widgetMessages = [];
  const notifications = [];
  const windowMessageListeners = [];
  const runtimeMessageListeners = [];
  const storageChangeListeners = [];
  const requestInterceptors = [];
  const responseInterceptors = [];
  const authClearLocalCrmAuthStateCalls = [];
  const authSyncCalls = [];
  const handledApiErrors = [];
  const logActions = [];

  global.window = {
    location: {
      origin: 'chrome-extension://popup',
    },
    addEventListener(type, listener) {
      if (type === 'message') {
        windowMessageListeners.push(listener);
      }
    },
    postMessage(message, target) {
      windowMessages.push({ message, target });
    },
  };
  global.document = {
    querySelector(selector) {
      assert.equal(selector, '#rc-widget-adapter-frame');
      return {
        contentWindow: {
          postMessage(message, target) {
            widgetMessages.push({ message, target });
          },
        },
      };
    },
  };
  global.chrome = {
    storage: {
      local: storage.chrome.storage.local,
      onChanged: {
        addListener(listener) {
          storageChangeListeners.push(listener);
        },
      },
    },
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeMessageListeners.push(listener);
        },
      },
    },
  };

  const axiosStub = {
    defaults: {},
    interceptors: {
      request: {
        use(fulfilled, rejected) {
          requestInterceptors.push({ fulfilled, rejected });
        },
      },
      response: {
        use(fulfilled, rejected) {
          responseInterceptors.push({ fulfilled, rejected });
        },
      },
    },
    async get() {
      return {
        data: null,
      };
    },
  };

  const defaultEventHandler = createHandler();
  await loadBundledModule('src/popup.js', {
    stubs: {
      './lib/util': {
        async checkC2DCollision() {},
        showNotification(notification) {
          notifications.push(notification);
        },
      },
      './lib/analytics': {
        setAuthor() {},
      },
      axios: axiosStub,
      './core/auth': {
        async syncCrmAuthedFromStorage() {
          authSyncCalls.push(true);
        },
        async clearLocalCrmAuthState() {
          authClearLocalCrmAuthStateCalls.push(true);
        },
      },
      './lib/apiErrorHandler': {
        registerCrmAuthCacheClearedHandler() {},
        async handleApiError(error) {
          handledApiErrors.push(error);
        },
      },
      './service/embeddableServices': {
        async getServiceManifest() {
          return overrides.serviceManifest ?? {};
        },
      },
      './service/manifestService': {
        async getManifest() {
          return null;
        },
        async saveManifestUrl() {},
      },
      './service/platformService': {
        async getPlatformInfo() {
          return null;
        },
      },
      './lib/logRecorder': {
        async isRecordingLogs() {
          return overrides.isRecordingLogs ?? false;
        },
        logAction(action) {
          logActions.push(action);
        },
      },
      './i18n': {
        restoreLocale() {},
      },
      './eventHandlers/rc-telephony-session-notify': defaultEventHandler,
      './eventHandlers/rc-calling-settings-notify': defaultEventHandler,
      './eventHandlers/rc-region-settings-notify': defaultEventHandler,
      './eventHandlers/rc-adapter-side-drawer-open-notify': defaultEventHandler,
      './eventHandlers/rc-dialer-status-notify': defaultEventHandler,
      './eventHandlers/rc-webphone-connection-status-notify': defaultEventHandler,
      './eventHandlers/rc-adapter-pushAdapterState': defaultEventHandler,
      './eventHandlers/rc-login-status-notify': defaultEventHandler,
      './eventHandlers/rc-login-popup-notify': defaultEventHandler,
      './eventHandlers/rc-call-init-notify': defaultEventHandler,
      './eventHandlers/rc-call-start-notify': defaultEventHandler,
      './eventHandlers/rc-ringout-call-notify': defaultEventHandler,
      './eventHandlers/rc-active-call-notify': defaultEventHandler,
      './eventHandlers/rc-analytics-track': defaultEventHandler,
      './eventHandlers/rc-callLogger-auto-log-notify': defaultEventHandler,
      './eventHandlers/rc-messageLogger-auto-log-notify': defaultEventHandler,
      './eventHandlers/rc-route-changed-notify': defaultEventHandler,
      './eventHandlers/rc-adapter-ai-assistant-settings-notify': defaultEventHandler,
      './eventHandlers/rc-post-message-request': overrides.postMessageRequestHandler ?? defaultEventHandler,
      './eventHandlers/rc-adapter-phone-number-format-settings-notify': defaultEventHandler,
      './messageHandlers/oauthCallBack': defaultEventHandler,
      './messageHandlers/pipedriveCallbackUri': defaultEventHandler,
      './messageHandlers/c2sms': defaultEventHandler,
      './messageHandlers/c2d': overrides.c2dHandler ?? defaultEventHandler,
      './messageHandlers/c2schedule': defaultEventHandler,
      './messageHandlers/navigate': defaultEventHandler,
      './messageHandlers/insightlyAuth': defaultEventHandler,
      './messageHandlers/ringsenseRefTrack': defaultEventHandler,
      './messageHandlers/controlCall': defaultEventHandler,
    },
  });

  return {
    authClearLocalCrmAuthStateCalls,
    authSyncCalls,
    handledApiErrors,
    logActions,
    notifications,
    requestInterceptors,
    responseInterceptors,
    runtimeMessageListeners,
    storage,
    storageChangeListeners,
    widgetMessages,
    windowMessageListeners,
    windowMessages,
  };
}

test('popup routes widget postMessage requests through the request router and records non-noisy requests', async () => {
  const handledEvents = [];
  const normalRequest = {
    type: 'rc-post-message-request',
    path: '/settings',
    requestId: 'request-1',
    body: {
      section: 'general',
    },
  };
  const noisyInputRequest = {
    type: 'rc-post-message-request',
    path: '/callLogger/inputChanged',
    requestId: 'request-2',
  };
  const popup = await loadPopup({
    isRecordingLogs: true,
    postMessageRequestHandler: createHandler({
      async onEvent(event) {
        handledEvents.push(event);
      },
    }),
  });

  assert.equal(popup.windowMessageListeners.length, 1);
  await popup.windowMessageListeners[0]({ data: normalRequest });
  await popup.windowMessageListeners[0]({ data: noisyInputRequest });

  assert.deepEqual(handledEvents.map((event) => event.data), [
    normalRequest,
    noisyInputRequest,
  ]);
  assert.deepEqual(popup.logActions, [
    {
      name: 'rc-post-message-request',
      data: normalRequest,
    },
  ]);
});

test('popup re-registers the service manifest when CRM auth storage changes', async () => {
  const serviceManifest = {
    name: 'Acme CRM',
    permissions: ['ReadCallLog'],
  };
  const popup = await loadPopup({ serviceManifest });

  assert.equal(popup.storageChangeListeners.length, 1);
  assert.equal(popup.authSyncCalls.length, 1);
  await popup.storageChangeListeners[0]({
    rcUnifiedCrmExtJwt: {
      oldValue: null,
      newValue: 'crm-jwt',
    },
  }, 'local');

  assert.equal(popup.authSyncCalls.length, 2);
  assert.deepEqual(popup.widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: serviceManifest,
      },
      target: '*',
    },
  ]);
});
test('popup closes loading state and does not ack ok when a runtime message handler fails', async () => {
  const responses = [];
  const popup = await loadPopup({
    c2dHandler: createHandler({
      async onMessage() {
        throw new Error('runtime handler failed');
      },
    }),
  });

  assert.equal(popup.runtimeMessageListeners.length, 1);
  await popup.runtimeMessageListeners[0](
    {
      type: 'c2d',
      phoneNumber: '+15550100',
    },
    {},
    (response) => responses.push(response)
  );

  assert.deepEqual(popup.windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      target: '*',
    },
  ]);
  assert.deepEqual(responses, []);
});
test('popup recovers from timeout message handler failures by closing loading state and warning the user', async () => {
  const popup = await loadPopup({
    postMessageRequestHandler: createHandler({
      async onEvent() {
        throw new Error('request timeout after 30000ms');
      },
    }),
  });

  assert.equal(popup.windowMessageListeners.length, 1);
  await popup.windowMessageListeners[0]({
    data: {
      type: 'rc-post-message-request',
      path: '/contacts',
    },
  });

  assert.deepEqual(popup.windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      target: '*',
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      target: '*',
    },
  ]);
  assert.deepEqual(popup.notifications, [
    {
      level: 'warning',
      message: 'Timeout',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(popup.widgetMessages, []);
});

test('popup recovers from CRM authorization failures by closing loading state and navigating to settings', async () => {
  const popup = await loadPopup({
    postMessageRequestHandler: createHandler({
      async onEvent() {
        const error = new Error('unauthorized');
        error.response = {
          status: 401,
          data: {
            returnMessage: 'CRM authorization expired',
          },
        };
        throw error;
      },
    }),
  });

  assert.equal(popup.windowMessageListeners.length, 1);
  await popup.windowMessageListeners[0]({
    data: {
      type: 'rc-post-message-request',
      path: '/callLogger',
    },
  });

  assert.deepEqual(popup.windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      target: '*',
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      target: '*',
    },
  ]);
  assert.deepEqual(popup.notifications, ['CRM authorization expired']);
  assert.deepEqual(popup.widgetMessages, [
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/settings',
      },
      target: '*',
    },
  ]);
});

test('popup request interceptor strips jwtToken from URLs and applies it as bearer authorization', async () => {
  const popup = await loadPopup({
    storage: {
      rcUnifiedCrmExtJwt: 'stored-token',
    },
  });

  assert.equal(popup.requestInterceptors.length, 1);
  const interceptedConfig = await popup.requestInterceptors[0].fulfilled({
    method: 'get',
    url: '/crm/contacts?jwtToken=url-token&search=Ada',
    headers: {},
  });

  assert.equal(interceptedConfig.url, '/crm/contacts?search=Ada');
  assert.deepEqual(interceptedConfig.headers, {
    Authorization: 'Bearer url-token',
  });
});
test('popup response interceptor persists refreshed CRM JWT from successful responses', async () => {
  const popup = await loadPopup({
    storage: {
      rcUnifiedCrmExtJwt: 'old-token',
    },
  });

  assert.equal(popup.responseInterceptors.length, 1);
  const response = {
    headers: {
      'X-Refreshed-Jwt-Token': 'new-token',
    },
    config: {
      url: '/crm/contacts',
    },
    status: 200,
    statusText: 'OK',
    data: {
      ok: true,
    },
  };

  const returnedResponse = await popup.responseInterceptors[0].fulfilled(response);

  assert.equal(returnedResponse, response);
  assert.equal(popup.storage.store.rcUnifiedCrmExtJwt, 'new-token');
});

test('popup response interceptor handles 401 API errors, persists refreshed JWT, and clears CRM auth cache', async () => {
  const popup = await loadPopup({
    storage: {
      rcUnifiedCrmExtJwt: 'old-token',
    },
  });

  const error = new Error('Request failed with status code 401');
  error.response = {
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'x-refreshed-jwt-token': 'error-token',
    },
    data: {
      returnMessage: 'Unauthorized',
    },
  };
  error.config = {
    url: '/crm/contacts',
    headers: {
      Authorization: 'Bearer old-token',
    },
  };

  await assert.rejects(
    async () => popup.responseInterceptors[0].rejected(error),
    error
  );

  assert.equal(popup.storage.store.rcUnifiedCrmExtJwt, 'error-token');
  assert.deepEqual(popup.handledApiErrors, [error]);
  assert.deepEqual(popup.authClearLocalCrmAuthStateCalls, [true]);
});
test('popup request interceptor uses stored CRM JWT without overriding explicit authorization or skipAuthorization', async () => {
  const popup = await loadPopup({
    storage: {
      rcUnifiedCrmExtJwt: 'stored-token',
    },
  });
  const requestInterceptor = popup.requestInterceptors[0].fulfilled;

  const storedTokenConfig = await requestInterceptor({
    method: 'post',
    url: '/crm/accounts',
  });
  const explicitAuthorizationConfig = await requestInterceptor({
    method: 'get',
    url: '/crm/accounts',
    headers: {
      authorization: 'Bearer explicit-token',
    },
  });
  const skippedAuthorizationConfig = await requestInterceptor({
    method: 'get',
    url: '/crm/public',
    skipAuthorization: true,
  });

  assert.deepEqual(storedTokenConfig.headers, {
    Authorization: 'Bearer stored-token',
  });
  assert.deepEqual(explicitAuthorizationConfig.headers, {
    authorization: 'Bearer explicit-token',
  });
  assert.equal(skippedAuthorizationConfig.headers, undefined);
});

test('popup response interceptor does not clear CRM auth cache for unAuthorize or skipAuthorization 401 responses', async () => {
  const popup = await loadPopup();

  const unAuthorizeError = new Error('unauthorize failed');
  unAuthorizeError.response = {
    status: 401,
    headers: {},
    data: {},
  };
  unAuthorizeError.config = {
    url: '/unAuthorize',
    headers: {
      Authorization: 'Bearer old-token',
    },
  };

  const skippedAuthError = new Error('skip authorization failed');
  skippedAuthError.response = {
    status: 401,
    headers: {},
    data: {},
  };
  skippedAuthError.config = {
    url: '/crm/public',
    skipAuthorization: true,
    headers: {
      Authorization: 'Bearer old-token',
    },
  };

  await assert.rejects(
    async () => popup.responseInterceptors[0].rejected(unAuthorizeError),
    unAuthorizeError
  );
  await assert.rejects(
    async () => popup.responseInterceptors[0].rejected(skippedAuthError),
    skippedAuthError
  );

  assert.deepEqual(popup.handledApiErrors, [unAuthorizeError, skippedAuthError]);
  assert.deepEqual(popup.authClearLocalCrmAuthStateCalls, []);
});