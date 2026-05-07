import { RegExpPhoneNumberMatcher, extractPhoneNumber } from 'ringcentral-c2d';

const VALUE_NODE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export default class InputAwareRegExpMatcher {
  constructor({ textMatcher } = {}) {
    this.textMatcher = textMatcher ?? new RegExpPhoneNumberMatcher();
  }

  match({ node, validate }) {
    const textMatches = this.textMatcher.match({ node, validate }) ?? [];
    const valueMatches = this.matchValueNodes(node);
    return [...textMatches, ...valueMatches];
  }

  matchValueNodes(node) {
    const matches = [];
    const seen = new Set();
    const valueNodes = this.collectValueNodes(node);
    const pushMatch = ({ targetNode, startsAt, endsAt, phoneNumber }) => {
      if (!targetNode) return;
      const key = `${phoneNumber}::${targetNode.tagName || targetNode.nodeName}::${targetNode.id || ''}::${targetNode.className || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      matches.push({
        startsNode: targetNode,
        endsNode: targetNode,
        startsAt,
        endsAt,
        context: {
          phoneNumber,
        },
      });
    };

    for (const valueNode of valueNodes) {
      const value = typeof valueNode.value === 'string' ? valueNode.value : '';
      if (!value) continue;

      let offset = 0;
      let remaining = value;
      while (remaining.length > 0) {
        const phoneNumber = extractPhoneNumber(remaining);
        if (!phoneNumber) break;

        const startsAt = remaining.indexOf(phoneNumber);
        const endsAt = startsAt + phoneNumber.length;
        pushMatch({
          targetNode: valueNode,
          startsAt: offset + startsAt,
          endsAt: offset + endsAt,
          phoneNumber,
        });
        const rootNode = valueNode.getRootNode?.();
        if (rootNode instanceof ShadowRoot && rootNode.host) {
          // Some component libraries handle pointer events on the host wrapper
          // rather than the inner <input>; bind C2D context to host as fallback.
          pushMatch({
            targetNode: rootNode.host,
            startsAt: undefined,
            endsAt: undefined,
            phoneNumber,
          });
        }

        offset += endsAt;
        remaining = remaining.substring(endsAt);
      }
    }

    return matches;
  }

  collectValueNodes(node) {
    const valueNodes = [];
    const addIfApplicable = (element) => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
      if (!VALUE_NODE_TAGS.has(element.tagName)) return;
      if (element.hidden || element.disabled) return;
      if (element.tagName === 'INPUT' && element.type === 'hidden') return;
      valueNodes.push(element);
    };

    if (!node) {
      return valueNodes;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      addIfApplicable(node);
    }

    if ((node.nodeType === Node.ELEMENT_NODE || node instanceof ShadowRoot || node instanceof DocumentFragment) && node.querySelectorAll) {
      for (const element of node.querySelectorAll('input, textarea, select')) {
        addIfApplicable(element);
      }
    }

    return valueNodes;
  }
}
