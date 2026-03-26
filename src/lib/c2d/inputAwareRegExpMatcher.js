import { RegExpPhoneNumberMatcher, extractPhoneNumber } from 'ringcentral-c2d';

const VALUE_NODE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export default class InputAwareRegExpMatcher {
  constructor() {
    this.textMatcher = new RegExpPhoneNumberMatcher();
  }

  match({ node, validate }) {
    const textMatches = this.textMatcher.match({ node, validate }) ?? [];
    const valueMatches = this.matchValueNodes(node);
    return [...textMatches, ...valueMatches];
  }

  matchValueNodes(node) {
    const matches = [];
    const valueNodes = this.collectValueNodes(node);

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
        matches.push({
          startsNode: valueNode,
          endsNode: valueNode,
          startsAt: offset + startsAt,
          endsAt: offset + endsAt,
          context: {
            phoneNumber,
          },
        });

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
