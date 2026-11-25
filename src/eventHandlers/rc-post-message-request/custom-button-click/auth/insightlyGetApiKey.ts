import { insightlySettingsUrlForHostname, parseInsightlySettingsUrl } from '../../../../lib/insightlyUrls';

export const INSIGHTLY_GET_API_KEY_ACTION = 'insightlyGetApiKey';
const IMPORT_TIMEOUT_MS = 10 * 60 * 1000;

type PendingImport = {
  origin: string;
  expiresAt: number;
  tabId?: number;
};
let pendingImport: PendingImport | undefined;

export async function onEvent({ platformInfo }: { platformInfo: { hostname?: unknown } }): Promise<void> {
  const settingsUrl = insightlySettingsUrlForHostname(platformInfo?.hostname);
  if (!settingsUrl) {
    return;
  }

  const attempt: PendingImport = { origin: settingsUrl.origin, expiresAt: Date.now() + IMPORT_TIMEOUT_MS };
  pendingImport = attempt;
  try {
    // Bind the tab before navigating so the content script cannot race the import setup.
    const settingsWindow = await chrome.windows.create({ url: 'about:blank', type: 'normal', focused: true });
    const tabId = settingsWindow?.tabs?.[0]?.id;
    if (tabId === undefined) {
      throw new Error('Could not open the Insightly settings tab');
    }
    attempt.tabId = tabId;
    await chrome.tabs.update(tabId, { url: settingsUrl.href });
  } catch (error) {
    if (pendingImport === attempt) {
      pendingImport = undefined;
    }
    throw error;
  }
}

export function consumeInsightlyImport(sender: chrome.runtime.MessageSender): string | undefined {
  const senderUrl = parseInsightlySettingsUrl(sender.url);
  if (!senderUrl || sender.frameId !== 0 || sender.origin !== senderUrl.origin
      || pendingImport?.tabId === undefined || sender.tab?.id !== pendingImport.tabId
      || senderUrl.origin !== pendingImport.origin || Date.now() >= pendingImport.expiresAt) {
    return;
  }
  pendingImport = undefined;
  return senderUrl.origin;
}

export default {
  onEvent,
};
