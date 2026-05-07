// Runs in the page's MAIN world at document_start so it intercepts
// every attachShadow() call made by the host page (e.g. ServiceNow's
// Now-Experience / Seismic web components). The isolated-world content
// script cannot patch Element.prototype for the page, so this lightweight
// shim is required for click-to-dial to reach shadow-DOM-rendered phone
// numbers.
(() => {
  if (window.__rcAttachShadowPatched) return;
  window.__rcAttachShadowPatched = true;

  const HOST_ATTR = 'data-rc-shadow-host';
  const EVENT_NAME = 'rc-shadow-attached';
  const originalAttachShadow = Element.prototype.attachShadow;
  if (typeof originalAttachShadow !== 'function') return;

  // Web components frequently call attachShadow() inside their custom-element
  // constructor. The HTML spec forbids mutating attributes during construction
  // (otherwise document.createElement throws NotSupportedError: "The result
  // must not have attributes"). So we defer setAttribute / dispatchEvent to
  // a microtask, which runs immediately after construction finishes.
  const defer = (fn) => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(fn);
    } else {
      Promise.resolve().then(fn);
    }
  };

  Element.prototype.attachShadow = function patchedAttachShadow(init) {
    const opts = Object.assign({}, init || {});
    // Coerce closed shadows to open so the content script can read them.
    if (opts.mode === 'closed') {
      opts.mode = 'open';
    }
    const shadowRoot = originalAttachShadow.call(this, opts);
    const host = this;
    defer(() => {
      if (!host || !host.isConnected) {
        // host may have been disposed before we got to run; still try to
        // tag/dispatch — failures here are silently ignored.
      }
      try {
        host.setAttribute(HOST_ATTR, '1');
      } catch (e) { /* SVG/MathML elements may not accept this attribute */ }
      try {
        // composed:true lets the event bubble out of nested shadow roots
        // into the document-level listener installed by the content script.
        host.dispatchEvent(new CustomEvent(EVENT_NAME, { bubbles: true, composed: true }));
      } catch (e) { /* noop */ }
    });
    return shadowRoot;
  };
})();
