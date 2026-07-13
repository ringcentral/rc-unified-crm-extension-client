vi.mock('ringcentral-c2d', () => ({
  RegExpPhoneNumberMatcher: class RegExpPhoneNumberMatcher {
    match() {
      return [];
    }
  },
  extractPhoneNumber(value) {
    return String(value).match(/\+?\d[\d\s()+-]{5,}\d/)?.[0]?.trim() ?? null;
  },
}));

import InputAwareRegExpMatcher from '../../../src/lib/c2d/inputAwareRegExpMatcher.ts';

describe('InputAwareRegExpMatcher', () => {
  afterEach(() => {
    window.localStorage.removeItem('rcC2DDebug');
    vi.restoreAllMocks();
  });

  it('keeps text matcher results unless either boundary node is ignored', () => {
    const keptNode = document.createTextNode('+16505550100');
    const ignoredNode = document.createTextNode('+16505550101');
    const textMatcher = {
      match: vi.fn(() => [
        {
          startsNode: keptNode,
          endsNode: keptNode,
          context: { phoneNumber: '+16505550100' },
        },
        {
          startsNode: ignoredNode,
          endsNode: ignoredNode,
          context: { phoneNumber: '+16505550101' },
        },
      ]),
    };

    const matcher = new InputAwareRegExpMatcher({
      textMatcher,
      isNodeIgnored: (node) => node === ignoredNode,
    });

    expect(matcher.match({ node: document.body })).toEqual([
      {
        startsNode: keptNode,
        endsNode: keptNode,
        context: { phoneNumber: '+16505550100' },
      },
    ]);
  });

  it('finds phone numbers in visible input, textarea, and select values', () => {
    document.body.innerHTML = `
      <input id="phone-input" value="+1 650 555 0100" />
      <textarea id="phone-textarea">+1 650 555 0101</textarea>
      <select id="phone-select">
        <option selected value="+1 650 555 0102">Phone</option>
      </select>
    `;
    document.querySelector<HTMLTextAreaElement>('#phone-textarea').value = '+1 650 555 0101';
    document.querySelector<HTMLSelectElement>('#phone-select').value = '+1 650 555 0102';

    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
    });

    const phoneNumbers = matcher.match({ node: document.body }).map((match) => match.context.phoneNumber);

    expect(phoneNumbers).toEqual([
      '+1 650 555 0100',
      '+1 650 555 0101',
      '+1 650 555 0102',
    ]);
  });

  it('skips hidden, disabled, and ignored value nodes', () => {
    document.body.innerHTML = `
      <input id="hidden-input" type="hidden" value="+1 650 555 0100" />
      <input id="disabled-input" disabled value="+1 650 555 0101" />
      <input id="ignored-input" value="+1 650 555 0102" />
      <input id="kept-input" value="+1 650 555 0103" />
    `;
    const ignoredInput = document.querySelector('#ignored-input');
    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
      isNodeIgnored: (node) => node === ignoredInput,
    });

    const phoneNumbers = matcher.match({ node: document.body }).map((match) => match.context.phoneNumber);

    expect(phoneNumbers).toEqual(['+1 650 555 0103']);
  });

  it('does not duplicate matches for the same value node and phone number', () => {
    document.body.innerHTML = `
      <input id="phone-input" value="+1 650 555 0100 +1 650 555 0100" />
    `;

    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
    });

    expect(matcher.match({ node: document.body })).toHaveLength(1);
  });

  it('adds a shadow host fallback match for value nodes inside shadow DOM', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.value = '+1 650 555 0100';
    shadowRoot.appendChild(input);

    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
    });

    const matches = matcher.match({ node: shadowRoot });

    expect(matches.map((match) => match.startsNode)).toEqual([input, host]);
  });

  it('handles undefined text matches and empty value-node searches', () => {
    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => undefined) },
    });

    expect(matcher.match({ node: document.createTextNode('no phone') })).toEqual([]);
    expect(matcher.matchValueNodes(null)).toEqual([]);
    expect(matcher.collectValueNodes(null)).toEqual([]);
    expect(matcher.collectValueNodes(document.createTextNode('+1 650 555 0100'))).toEqual([]);
  });

  it('skips empty, non-phone, and non-string value nodes', () => {
    const emptyInput = document.createElement('input');
    emptyInput.value = '';
    const nonPhoneInput = document.createElement('input');
    nonPhoneInput.value = 'not a phone number';
    const nonStringInput = document.createElement('input');
    Object.defineProperty(nonStringInput, 'value', {
      configurable: true,
      value: null,
    });
    document.body.append(emptyInput, nonPhoneInput, nonStringInput);
    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
    });

    expect(matcher.match({ node: document.body })).toEqual([]);
  });

  it('logs debug labels for ignored text matches and labelled elements', () => {
    window.localStorage.setItem('rcC2DDebug', 'true');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const link = document.createElement('a');
    link.id = 'contact-link';
    link.className = 'primary contact';
    link.href = 'https://crm.example/contact';
    const textNode = document.createTextNode('+1 650 555 0100');
    link.appendChild(textNode);
    document.body.append(link);
    const matcher = new InputAwareRegExpMatcher({
      textMatcher: {
        match: vi.fn(() => [
          {
            startsNode: textNode,
            endsNode: link,
            context: { phoneNumber: '+1 650 555 0100' },
          },
          {
            startsNode: null,
            endsNode: null,
            context: { phoneNumber: '+1 650 555 0101' },
          },
        ]),
      },
      isNodeIgnored: (node) => node === textNode || node == null,
    });

    expect(matcher.match({ node: link })).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(
      '[App Connect][C2D matcher]',
      'dropping ignored match',
      expect.objectContaining({
        phoneNumber: '+1 650 555 0100',
        startsNode: '#text("+1 650 555 0100")',
        endsNode: 'a#contact-link.primary.contact[href="https://crm.example/contact"]',
        startsIgnored: true,
      }),
    );
    expect(console.log).toHaveBeenCalledWith(
      '[App Connect][C2D matcher]',
      'dropping ignored match',
      expect.objectContaining({
        startsNode: 'null',
        endsNode: 'null',
      }),
    );
  });

  it('returns already-collected value nodes before skipping ignored descendant scans', () => {
    const input = document.createElement('input');
    input.value = '+1 650 555 0100';
    const matcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
      isNodeIgnored: (node) => node === input,
    });

    expect(matcher.collectValueNodes(input)).toEqual([]);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<input value="+1 650 555 0101" />';
    const ignoredRootMatcher = new InputAwareRegExpMatcher({
      textMatcher: { match: vi.fn(() => []) },
      isNodeIgnored: (node) => node === wrapper,
    });

    expect(ignoredRootMatcher.collectValueNodes(wrapper)).toEqual([]);
  });
});
