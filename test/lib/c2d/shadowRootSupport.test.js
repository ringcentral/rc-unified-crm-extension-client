import { initializeShadowRootSupport } from '../../../src/lib/c2d/shadowRootSupport.js';

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
});
