const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../../helpers/bundledModule.cjs');

class FakeShadowRoot {
  constructor(host = null) {
    this.host = host;
  }

  querySelectorAll() {
    return [];
  }
}

class FakeElement {
  constructor({ tagName = 'DIV', shadowRoot = null, value = '', type = 'text', hidden = false, disabled = false } = {}) {
    this.nodeType = global.Node?.ELEMENT_NODE ?? 1;
    this.tagName = tagName;
    this.shadowRoot = shadowRoot;
    this.value = value;
    this.type = type;
    this.hidden = hidden;
    this.disabled = disabled;
    this.isConnected = true;
    this.attributes = {};
    if (shadowRoot) {
      shadowRoot.host = this;
    }
  }

  matches(selector) {
    if (selector === 'input, textarea, select') {
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName);
    }
    return false;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  attachShadow() {
    this.shadowRoot = new FakeShadowRoot(this);
    return this.shadowRoot;
  }
}

function installShadowDomEnvironment({ taggedHosts = [] } = {}) {
  const listeners = {};
  const observed = [];
  const intervals = [];
  const clearedIntervals = [];

  global.Node = {
    ELEMENT_NODE: 1,
  };
  global.NodeFilter = {
    SHOW_ELEMENT: 1,
  };
  global.ShadowRoot = FakeShadowRoot;
  global.Element = FakeElement;
  global.MutationObserver = class MutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe(root, options) {
      observed.push({ observer: this, root, options });
    }
  };

  const body = new FakeElement({ tagName: 'BODY' });
  body.querySelectorAll = (selector) => {
    assert.equal(selector, '[data-rc-shadow-host]');
    return taggedHosts;
  };

  global.document = {
    body,
    addEventListener(eventName, listener, useCapture) {
      listeners[eventName] = {
        listener,
        useCapture,
      };
    },
    createTreeWalker() {
      return {
        currentNode: null,
        nextNode() {
          return null;
        },
      };
    },
  };

  global.window = {
    __rcC2dAttachShadowPatched: false,
    setInterval(callback, delay) {
      const intervalId = `interval-${intervals.length + 1}`;
      intervals.push({ intervalId, callback, delay });
      return intervalId;
    },
    clearInterval(intervalId) {
      clearedIntervals.push(intervalId);
    },
  };

  return {
    body,
    listeners,
    observed,
    intervals,
    clearedIntervals,
  };
}

async function loadShadowRootSupport() {
  return loadBundledModule('src/lib/c2d/shadowRootSupport.js');
}

test('shadow root support initializes existing tagged shadow roots and observes them', async () => {
  const existingShadowRoot = new FakeShadowRoot();
  const taggedHost = new FakeElement({
    shadowRoot: existingShadowRoot,
  });
  const env = installShadowDomEnvironment({
    taggedHosts: [taggedHost],
  });

  const { initializeShadowRootSupport } = await loadShadowRootSupport();
  const createCalls = [];
  const instances = [];
  const observers = [];
  const pollerStore = [];

  initializeShadowRootSupport({
    createC2DInstance(args) {
      createCalls.push(args);
      return {
        id: `instance-${createCalls.length}`,
      };
    },
    sharedWidget: {
      id: 'shared-widget',
    },
    matcherType: 'libPhone',
    selectedRegion: 'US',
    c2dIgnoreSelector: '.skip-c2d',
    onInstanceCreated(instance) {
      instances.push(instance);
    },
    onObserverCreated(observer) {
      observers.push(observer);
    },
    pollerStore,
  });

  assert.deepEqual(createCalls, [
    {
      rootNode: existingShadowRoot,
      sharedWidget: {
        id: 'shared-widget',
      },
      matcherType: 'libPhone',
      selectedRegion: 'US',
      c2dIgnoreSelector: '.skip-c2d',
    },
  ]);
  assert.deepEqual(instances, [
    {
      id: 'instance-1',
    },
  ]);
  assert.equal(observers.length, 2);
  assert.deepEqual(env.observed.map(({ root }) => root), [existingShadowRoot, env.body]);
  assert.deepEqual(Object.keys(env.listeners).sort(), ['change', 'focusin', 'input', 'rc-shadow-attached']);
  assert.equal(global.window.__rcC2dAttachShadowPatched, true);
  assert.deepEqual(pollerStore, []);
});

test('shadow root support handles attached shadow roots and probes phone values in form fields', async () => {
  const env = installShadowDomEnvironment();
  const { initializeShadowRootSupport } = await loadShadowRootSupport();
  const createCalls = [];
  const instances = [];
  const pollerStore = [];
  const originalDateNow = Date.now;
  let now = 1000;
  Date.now = () => now;

  try {
    initializeShadowRootSupport({
      createC2DInstance(args) {
        createCalls.push(args);
        return {
          id: `instance-${createCalls.length}`,
        };
      },
      sharedWidget: {
        id: 'shared-widget',
      },
      matcherType: 'regExp',
      selectedRegion: 'GB',
      c2dIgnoreSelector: '',
      onInstanceCreated(instance) {
        instances.push(instance);
      },
      onObserverCreated() {},
      pollerStore,
    });

    const host = new FakeElement({
      shadowRoot: new FakeShadowRoot(),
    });
    env.listeners['rc-shadow-attached'].listener({
      target: host,
    });

    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].rootNode, host.shadowRoot);
    assert.deepEqual(instances, [
      {
        id: 'instance-1',
      },
    ]);

    const valueInput = new FakeElement({
      tagName: 'INPUT',
      value: '+1 555 0100',
    });
    env.listeners.focusin.listener({
      composedPath() {
        return [valueInput];
      },
    });
    assert.equal(valueInput.attributes['data-rc-c2d-probe'], '1000');

    env.listeners.input.listener({
      target: valueInput,
    });
    assert.equal(valueInput.attributes['data-rc-c2d-probe'], '1000');

    now = 1301;
    env.listeners.change.listener({
      target: valueInput,
    });
    assert.equal(valueInput.attributes['data-rc-c2d-probe'], '1301');
  } finally {
    Date.now = originalDateNow;
  }
});

