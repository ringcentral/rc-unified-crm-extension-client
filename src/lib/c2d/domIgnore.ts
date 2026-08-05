export const DEFAULT_C2D_IGNORE_SELECTOR = '[data-rc-c2d-ignore="true"], .rc-c2d-ignore';

function isC2DDebugEnabled(): boolean {
  try {
    return window.localStorage?.getItem('rcC2DDebug') === 'true';
  } catch (e) {
    return false;
  }
}

function debugLog(...args: unknown[]): void {
  if (isC2DDebugEnabled()) {
    console.log('[App Connect][C2D ignore]', ...args);
  }
}

function getElementForNode(node?: Node | null): Element | null {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  if (typeof ShadowRoot !== 'undefined' && node instanceof ShadowRoot) return node.host;
  return node.parentElement ?? null;
}

function normalizeIgnoreSelector(selector?: unknown): string {
  const trimmed = typeof selector === 'string' ? selector.trim() : '';
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function createC2DNodeIgnorePredicate(ignoreSelector?: unknown) {
  const normalizedIgnoreSelector = normalizeIgnoreSelector(ignoreSelector);
  const selectors = [
    DEFAULT_C2D_IGNORE_SELECTOR,
    normalizedIgnoreSelector,
  ].filter(Boolean);
  const invalidSelectors = new Set<string>();

  debugLog('initialized', {
    rawSelector: ignoreSelector,
    normalizedSelector: normalizedIgnoreSelector,
    selectors,
  });

  return function isC2DNodeIgnored(node?: Node | null): boolean {
    let element = getElementForNode(node);
    while (element) {
      for (const selector of selectors) {
        if (invalidSelectors.has(selector)) continue;

        try {
          if (element.closest?.(selector)) {
            debugLog('matched selector', {
              selector,
              node,
              element,
              closest: element.closest(selector),
            });
            return true;
          }
        } catch (e) {
          invalidSelectors.add(selector);
          console.warn('[App Connect] Invalid C2D ignore selector ignored:', selector, e);
        }
      }

      const rootNode = element.getRootNode?.();
      element = typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot ? rootNode.host : null;
    }

    return false;
  };
}

export const isC2DNodeIgnored = createC2DNodeIgnorePredicate();

