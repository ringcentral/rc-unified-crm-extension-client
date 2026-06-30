const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('./helpers/bundledModule.cjs');
const { createChromeStorage } = require('./helpers/chromeStorage.cjs');

function createChromeEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function createServiceWorkerChromeMock(initialStorage = {}) {
  const storage = createChromeStorage(initialStorage);
  const runtimeMessages = [];
  const windowsCreated = [];
  const windowsUpdated = [];
  const windowsById = new Map();

  const chrome = {
    ...storage.chrome,
    action: {
      onClicked: createChromeEvent(),
    },
    runtime: {
      onMessage: createChromeEvent(),
      onMessageExternal: createChromeEvent(),
      getURL(path) {
        return `chrome-extension://app-connect/${path}`;
      },
      async sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
    windows: {
      onFocusChanged: createChromeEvent(),
      onRemoved: createChromeEvent(),
      onBoundsChanged: createChromeEvent(),
      async get(windowId) {
        const window = windowsById.get(windowId);
        if (!window) {
          throw new Error(`Window not found: ${windowId}`);
        }
        return window;
      },
      async update(windowId, updateInfo) {
        windowsUpdated.push({ windowId, updateInfo });
        const existingWindow = windowsById.get(windowId) || { id: windowId };
        windowsById.set(windowId, { ...existingWindow, ...updateInfo });
        return windowsById.get(windowId);
      },
      async create(createInfo) {
        const id = 9000 + windowsCreated.length;
        const window = { id, ...createInfo };
        windowsCreated.push(createInfo);
        windowsById.set(id, window);
        return window;
      },
      async remove(windowId) {
        windowsById.delete(windowId);
      },
    },
    notifications: {
      onClicked: createChromeEvent(),
      onButtonClicked: createChromeEvent(),
      create(notificationId, options, callback) {
        callback(notificationId);
      },
      clear(notificationId, callback) {
        callback(true);
      },
      getAll(callback) {
        callback({});
      },
    },
    alarms: {
      onAlarm: createChromeEvent(),
      create() {},
    },
    tabs: {
      onUpdated: createChromeEvent(),
      async query() {
        return [];
      },
      sendMessage() {},
    },
  };

  return {
    chrome,
    store: storage.store,
    runtimeMessages,
    windowsById,
    windowsCreated,
    windowsUpdated,
  };
}

test('service worker focuses existing popup instead of creating a duplicate window', async () => {
  const mock = createServiceWorkerChromeMock({
    popupWindowId: 88,
  });
  mock.windowsById.set(88, {
    id: 88,
    state: 'normal',
    focused: false,
  });
  global.chrome = mock.chrome;

  await loadBundledModule('src/sw.js', {
    stubs: {
      './lib/util': {
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
      },
    },
  });

  const responses = [];
  const onMessage = mock.chrome.runtime.onMessage.listeners[0];
  onMessage(
    {
      type: 'openPopupWindow',
    },
    {},
    (response) => {
      responses.push(response);
    }
  );

  await flushAsyncWork();

  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
  assert.deepEqual(mock.windowsUpdated, [
    {
      windowId: 88,
      updateInfo: {
        focused: true,
      },
    },
  ]);
  assert.deepEqual(mock.windowsCreated, []);
  assert.equal(mock.store.popupWindowId, 88);
});

test('service worker caches click-to-dial intent on cold start and opens popup window', async () => {
  const originalDateNow = Date.now;
  Date.now = () => 1234567890;
  try {
    const mock = createServiceWorkerChromeMock({
      customCrmManifest: {
        platforms: {
          acme: {
            auth: {
              oauth: {
                redirectUri: 'https://crm.example.com/oauth/callback',
              },
            },
          },
        },
      },
      'platform-info': {
        platformName: 'acme',
      },
    });
    global.chrome = mock.chrome;

    await loadBundledModule('src/sw.js', {
      stubs: {
        './lib/util': {
          isObjectEmpty(value) {
            return !value || Object.keys(value).length === 0;
          },
        },
      },
    });

    const onMessage = mock.chrome.runtime.onMessage.listeners[0];
    const responses = [];
    onMessage(
      {
        type: 'c2d',
        phoneNumber: '+15550100',
      },
      {},
      (response) => responses.push(response)
    );

    await flushAsyncWork();

    assert.deepEqual(responses, [
      {
        result: 'ok',
      },
    ]);
    assert.equal(mock.windowsCreated.length, 1);
    assert.equal(mock.windowsCreated[0].type, 'popup');
    assert.equal(mock.windowsCreated[0].focused, true);
    assert.match(mock.windowsCreated[0].url, /popup\.html\?/);
    assert.match(mock.windowsCreated[0].url, /redirectUri=https:\/\/crm\.example\.com\/oauth\/callback/);
    assert.equal(mock.store.popupWindowId, 9000);
    assert.deepEqual(mock.runtimeMessages, []);

    const cacheResponses = [];
    onMessage(
      {
        type: 'checkForClickToXCache',
      },
      {},
      (response) => cacheResponses.push(response)
    );

    assert.deepEqual(cacheResponses, [
      {
        type: 'c2d',
        phoneNumber: '+15550100',
        at: 1234567890,
      },
    ]);
  } finally {
    Date.now = originalDateNow;
  }
});

test('service worker forwards click-to-SMS intent to an existing popup and restores minimized window', async () => {
  const mock = createServiceWorkerChromeMock({
    popupWindowId: 88,
  });
  mock.windowsById.set(88, {
    id: 88,
    state: 'minimized',
    focused: false,
  });
  global.chrome = mock.chrome;

  await loadBundledModule('src/sw.js', {
    stubs: {
      './lib/util': {
        isObjectEmpty(value) {
          return !value || Object.keys(value).length === 0;
        },
      },
    },
  });

  const responses = [];
  const onMessage = mock.chrome.runtime.onMessage.listeners[0];
  onMessage(
    {
      type: 'c2sms',
      phoneNumber: '+15550101',
    },
    {},
    (response) => responses.push(response)
  );

  await flushAsyncWork();

  assert.deepEqual(responses, [
    {
      result: 'ok',
    },
  ]);
  assert.deepEqual(mock.windowsUpdated, [
    {
      windowId: 88,
      updateInfo: {
        state: 'normal',
      },
    },
    {
      windowId: 88,
      updateInfo: {
        focused: true,
      },
    },
  ]);
  assert.deepEqual(mock.windowsCreated, []);
  assert.deepEqual(mock.runtimeMessages, [
    {
      type: 'c2sms',
      phoneNumber: '+15550101',
    },
  ]);
});

test('service worker completes RingCentral OAuth window callback from alarm polling', async () => {
  const originalDateNow = Date.now;
  Date.now = () => 2000;
  try {
    const mock = createServiceWorkerChromeMock();
    const alarmsCreated = [];
    const tabsQueried = [];
    mock.chrome.alarms.create = (name, info) => {
      alarmsCreated.push({ name, info });
    };
    mock.chrome.tabs.query = async (query) => {
      tabsQueried.push(query);
      return [
        {
          url: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html?code=rc-code',
        },
      ];
    };
    global.chrome = mock.chrome;

    await loadBundledModule('src/sw.js', {
      stubs: {
        './lib/util': {
          isObjectEmpty(value) {
            return !value || Object.keys(value).length === 0;
          },
        },
      },
    });

    const responses = [];
    const onMessage = mock.chrome.runtime.onMessage.listeners[0];
    onMessage(
      {
        type: 'openRCOAuthWindow',
        oAuthUri: 'https://login.example.com/oauth/authorize',
      },
      {},
      (response) => responses.push(response)
    );

    await flushAsyncWork();

    assert.deepEqual(responses, [
      {
        result: 'ok',
      },
    ]);
    assert.deepEqual(mock.windowsCreated, [
      {
        url: 'https://login.example.com/oauth/authorize',
        type: 'popup',
        width: 600,
        height: 600,
      },
    ]);
    assert.deepEqual(mock.store.loginWindowInfo, {
      platform: 'rc',
      id: 9000,
    });
    assert.deepEqual(alarmsCreated, [
      {
        name: 'oauthCheck',
        info: {
          when: 5000,
        },
      },
    ]);

    await mock.chrome.alarms.onAlarm.listeners[0]();

    assert.deepEqual(tabsQueried, [
      {
        windowId: 9000,
      },
    ]);
    assert.deepEqual(mock.runtimeMessages, [
      {
        type: 'oauthCallBack',
        platform: 'rc',
        callbackUri: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html?code=rc-code',
      },
    ]);
    assert.equal(mock.windowsById.has(9000), false);
    assert.equal(mock.store.loginWindowInfo, undefined);
  } finally {
    Date.now = originalDateNow;
  }
});

test('service worker shows one incoming call notification while focusing an unfocused popup', async () => {
  const originalDateNow = Date.now;
  Date.now = () => 10000;
  try {
    const mock = createServiceWorkerChromeMock({
      popupWindowId: 88,
    });
    mock.windowsById.set(88, {
      id: 88,
      state: 'minimized',
      focused: false,
    });
    const notificationsCreated = [];
    mock.chrome.notifications.create = (notificationId, options, callback) => {
      notificationsCreated.push({ notificationId, options });
      callback(notificationId);
    };
    global.chrome = mock.chrome;

    await loadBundledModule('src/sw.js', {
      stubs: {
        './lib/util': {
          isObjectEmpty(value) {
            return !value || Object.keys(value).length === 0;
          },
        },
      },
    });

    const onMessage = mock.chrome.runtime.onMessage.listeners[0];
    const firstResponse = await new Promise((resolve) => {
      onMessage(
        {
          type: 'incomingCallRinging',
          callId: 'call-1',
          callerName: 'Ada Lovelace',
          phoneNumber: '+15550100',
        },
        {},
        resolve
      );
    });

    mock.windowsById.set(88, {
      id: 88,
      state: 'normal',
      focused: false,
    });
    const secondResponse = await new Promise((resolve) => {
      onMessage(
        {
          type: 'incomingCallRinging',
          callId: 'call-1',
          callerName: 'Ada Lovelace',
          phoneNumber: '+15550100',
        },
        {},
        resolve
      );
    });

    assert.deepEqual([firstResponse, secondResponse], [
      {
        result: 'ok',
      },
      {
        result: 'ok',
      },
    ]);
    assert.deepEqual(notificationsCreated, [
      {
        notificationId: 'incoming-call-call-1',
        options: {
          type: 'basic',
          iconUrl: 'chrome-extension://app-connect/images/logo128.png',
          title: 'Incoming call',
          message: 'Call from Ada Lovelace',
          buttons: [
            {
              title: 'Answer',
            },
            {
              title: 'Ignore',
            },
          ],
          isClickable: true,
          priority: 2,
          requireInteraction: true,
        },
      },
    ]);
    assert.deepEqual(mock.windowsUpdated, [
      {
        windowId: 88,
        updateInfo: {
          focused: true,
          state: 'normal',
        },
      },
      {
        windowId: 88,
        updateInfo: {
          drawAttention: true,
        },
      },
      {
        windowId: 88,
        updateInfo: {
          focused: true,
        },
      },
      {
        windowId: 88,
        updateInfo: {
          drawAttention: true,
        },
      },
    ]);
    assert.deepEqual(mock.store.recentIncomingCallNotificationIds, {
      'call-1': 310000,
    });
  } finally {
    Date.now = originalDateNow;
  }
});
