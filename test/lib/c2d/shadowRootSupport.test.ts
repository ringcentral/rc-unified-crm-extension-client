import { initializeShadowRootSupport } from '../../../src/lib/c2d/shadowRootSupport.ts';

const originalAttachShadow = Element.prototype.attachShadow;

function initialize(overrides = {}) {
  const createC2DInstance = vi.fn(({ rootNode }) => ({ rootNode }));
  const onInstanceCreated = vi.fn();
  const onObserverCreated = vi.fn();
  const pollerStore = [];
  initializeShadowRootSupport({
    createC2DInstance,
    sharedWidget: { id: 'shared-widget' },
    matcherType: 'libPhone',
    selectedRegion: 'US',
    c2dIgnoreSelector: '.ignore-phone',
    onInstanceCreated,
    onObserverCreated,
    pollerStore,
    ...overrides,
  });
  return {
    createC2DInstance,
    onInstanceCreated,
    onObserverCreated,
    pollerStore,
  };
}

describe('shadowRootSupport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Element.prototype.attachShadow = originalAttachShadow;
    delete window.__rcC2dAttachShadowPatched;
  });

  it('processes existing shadow roots and creates observers for them', () => {
    const host = document.createElement('section');
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    const result = initialize();

    expect(result.createC2DInstance).toHaveBeenCalledWith({
      rootNode: shadowRoot,
      sharedWidget: { id: 'shared-widget' },
      matcherType: 'libPhone',
      selectedRegion: 'US',
      c2dIgnoreSelector: '.ignore-phone',
    });
    expect(result.onInstanceCreated).toHaveBeenCalledWith({ rootNode: shadowRoot });
    expect(result.onObserverCreated).toHaveBeenCalled();
  });

  it('patches attachShadow so newly attached roots are processed once', () => {
    const result = initialize();
    const host = document.createElement('article');
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    host.dispatchEvent(new Event('rc-shadow-attached', { bubbles: true, composed: true }));

    const callsForRoot = result.createC2DInstance.mock.calls
      .filter(([arg]) => arg.rootNode === shadowRoot);
    expect(callsForRoot).toHaveLength(1);
  });

  it('marks candidate value nodes for C2D probing and ignores short or hidden values', () => {
    initialize();
    const phoneInput = document.createElement('input');
    phoneInput.value = '+1 (650) 555-0100';
    const shortInput = document.createElement('input');
    shortInput.value = '12345';
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.value = '+1 (650) 555-0199';
    document.body.append(phoneInput, shortInput, hiddenInput);

    phoneInput.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
    shortInput.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
    hiddenInput.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));

    expect(phoneInput.getAttribute('data-rc-c2d-probe')).toMatch(/^\d+$/);
    expect(shortInput.hasAttribute('data-rc-c2d-probe')).toBe(false);
    expect(hiddenInput.hasAttribute('data-rc-c2d-probe')).toBe(false);
  });

  it('uses default callbacks and skips disabled, empty, and non-value probe targets', () => {
    initializeShadowRootSupport({
      createC2DInstance: vi.fn(),
    });
    const disabledTextarea = document.createElement('textarea');
    disabledTextarea.disabled = true;
    disabledTextarea.value = '+1 (650) 555-0100';
    const emptyInput = document.createElement('input');
    emptyInput.value = '';
    const div = document.createElement('div');
    div.textContent = '+1 (650) 555-0100';
    document.body.append(disabledTextarea, emptyInput, div);

    disabledTextarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    emptyInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    div.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    document.dispatchEvent(new Event('rc-shadow-attached', { bubbles: true, composed: true }));

    expect(disabledTextarea.hasAttribute('data-rc-c2d-probe')).toBe(false);
    expect(emptyInput.hasAttribute('data-rc-c2d-probe')).toBe(false);
    expect(div.hasAttribute('data-rc-c2d-probe')).toBe(false);
  });

  it('throttles repeated value-node probes and supports target fallback without composedPath', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1100)
      .mockReturnValueOnce(1500);
    initialize();
    const input = document.createElement('input');
    input.value = '+1 (650) 555-0100';
    const setAttributeSpy = vi.spyOn(input, 'setAttribute');
    document.body.append(input);

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    const fallbackEvent = new Event('change', { bubbles: true, composed: true });
    Object.defineProperty(fallbackEvent, 'composedPath', {
      configurable: true,
      value: undefined,
    });
    input.dispatchEvent(fallbackEvent);

    expect(setAttributeSpy).toHaveBeenCalled();
    expect(input.getAttribute('data-rc-c2d-probe')).toMatch(/^\d+$/);
  });

  it('observes newly inserted shadow hosts and ignores repeated or non-element mutations', async () => {
    const result = initialize();
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const taggedHost = document.createElement('section');
    taggedHost.setAttribute('data-rc-shadow-host', 'true');
    const textNode = document.createTextNode('plain text');

    document.body.append(host, taggedHost, textNode);
    await Promise.resolve();

    const callsForRoot = result.createC2DInstance.mock.calls
      .filter(([arg]) => arg.rootNode === shadowRoot);
    expect(callsForRoot).toHaveLength(1);

    host.dispatchEvent(new Event('rc-shadow-attached', { bubbles: true, composed: true }));
    expect(result.createC2DInstance.mock.calls.filter(([arg]) => arg.rootNode === shadowRoot)).toHaveLength(1);
  });

  it('uses polling fallback for elements that receive a shadow root after insertion', async () => {
    vi.useFakeTimers();
    window.__rcC2dAttachShadowPatched = true;
    const result = initialize();
    const host = document.createElement('article');
    document.body.append(host);
    await Promise.resolve();
    expect(result.pollerStore).toHaveLength(1);

    const shadowRoot = originalAttachShadow.call(host, { mode: 'open' });
    vi.advanceTimersByTime(250);

    expect(result.createC2DInstance).toHaveBeenCalledWith(expect.objectContaining({
      rootNode: shadowRoot,
    }));
  });

  it('clears polling fallback for disconnected elements and does not patch attachShadow twice', async () => {
    vi.useFakeTimers();
    window.__rcC2dAttachShadowPatched = true;
    const attachShadowBefore = Element.prototype.attachShadow;
    const result = initialize();
    const host = document.createElement('article');
    document.body.append(host);
    await Promise.resolve();
    host.remove();

    vi.advanceTimersByTime(250);

    expect(result.pollerStore).toHaveLength(1);
    expect(Element.prototype.attachShadow).toBe(attachShadowBefore);
  });
});
