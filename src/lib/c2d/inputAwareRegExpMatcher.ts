import { RegExpPhoneNumberMatcher, extractPhoneNumber } from 'ringcentral-c2d';
import type { MatchModel, MatchProps } from 'ringcentral-c2d';

const VALUE_NODE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type ValueNode = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface TextMatcher {
  match: (props: MatchProps) => MatchModel[] | undefined;
}

interface InputAwareRegExpMatcherOptions {
  textMatcher?: TextMatcher;
  validDomExclusions?: unknown[];
  isNodeIgnored?: (node?: Node | null) => boolean;
}

function isC2DDebugEnabled(): boolean {
  try {
    return window.localStorage?.getItem('rcC2DDebug') === 'true';
  } catch (e) {
    return false;
  }
}

function getNodeLabel(node?: Node | null): string {
  if (!node) return 'null';
  if (node.nodeType === Node.TEXT_NODE) {
    return `#text("${node.textContent?.trim()?.slice(0, 80) ?? ''}")`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return node.nodeName;
  }

  const element = node as Element;
  const parts = [element.tagName.toLowerCase()];
  if (element.id) parts.push(`#${element.id}`);
  if (typeof element.className === 'string' && element.className.trim()) {
    parts.push(`.${element.className.trim().split(/\s+/).join('.')}`);
  }
  if (element.getAttribute?.('href')) parts.push(`[href="${element.getAttribute('href')}"]`);
  return parts.join('');
}

function debugLog(...args: unknown[]): void {
  if (isC2DDebugEnabled()) {
    console.log('[App Connect][C2D matcher]', ...args);
  }
}

function isValueNode(element: Element): element is ValueNode {
  return VALUE_NODE_TAGS.has(element.tagName);
}

function getMatchKey({
  phoneNumber,
  targetNode,
}: {
  phoneNumber: string;
  targetNode: Node;
}): string {
  if (targetNode instanceof Element) {
    return `${phoneNumber}::${targetNode.tagName || targetNode.nodeName}::${targetNode.id || ''}::${typeof targetNode.className === 'string' ? targetNode.className : ''}`;
  }
  return `${phoneNumber}::${targetNode.nodeName}`;
}

export default class InputAwareRegExpMatcher {
  private isNodeIgnored: (node?: Node | null) => boolean;

  private textMatcher: TextMatcher;

  constructor({
    textMatcher,
    validDomExclusions,
    isNodeIgnored,
  }: InputAwareRegExpMatcherOptions = {}) {
    this.isNodeIgnored = isNodeIgnored ?? (() => false);
    this.textMatcher = textMatcher ?? new RegExpPhoneNumberMatcher({ validDomExclusions });
  }

  match({ node, validate }: MatchProps): MatchModel[] {
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

  filterIgnoredMatches(matches: MatchModel[]): MatchModel[] {
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

  matchValueNodes(node?: Node | null): MatchModel[] {
    const matches: MatchModel[] = [];
    const seen = new Set<string>();
    const valueNodes = this.collectValueNodes(node);
    const pushMatch = ({
      targetNode,
      startsAt,
      endsAt,
      phoneNumber,
    }: {
      targetNode?: Node | null;
      startsAt?: number;
      endsAt?: number;
      phoneNumber: string;
    }) => {
      if (!targetNode) return;
      const key = getMatchKey({ phoneNumber, targetNode });
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

  collectValueNodes(node?: Node | null): ValueNode[] {
    const valueNodes: ValueNode[] = [];
    const addIfApplicable = (element?: Element | null) => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
      if (!isValueNode(element)) return;
      if (element.hidden || element.disabled) return;
      if (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'hidden') return;
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
      addIfApplicable(node as Element);
    }

    if (this.isNodeIgnored(node)) {
      return valueNodes;
    }

    if (node.nodeType === Node.ELEMENT_NODE || node instanceof ShadowRoot || node instanceof DocumentFragment) {
      const searchableNode = node as Element | DocumentFragment;
      for (const element of searchableNode.querySelectorAll('input, textarea, select')) {
        addIfApplicable(element);
      }
    }

    return valueNodes;
  }
}
