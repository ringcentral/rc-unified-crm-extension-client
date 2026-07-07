type MessageHandlerOptions = {
  request: {
    callAction?: unknown;
    callId?: unknown;
    options?: unknown;
    [key: string]: unknown;
  };
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-control-call',
    callAction: request.callAction,
    callId: request.callId,
    options: request.options,
  }, '*');
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
};
