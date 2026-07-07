// @ts-nocheck
import { createC2DNodeIgnorePredicate, DEFAULT_C2D_IGNORE_SELECTOR } from '../../../src/lib/c2d/domIgnore.ts';

describe('c2d domIgnore', () => {
  it('uses the default App Connect ignore selector', () => {
    document.body.innerHTML = `
      <div>
        <span id="ignored" data-rc-c2d-ignore="true">+16505550100</span>
        <span id="normal">+16505550101</span>
      </div>
    `;

    const isIgnored = createC2DNodeIgnorePredicate();

    expect(DEFAULT_C2D_IGNORE_SELECTOR).toContain('data-rc-c2d-ignore');
    expect(isIgnored(document.querySelector('#ignored').firstChild)).toBe(true);
    expect(isIgnored(document.querySelector('#normal').firstChild)).toBe(false);
  });

  it('normalizes quoted custom selectors', () => {
    document.body.innerHTML = `
      <section class="crm-ignore">
        <span id="phone">+16505550100</span>
      </section>
    `;

    const isIgnored = createC2DNodeIgnorePredicate('" .crm-ignore "');

    expect(isIgnored(document.querySelector('#phone').firstChild)).toBe(true);
  });

  it('warns once for an invalid selector and continues evaluating other selectors', () => {
    document.body.innerHTML = `
      <div class="rc-c2d-ignore">
        <span id="default-ignored">+16505550100</span>
      </div>
      <span id="normal">+16505550101</span>
    `;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const isIgnored = createC2DNodeIgnorePredicate('[');

    expect(isIgnored(document.querySelector('#default-ignored').firstChild)).toBe(true);
    expect(isIgnored(document.querySelector('#normal').firstChild)).toBe(false);
    expect(isIgnored(document.querySelector('#normal').firstChild)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('walks from a shadow-root child to its host when matching selectors', () => {
    const host = document.createElement('div');
    host.className = 'host-ignore';
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const span = document.createElement('span');
    span.textContent = '+16505550100';
    shadowRoot.appendChild(span);

    const isIgnored = createC2DNodeIgnorePredicate('.host-ignore');

    expect(isIgnored(span.firstChild)).toBe(true);
  });
});
