import { trackChromeAPIError } from './analytics';

export function sendMessageToExtension(message, callback) {
  try {
    return chrome.runtime.sendMessage(message, callback);
  } catch (e) {
    console.error(e);
    trackChromeAPIError(e && e.message);
    if (e.message && e.message.includes('Extension context invalidated')) {
      alert('RingCentral CRM Extension has been upgraded. Please refresh current page to continue.');
    }
  }
}
