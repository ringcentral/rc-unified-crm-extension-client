const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('./helpers/bundledModule.cjs');
const { createChromeStorage } = require('./helpers/chromeStorage.cjs');

async function flushAsyncWork() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function installContentEnvironment({ storageValues, url = 'https://crm.example.com/accounts/1' }) {
  const storage = createChromeStorage(storageValues);
  const runtimeListeners = [];
  const runtimeMessages = [];
  const appendedNodes = [];
  const elementsById = new Map();
  const removedLocalStorageKeys = [];

  const locationUrl = new URL(url);
  const document = {
    readyState: 'complete',
    body: {
      nodeName: 'BODY',
    },
    documentElement: {
      appendChild(node) {
        appendedNodes.push(node);
        if (node.id) {
          elementsById.set(node.id, node);
        }
      },
    },
    createElement(tagName) {
      return {
        tagName,
        id: '',
      };
    },
    getElementById(id) {
      return elementsById.get(id) ?? null;
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
    cookie: '',
  };

  const windowObject = {
    document,
    location: {
      href: locationUrl.href,
      hostname: locationUrl.hostname,
      pathname: locationUrl.pathname,
    },
    postMessage() {},
  };
  windowObject.self = windowObject;
  windowObject.top = windowObject;

  global.window = windowObject;
  global.document = document;
  global.localStorage = {
    removeItem(key) {
      removedLocalStorageKeys.push(key);
    },
  };
  global.chrome = {
    storage: storage.chrome.storage,
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        },
      },
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  return {
    storage,
    windowObject,
    document,
    runtimeListeners,
    runtimeMessages,
    appendedNodes,
    removedLocalStorageKeys,
  };
}

function createContentStubs({ renderCalls, c2dInstances, widgets, sentMessages, shadowSupportCalls }) {
  class Widget {
    constructor() {
      this.handlers = {};
      this.updates = [];
      widgets.push(this);
    }

    on(eventName, handler) {
      this.handlers[eventName] = handler;
    }

    update(payload) {
      this.updates.push(payload);
    }
  }

  class RangeObserver {
    constructor(args) {
      this.args = args;
    }
  }

  class LibPhoneNumberMatcher {
    constructor(args) {
      this.args = args;
    }
  }

  class InputAwareRegExpMatcher {
    constructor(args) {
      this.args = args;
    }
  }

  return {
    'ringcentral-c2d': {
      RangeObserver,
      LibPhoneNumberMatcher,
      defaultExclusions: [],
    },
    './components/embedded': function App() {},
    './misc/CustomC2DWidget': Widget,
    react: {
      createElement(type, props, child) {
        return {
          type,
          props,
          child,
        };
      },
    },
    'react-dom': {
      render(element, rootElement) {
        renderCalls.push({ element, rootElement });
      },
    },
    '@ringcentral/juno': {
      RcThemeProvider: function RcThemeProvider() {},
    },
    axios: {},
    './lib/sendMessage': {
      sendMessageToExtension(message) {
        sentMessages.push(message);
      },
    },
    './lib/util': {
      isObjectEmpty(value) {
        return !value || Object.keys(value).length === 0 || Object.values(value).every((item) => typeof item === 'undefined');
      },
    },
    './lib/c2d/inputAwareRegExpMatcher': InputAwareRegExpMatcher,
    './lib/c2d/shadowRootSupport': {
      initializeShadowRootSupport(args) {
        shadowSupportCalls.push(args);
      },
    },
    './lib/c2d/domIgnore': {
      createC2DNodeIgnorePredicate(selector) {
        return (node) => !!selector && node?.matches?.(selector);
      },
    },
    './core/user': {
      getClickToDialEmbedMode(userSettings) {
        return {
          value: userSettings?.clickToDialEmbedMode?.value ?? 'crmOnly',
        };
      },
      getQuickAccessButtonEmbedMode(userSettings) {
        return {
          value: userSettings?.quickAccessButtonEmbedMode?.value ?? 'crmOnly',
        };
      },
      getClickToDialUrls(userSettings) {
        return {
          value: userSettings?.clickToDialUrls?.value ?? [],
        };
      },
      getQuickAccessButtonUrls(userSettings) {
        return {
          value: userSettings?.quickAccessButtonUrls?.value ?? [],
        };
      },
    },
  };
}

test('content script does not inject quick access or C2D when embedding is disabled', async () => {
  const renderCalls = [];
  const c2dInstances = [];
  const widgets = [];
  const sentMessages = [];
  const shadowSupportCalls = [];

  installContentEnvironment({
    storageValues: {
      allowEmbeddingForAllPages: false,
      renderQuickAccessButton: true,
      'platform-info': {
        platformName: 'acme',
        hostname: 'crm.example.com',
      },
      customCrmManifest: {
        platforms: {
          acme: {
            embedUrls: ['https://crm.example.com/*'],
          },
        },
      },
      userSettings: {
        quickAccessButtonEmbedMode: {
          value: 'disabled',
        },
        clickToDialEmbedMode: {
          value: 'disabled',
        },
      },
    },
  });
  global.window.RingCentralC2D = function RingCentralC2D(options) {
    c2dInstances.push(options);
    return {
      widget: options.widget,
      observer: options.observer,
    };
  };

  await loadBundledModule('src/content.js', {
    stubs: createContentStubs({
      renderCalls,
      c2dInstances,
      widgets,
      sentMessages,
      shadowSupportCalls,
    }),
  });
  await flushAsyncWork();

  assert.deepEqual(renderCalls, []);
  assert.deepEqual(c2dInstances, []);
  assert.deepEqual(widgets, []);
  assert.deepEqual(sentMessages, []);
  assert.deepEqual(shadowSupportCalls, []);
});

test('content script injects quick access and wires C2D widget actions on matched CRM pages', async () => {
  const renderCalls = [];
  const c2dInstances = [];
  const widgets = [];
  const sentMessages = [];
  const shadowSupportCalls = [];

  const env = installContentEnvironment({
    storageValues: {
      allowEmbeddingForAllPages: false,
      renderQuickAccessButton: true,
      userPermissions: {
        c2sms: true,
      },
      c2dMatcherType: 'libPhone',
      selectedRegion: 'US',
      'platform-info': {
        platformName: 'acme',
        hostname: 'crm.example.com',
      },
      customCrmManifest: {
        platforms: {
          acme: {
            embedUrls: ['https://crm.example.com/*'],
            c2dIgnoreSelector: '.rc-no-c2d',
          },
        },
      },
      userSettings: {
        quickAccessButtonEmbedMode: {
          value: 'crmOnly',
        },
        clickToDialEmbedMode: {
          value: 'crmOnly',
        },
      },
    },
  });
  global.window.RingCentralC2D = function RingCentralC2D(options) {
    c2dInstances.push(options);
    return {
      widget: options.widget,
      observer: options.observer,
    };
  };

  await loadBundledModule('src/content.js', {
    stubs: createContentStubs({
      renderCalls,
      c2dInstances,
      widgets,
      sentMessages,
      shadowSupportCalls,
    }),
  });
  await flushAsyncWork();

  assert.equal(renderCalls.length, 1);
  assert.equal(renderCalls[0].rootElement.id, 'rc-crm-extension-quick-access-button');
  assert.deepEqual(env.appendedNodes.map((node) => node.id), ['rc-crm-extension-quick-access-button']);
  assert.equal(c2dInstances.length, 1);
  assert.equal(c2dInstances[0].observer.args.node, env.document.body);
  assert.equal(widgets.length, 1);
  assert.deepEqual(widgets[0].updates, [
    {
      enableC2Text: true,
    },
  ]);
  assert.deepEqual(Object.keys(widgets[0].handlers).sort(), ['call', 'schedule', 'text']);
  assert.equal(global.window.clickToDialInstances.length, 1);
  assert.equal(global.window.clickToDialInject.widget, widgets[0]);
  assert.equal(shadowSupportCalls.length, 1);
  assert.equal(shadowSupportCalls[0].sharedWidget, widgets[0]);
  assert.equal(shadowSupportCalls[0].matcherType, 'libPhone');
  assert.equal(shadowSupportCalls[0].selectedRegion, 'US');
  assert.equal(shadowSupportCalls[0].c2dIgnoreSelector, '.rc-no-c2d');

  widgets[0].handlers.call('+15550100');
  widgets[0].handlers.text('+15550101');
  widgets[0].handlers.schedule('+15550102');

  assert.deepEqual(sentMessages, [
    {
      type: 'c2d',
      phoneNumber: '+15550100',
    },
    {
      type: 'c2sms',
      phoneNumber: '+15550101',
    },
    {
      type: 'c2schedule',
      phoneNumber: '+15550102',
    },
  ]);
});

test('content script injects on non-CRM URLs when all-page embedding is allowed', async () => {
  const renderCalls = [];
  const c2dInstances = [];
  const widgets = [];
  const sentMessages = [];
  const shadowSupportCalls = [];

  const env = installContentEnvironment({
    url: 'https://unlisted.example.com/page',
    storageValues: {
      allowEmbeddingForAllPages: true,
      renderQuickAccessButton: true,
      userPermissions: {
        c2sms: false,
      },
      c2dMatcherType: 'regExp',
      selectedRegion: 'GB',
      'platform-info': {
        platformName: 'acme',
        hostname: 'crm.example.com',
      },
      customCrmManifest: {
        platforms: {
          acme: {
            embedUrls: ['https://crm.example.com/*'],
          },
        },
      },
      userSettings: {
        quickAccessButtonEmbedMode: {
          value: 'disabled',
        },
        clickToDialEmbedMode: {
          value: 'disabled',
        },
      },
    },
  });
  global.window.RingCentralC2D = function RingCentralC2D(options) {
    c2dInstances.push(options);
    return {
      widget: options.widget,
      observer: options.observer,
    };
  };

  await loadBundledModule('src/content.js', {
    stubs: createContentStubs({
      renderCalls,
      c2dInstances,
      widgets,
      sentMessages,
      shadowSupportCalls,
    }),
  });
  await flushAsyncWork();

  assert.equal(renderCalls.length, 1);
  assert.equal(renderCalls[0].rootElement.id, 'rc-crm-extension-quick-access-button');
  assert.deepEqual(env.appendedNodes.map((node) => node.id), ['rc-crm-extension-quick-access-button']);
  assert.equal(c2dInstances.length, 1);
  assert.equal(widgets.length, 1);
  assert.deepEqual(widgets[0].updates, [
    {
      enableC2Text: false,
    },
  ]);
  assert.equal(shadowSupportCalls.length, 1);
  assert.equal(shadowSupportCalls[0].matcherType, 'regExp');
  assert.equal(shadowSupportCalls[0].selectedRegion, 'GB');
});

test('content script expands the embedded widget when background requests openAppWindow', async () => {
  const renderCalls = [];
  const c2dInstances = [];
  const widgets = [];
  const sentMessages = [];
  const shadowSupportCalls = [];
  const windowMessages = [];
  const widgetMessages = [];

  const env = installContentEnvironment({
    storageValues: {
      allowEmbeddingForAllPages: false,
      renderQuickAccessButton: false,
      userSettings: {
        clickToDialEmbedMode: {
          value: 'disabled',
        },
      },
    },
  });
  global.window.postMessage = function postMessage(message, targetOrigin) {
    windowMessages.push({ message, targetOrigin });
  };
  env.document.querySelector = function querySelector(selector) {
    assert.equal(selector, '#rc-widget-adapter-frame');
    return {
      contentWindow: {
        postMessage(message, targetOrigin) {
          widgetMessages.push({ message, targetOrigin });
        },
      },
    };
  };
  global.window.RingCentralC2D = function RingCentralC2D(options) {
    c2dInstances.push(options);
    return {
      widget: options.widget,
      observer: options.observer,
    };
  };

  await loadBundledModule('src/content.js', {
    stubs: createContentStubs({
      renderCalls,
      c2dInstances,
      widgets,
      sentMessages,
      shadowSupportCalls,
    }),
  });
  await flushAsyncWork();

  assert.equal(env.runtimeListeners.length, 1);
  const responses = [];
  env.runtimeListeners[0](
    {
      action: 'openAppWindow',
    },
    {},
    (response) => responses.push(response)
  );

  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-adapter-syncMinimized',
        minimized: false,
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-syncMinimized',
        minimized: false,
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, ['ok']);
  assert.deepEqual(env.removedLocalStorageKeys, [
    'rcQuickAccessButtonTransform',
    'rcQuickAccessButtonTop',
  ]);
});

test('content script asks the service worker to open popup on registered CRM pages when auto-open is enabled', async () => {
  const renderCalls = [];
  const c2dInstances = [];
  const widgets = [];
  const sentMessages = [];
  const shadowSupportCalls = [];

  const env = installContentEnvironment({
    storageValues: {
      allowEmbeddingForAllPages: false,
      renderQuickAccessButton: false,
      'platform-info': {
        platformName: 'acme',
        hostname: 'crm.example.com',
      },
      customCrmManifest: {
        platforms: {
          acme: {
            embedUrls: ['https://crm.example.com/*'],
          },
        },
      },
      userSettings: {
        clickToDialEmbedMode: {
          value: 'disabled',
        },
        autoOpenExtension: {
          value: true,
        },
      },
    },
  });
  global.window.RingCentralC2D = function RingCentralC2D(options) {
    c2dInstances.push(options);
    return {
      widget: options.widget,
      observer: options.observer,
    };
  };

  await loadBundledModule('src/content.js', {
    stubs: createContentStubs({
      renderCalls,
      c2dInstances,
      widgets,
      sentMessages,
      shadowSupportCalls,
    }),
  });
  await flushAsyncWork();

  assert.deepEqual(renderCalls, []);
  assert.deepEqual(c2dInstances, []);
  assert.deepEqual(env.runtimeMessages, [
    {
      type: 'openPopupWindow',
    },
  ]);
  assert.deepEqual(env.removedLocalStorageKeys, [
    'rcQuickAccessButtonTransform',
    'rcQuickAccessButtonTop',
  ]);
});

test('content script reports the current URL when Pipedrive callback URI is requested', async () => {
  const renderCalls = [];
  const c2dInstances = [];
  const widgets = [];
  const sentMessages = [];
  const shadowSupportCalls = [];

  const env = installContentEnvironment({
    url: 'https://acme.pipedrive.com/oauth/callback?code=crm-code',
    storageValues: {
      allowEmbeddingForAllPages: false,
      renderQuickAccessButton: false,
      'platform-info': {
        platformName: 'pipedrive',
        hostname: 'acme.pipedrive.com',
      },
      customCrmManifest: {
        platforms: {
          pipedrive: {
            embedUrls: ['https://acme.pipedrive.com/*'],
          },
        },
      },
      userSettings: {
        clickToDialEmbedMode: {
          value: 'disabled',
        },
      },
      c2dDelay: '0',
    },
  });
  global.window.RingCentralC2D = function RingCentralC2D(options) {
    c2dInstances.push(options);
    return {
      widget: options.widget,
      observer: options.observer,
    };
  };

  await loadBundledModule('src/content.js', {
    stubs: createContentStubs({
      renderCalls,
      c2dInstances,
      widgets,
      sentMessages,
      shadowSupportCalls,
    }),
  });
  await flushAsyncWork();

  assert.equal(env.runtimeListeners.length, 1);
  const responses = [];
  env.runtimeListeners[0](
    {
      action: 'needCallbackUri',
    },
    {},
    (response) => responses.push(response)
  );

  assert.deepEqual(sentMessages, [
    {
      type: 'pipedriveCallbackUri',
      callbackUri: 'https://acme.pipedrive.com/oauth/callback?code=crm-code',
    },
  ]);
  assert.deepEqual(responses, ['ok']);
});
