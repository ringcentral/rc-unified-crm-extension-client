import { trackChromeAPIError } from './analytics';

export function sendMessageToExtension(message: unknown, callback?: (response: unknown) => void): unknown {
  try {
    return chrome.runtime.sendMessage(message, callback);
  } catch (e) {
    console.error(e);
    const errorMessage = (e as { message?: string } | null | undefined)?.message;
    trackChromeAPIError(errorMessage);
    if (errorMessage && errorMessage.includes('Extension context invalidated')) {
      alert('RingCentral App Connect has been upgraded. Please refresh current page to continue.');
    }
  }
}
