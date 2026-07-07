const SHADOW_HOST_ATTR = 'data-rc-shadow-host';
const SHADOW_HOST_SELECTOR = `[${SHADOW_HOST_ATTR}]`;
const SHADOW_ATTACHED_EVENT = 'rc-shadow-attached';
const C2D_VALUE_PROBE_ATTR = 'data-rc-c2d-probe';
const VALUE_NODE_SELECTOR = 'input, textarea, select';

type ValueNode = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type ShadowScanRoot = Document | DocumentFragment | Element;

interface CreateC2DInstanceOptions {
  rootNode: ShadowRoot;
  sharedWidget: unknown;
  matcherType: unknown;
  selectedRegion: unknown;
  c2dIgnoreSelector: unknown;
}

interface InitializeShadowRootSupportOptions {
  createC2DInstance: (options: CreateC2DInstanceOptions) => unknown;
  sharedWidget?: unknown;
  matcherType?: unknown;
  selectedRegion?: unknown;
  c2dIgnoreSelector?: unknown;
  onInstanceCreated?: (instance: unknown) => void;
  onObserverCreated?: (observer: MutationObserver) => void;
  pollerStore?: number[];
}

function isValueNode(element: unknown): element is ValueNode {
  if (!(element instanceof Element)) return false;
  if (!element.matches(VALUE_NODE_SELECTOR)) return false;
  const valueElement = element as ValueNode;
  if (valueElement.hidden || valueElement.disabled) return false;
  if (valueElement.tagName === 'INPUT' && (valueElement as HTMLInputElement).type === 'hidden') return false;
  return true;
}

function hasCandidatePhoneValue(element: unknown): element is ValueNode {
  if (!isValueNode(element)) return false;
  const value = typeof element.value === 'string' ? element.value : '';
  if (!value) return false;
  // Keep it permissive for international formats, but avoid probing
  // on short numeric values like zip codes.
  return /\d[\d\s()+\-]{5,}\d/.test(value);
}

export function initializeShadowRootSupport({
  createC2DInstance,
  sharedWidget,
  matcherType,
  selectedRegion,
  c2dIgnoreSelector,
  onInstanceCreated = () => {},
  onObserverCreated = () => {},
  pollerStore = [],
}: InitializeShadowRootSupportOptions): void {
  const processedShadowRoots = new WeakSet<ShadowRoot>();
  const observedRoots = new WeakSet<Node>();
  const probedValueNodes = new WeakMap<ValueNode, number>();

  const triggerValueNodeProbe = (element: unknown) => {
    if (!hasCandidatePhoneValue(element)) return;
    const now = Date.now();
    const lastProbeAt = probedValueNodes.get(element) || 0;
    if (now - lastProbeAt < 300) return;
    probedValueNodes.set(element, now);
    try {
      element.setAttribute(C2D_VALUE_PROBE_ATTR, String(now));
    } catch (e) { /* noop */ }
  };

  const getValueNodeFromEvent = (event: Event): ValueNode | null => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const item of path) {
      if (isValueNode(item)) return item;
    }
    if (isValueNode(event.target)) return event.target;
    return null;
  };

  const processShadowRoot = (shadowRoot: ShadowRoot) => {
    if (processedShadowRoots.has(shadowRoot)) return;

    processedShadowRoots.add(shadowRoot);

    const c2dInstance = createC2DInstance({
      rootNode: shadowRoot,
      sharedWidget,
      matcherType,
      selectedRegion,
      c2dIgnoreSelector,
    });
    onInstanceCreated(c2dInstance);
    console.log('[App Connect] C2D initialized for shadowRoot');

    scanForShadowRoots(shadowRoot);
    observeRoot(shadowRoot);
  };

  const processElement = (element: Element) => {
    if (element.shadowRoot && !processedShadowRoots.has(element.shadowRoot)) {
      processShadowRoot(element.shadowRoot);
    }
  };

  const scanForShadowRoots = (root: ShadowScanRoot) => {
    // Fast path: any host already tagged by the MAIN-world patch.
    if (root && typeof root.querySelectorAll === 'function') {
      try {
        const taggedHosts = root.querySelectorAll(SHADOW_HOST_SELECTOR);
        for (const host of taggedHosts) {
          if (host.shadowRoot && !processedShadowRoots.has(host.shadowRoot)) {
            processShadowRoot(host.shadowRoot);
          }
        }
      } catch (e) { /* querySelectorAll can throw on detached/document fragments */ }
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      null,
    );

    let node = walker.currentNode;
    while (node) {
      if (node instanceof Element && node.shadowRoot && !processedShadowRoots.has(node.shadowRoot)) {
        processShadowRoot(node.shadowRoot);
      }
      node = walker.nextNode();
    }
  };

  const scheduleElementShadowRootCheck = (element: Node) => {
    if (!(element instanceof Element)) return;
    // If the element is already tagged or already has a shadow root, handle synchronously.
    if (element.shadowRoot) {
      processShadowRoot(element.shadowRoot);
      return;
    }
    // Primary path relies on the MAIN-world attachShadow event.
    // Keep a short polling fallback for environments where MAIN-world
    // patching is unavailable or event delivery is missed.
    let remainingChecks = 16;
    const intervalId = window.setInterval(() => {
      if (!element.isConnected || remainingChecks <= 0) {
        window.clearInterval(intervalId);
        return;
      }

      if (element.shadowRoot && !processedShadowRoots.has(element.shadowRoot)) {
        processShadowRoot(element.shadowRoot);
        window.clearInterval(intervalId);
        return;
      }

      remainingChecks -= 1;
    }, 250);

    pollerStore.push(intervalId);
  };

  const observeRoot = (root: ShadowScanRoot) => {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processElement(node as Element);
            scheduleElementShadowRootCheck(node);
            scanForShadowRoots(node as Element);
          }
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    onObserverCreated(observer);
  };

  scanForShadowRoots(document.body);

  // Listen for the event dispatched by the MAIN-world attachShadow patch
  // (public/c2d/attachShadowPatch.js). composed:true lets it bubble out
  // of nested shadow roots into the document listener.
  const onShadowAttached = (event: Event) => {
    const host = event.target;
    if (!(host instanceof Element)) return;
    if (host.shadowRoot && !processedShadowRoots.has(host.shadowRoot)) {
      try {
        processShadowRoot(host.shadowRoot);
      } catch (e) {
        console.error('[App Connect] Failed to initialize C2D for attached shadow root', e);
      }
    }
  };
  document.addEventListener(SHADOW_ATTACHED_EVENT, onShadowAttached, true);
  const onProbeEvent = (event: Event) => {
    const valueNode = getValueNodeFromEvent(event);
    if (!valueNode) return;
    triggerValueNodeProbe(valueNode);
  };
  document.addEventListener('focusin', onProbeEvent, true);
  document.addEventListener('input', onProbeEvent, true);
  document.addEventListener('change', onProbeEvent, true);

  // Defensive fallback: if the MAIN-world patch did not run (e.g. on a
  // page where it was blocked), still patch attachShadow in the isolated
  // world so any code inside the extension's world is covered.
  if (!window.__rcC2dAttachShadowPatched) {
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function patchedAttachShadow(
      this: Element,
      ...args: Parameters<typeof Element.prototype.attachShadow>
    ) {
      const shadowRoot = originalAttachShadow.apply(this, args);
      try {
        processShadowRoot(shadowRoot);
      }
      catch (e) {
        console.error('[App Connect] Failed to initialize C2D for attached shadow root', e);
      }
      return shadowRoot;
    };
    window.__rcC2dAttachShadowPatched = true;
  }

  observeRoot(document.body);
}

