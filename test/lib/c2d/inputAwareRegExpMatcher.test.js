const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../../helpers/bundledModule.cjs');

function installDomGlobals() {
  global.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
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

class FakeDocumentFragment {}

function createValueNode({ tagName = 'INPUT', value = '', id = '', className = '', hidden = false, disabled = false, type = 'text', rootNode = null } = {}) {
  return {
    nodeType: Node.ELEMENT_NODE,
    tagName,
    value,
    id,
    className,
    hidden,
    disabled,
    type,
    getRootNode() {
      return rootNode ?? null;
    },
  };
}

function createRoot(valueNodes) {
  return {
    nodeType: Node.ELEMENT_NODE,
    tagName: 'DIV',
    querySelectorAll(selector) {
      assert.equal(selector, 'input, textarea, select');
      return valueNodes;
    },
  };
}

async function loadMatcherModule() {
  return loadBundledModule('src/lib/c2d/inputAwareRegExpMatcher.js', {
    stubs: {
      'ringcentral-c2d': {
        RegExpPhoneNumberMatcher: class RegExpPhoneNumberMatcher {
          match() {
            return [];
          }
        },
        extractPhoneNumber(text) {
          return text.match(/\+?\d[\d\s-]{5,}\d/)?.[0] ?? null;
        },
      },
    },
  });
}

test('input-aware matcher returns text matches that are not inside ignored nodes', async () => {
  installDomGlobals();
  global.ShadowRoot = FakeShadowRoot;
  global.DocumentFragment = FakeDocumentFragment;

  const InputAwareRegExpMatcher = (await loadMatcherModule()).default;
  const keptNode = { id: 'kept' };
  const ignoredNode = { id: 'ignored' };
  const textMatcher = {
    match() {
      return [
        {
          startsNode: keptNode,
          endsNode: keptNode,
          context: {
            phoneNumber: '+15550100',
          },
        },
        {
          startsNode: ignoredNode,
          endsNode: ignoredNode,
          context: {
            phoneNumber: '+15550101',
          },
        },
      ];
    },
  };

  const matcher = new InputAwareRegExpMatcher({
    textMatcher,
    isNodeIgnored(node) {
      return node === ignoredNode;
    },
  });

  assert.deepEqual(matcher.match({ node: createRoot([]) }), [
    {
      startsNode: keptNode,
      endsNode: keptNode,
      context: {
        phoneNumber: '+15550100',
      },
    },
  ]);
});

test('input-aware matcher extracts phone numbers from visible form values', async () => {
  installDomGlobals();
  global.ShadowRoot = FakeShadowRoot;
  global.DocumentFragment = FakeDocumentFragment;

  const InputAwareRegExpMatcher = (await loadMatcherModule()).default;
  const firstInput = createValueNode({
    id: 'phone',
    value: 'Primary: +1 555 0100',
  });
  const ignoredInput = createValueNode({
    id: 'ignored',
    value: '+1 555 0101',
  });
  const hiddenInput = createValueNode({
    id: 'hidden',
    value: '+1 555 0102',
    type: 'hidden',
  });

  const matcher = new InputAwareRegExpMatcher({
    textMatcher: {
      match() {
        return [];
      },
    },
    isNodeIgnored(node) {
      return node === ignoredInput;
    },
  });

  assert.deepEqual(matcher.match({ node: createRoot([firstInput, ignoredInput, hiddenInput]) }), [
    {
      startsNode: firstInput,
      endsNode: firstInput,
      startsAt: 9,
      endsAt: 20,
      context: {
        phoneNumber: '+1 555 0100',
      },
    },
  ]);
});

test('input-aware matcher adds a shadow host fallback for phone values inside shadow DOM', async () => {
  installDomGlobals();
  global.ShadowRoot = FakeShadowRoot;
  global.DocumentFragment = FakeDocumentFragment;

  const InputAwareRegExpMatcher = (await loadMatcherModule()).default;
  const shadowHost = {
    tagName: 'CRM-PHONE-FIELD',
    id: 'host',
    className: 'field-host',
  };
  const shadowRoot = new FakeShadowRoot(shadowHost);
  const shadowInput = createValueNode({
    tagName: 'INPUT',
    value: '+15550103',
    rootNode: shadowRoot,
  });

  const matcher = new InputAwareRegExpMatcher({
    textMatcher: {
      match() {
        return [];
      },
    },
  });

  assert.deepEqual(matcher.match({ node: createRoot([shadowInput]) }), [
    {
      startsNode: shadowInput,
      endsNode: shadowInput,
      startsAt: 0,
      endsAt: 9,
      context: {
        phoneNumber: '+15550103',
      },
    },
    {
      startsNode: shadowHost,
      endsNode: shadowHost,
      startsAt: undefined,
      endsAt: undefined,
      context: {
        phoneNumber: '+15550103',
      },
    },
  ]);
});

