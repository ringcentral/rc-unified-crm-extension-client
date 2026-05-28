import { RegExpPhoneNumberMatcher, extractPhoneNumber } from 'ringcentral-c2d';

const VALUE_NODE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isC2DDebugEnabled() {
  try {
    return window.localStorage?.getItem('rcC2DDebug') === 'true';
  } catch (e) {
    return false;
  }
}

function getNodeLabel(node) {
  if (!node) return 'null';
  if (node.nodeType === Node.TEXT_NODE) {
    return `#text("${node.textContent?.trim()?.slice(0, 80) ?? ''}")`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return node.nodeName;
  }

  const parts = [node.tagName.toLowerCase()];
  if (node.id) parts.push(`#${node.id}`);
  if (typeof node.className === 'string' && node.className.trim()) {
    parts.push(`.${node.className.trim().split(/\s+/).join('.')}`);
  }
  if (node.getAttribute?.('href')) parts.push(`[href="${node.getAttribute('href')}"]`);
  return parts.join('');
}

function debugLog(...args) {
  if (isC2DDebugEnabled()) {
    console.log('[App Connect][C2D matcher]', ...args);
  }
}

export default class InputAwareRegExpMatcher {
  constructor({ textMatcher, validDomExclusions, isNodeIgnored } = {}) {
    this.isNodeIgnored = isNodeIgnored ?? (() => false);
    this.textMatcher = textMatcher ?? new RegExpPhoneNumberMatcher({ validDomExclusions });
  }

  match({ node, validate }) {
    const rawTextMatches = this.textMatcher.match({ node, validate }) ?? [];
    const textMatches = this.filterIgnoredMatches(rawTextMatches);
    const valueMatches = this.matchValueNodes(node);
    if (rawTextMatches.length || valueMatches.length) {
      debugLog('match result', {
        rootNode: getNodeLabel(node),
        rawTextMatches: rawTextMatches.length,
        keptTextMatches: textMatches.length,
        valueMatches: valueMatches.length,
      });
    }
    return [...textMatches, ...valueMatches];
  }

  filterIgnoredMatches(matches) {
    return matches.filter((match) => {
      const startsIgnored = this.isNodeIgnored(match.startsNode);
      const endsIgnored = this.isNodeIgnored(match.endsNode);
      if (startsIgnored || endsIgnored) {
        debugLog('dropping ignored match', {
          phoneNumber: match.context?.phoneNumber,
          startsNode: getNodeLabel(match.startsNode),
          endsNode: getNodeLabel(match.endsNode),
          startsIgnored,
          endsIgnored,
        });
        return false;
      }

      debugLog('keeping match', {
        phoneNumber: match.context?.phoneNumber,
        startsNode: getNodeLabel(match.startsNode),
        endsNode: getNodeLabel(match.endsNode),
      });
      return true;
    });
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
      if (this.isNodeIgnored(element)) {
        debugLog('skipping ignored value node', getNodeLabel(element));
        return;
      }
      valueNodes.push(element);
    };

    if (!node) {
      return valueNodes;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      addIfApplicable(node);
    }

    if (this.isNodeIgnored(node)) {
      return valueNodes;
    }

    if ((node.nodeType === Node.ELEMENT_NODE || node instanceof ShadowRoot || node instanceof DocumentFragment) && node.querySelectorAll) {
      for (const element of node.querySelectorAll('input, textarea, select')) {
        addIfApplicable(element);
      }
    }

    return valueNodes;
  }
}
