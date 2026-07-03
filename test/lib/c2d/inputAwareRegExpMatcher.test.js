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

import InputAwareRegExpMatcher from '../../../src/lib/c2d/inputAwareRegExpMatcher.js';

describe('InputAwareRegExpMatcher', () => {
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
    document.querySelector('#phone-textarea').value = '+1 650 555 0101';
    document.querySelector('#phone-select').value = '+1 650 555 0102';

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
});
