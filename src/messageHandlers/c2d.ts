type MessageHandlerOptions = {
  request: {
    phoneNumber?: string;
    [key: string]: unknown;
  };
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-new-call',
    phoneNumber: request.phoneNumber,
    toCall: true,
  }, '*');
  sendResponse({ result: 'ok' });
}

export default {
  onMessage,
};
