export function initializeShadowRootSupport({
  createC2DInstance,
  sharedWidget,
  onInstanceCreated,
  onObserverCreated,
  pollerStore,
}) {
  const processedShadowRoots = new WeakSet();
  const observedRoots = new WeakSet();

  const processShadowRoot = (shadowRoot) => {
    if (processedShadowRoots.has(shadowRoot)) return;

    processedShadowRoots.add(shadowRoot);

    const c2dInstance = createC2DInstance({
      rootNode: shadowRoot,
      sharedWidget,
    });
    onInstanceCreated(c2dInstance);
    console.log('[App Connect] C2D initialized for shadowRoot');

    scanForShadowRoots(shadowRoot);
    observeRoot(shadowRoot);
  };

  const processElement = (element) => {
    if (element.shadowRoot && !processedShadowRoots.has(element.shadowRoot)) {
      processShadowRoot(element.shadowRoot);
    }
  };

  const scanForShadowRoots = (root) => {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node = walker.currentNode;
    while (node) {
      if (node.shadowRoot && !processedShadowRoots.has(node.shadowRoot)) {
        processShadowRoot(node.shadowRoot);
      }
      node = walker.nextNode();
    }
  };

  const scheduleElementShadowRootCheck = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

    let remainingChecks = 20;
    const intervalId = window.setInterval(() => {
      if (!element.isConnected || remainingChecks <= 0) {
        window.clearInterval(intervalId);
        return;
      }

      if (element.shadowRoot) {
        processShadowRoot(element.shadowRoot);
        window.clearInterval(intervalId);
        return;
      }

      remainingChecks -= 1;
    }, 500);

    pollerStore.push(intervalId);
  };

  const observeRoot = (root) => {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processElement(node);
            scheduleElementShadowRootCheck(node);
            scanForShadowRoots(node);
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

  if (!window.__rcC2dAttachShadowPatched) {
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function patchedAttachShadow(...args) {
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
