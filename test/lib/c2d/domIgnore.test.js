const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../../helpers/bundledModule.cjs');

function installDomGlobals() {
  global.Node = {
    ELEMENT_NODE: 1,
  };
  global.window = {
    localStorage: {
      getItem() {
        return null;
      },
    },
  };
}

class FakeShadowRoot {
  constructor(host) {
    this.host = host;
  }
}

class FakeElement {
  constructor({ className = '', attributes = {}, parentElement = null, rootNode = null } = {}) {
    this.nodeType = Node.ELEMENT_NODE;
    this.className = className;
    this.attributes = attributes;
    this.parentElement = parentElement;
    this.rootNode = rootNode;
  }

  closest(selector) {
    if (selector.includes(',')) {
      return selector
        .split(',')
        .map((part) => part.trim())
        .reduce((matched, part) => matched ?? this.closest(part), null);
    }
    if (selector === '.skip-c2d') {
      return this.className.split(/\s+/).includes('skip-c2d') ? this : null;
    }
    if (selector === '.rc-c2d-ignore') {
      return this.className.split(/\s+/).includes('rc-c2d-ignore') ? this : null;
    }
    if (selector === '[data-rc-c2d-ignore="true"]') {
      return this.attributes['data-rc-c2d-ignore'] === 'true' ? this : null;
    }
    throw new Error(`Unexpected selector: ${selector}`);
  }

  getRootNode() {
    return this.rootNode ?? null;
  }
}

test('C2D ignore predicate honors default and quoted custom selectors', async () => {
  installDomGlobals();
  global.ShadowRoot = FakeShadowRoot;

  const { createC2DNodeIgnorePredicate } = await loadBundledModule('src/lib/c2d/domIgnore.js');
  const isIgnored = createC2DNodeIgnorePredicate('" .skip-c2d "');

  assert.equal(isIgnored(new FakeElement({ attributes: { 'data-rc-c2d-ignore': 'true' } })), true);
  assert.equal(isIgnored(new FakeElement({ className: 'rc-c2d-ignore' })), true);
  assert.equal(isIgnored(new FakeElement({ className: 'skip-c2d' })), true);
  assert.equal(isIgnored(new FakeElement({ className: 'regular-content' })), false);
});

test('C2D ignore predicate walks from shadow DOM content back to its ignored host', async () => {
  installDomGlobals();
  global.ShadowRoot = FakeShadowRoot;

  const { createC2DNodeIgnorePredicate } = await loadBundledModule('src/lib/c2d/domIgnore.js');
  const isIgnored = createC2DNodeIgnorePredicate('.skip-c2d');

  const shadowHost = new FakeElement({ className: 'skip-c2d' });
  const shadowRoot = new FakeShadowRoot(shadowHost);
  const shadowInput = new FakeElement({ rootNode: shadowRoot });

  assert.equal(isIgnored(shadowInput), true);
});


