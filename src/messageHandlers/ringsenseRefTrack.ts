import { trackRingSensePage } from '../lib/analytics';

type MessageHandlerOptions = {
  request: unknown;
  sendResponse: (response: { result: string }) => void;
};

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  void request;
  trackRingSensePage();
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
};
