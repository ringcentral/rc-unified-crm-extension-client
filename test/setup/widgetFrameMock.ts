import { vi } from 'vitest';

let frameElement;
let frameWindow;

export function installWidgetFrameMock() {
  document.body.innerHTML = '';
  frameElement = document.createElement('div');
  frameElement.id = 'rc-widget-adapter-frame';
  frameWindow = {
    postMessage: vi.fn(),
    app: {
      modules: {
        ContactMatcher: {
          data: {},
        },
      },
    },
  };
  Object.defineProperty(frameElement, 'contentWindow', {
    configurable: true,
    value: frameWindow,
  });
  document.body.appendChild(frameElement);
  return frameWindow;
}

export function getWidgetFrameWindow() {
  return frameWindow;
}

export function getWidgetPostMessages() {
  return frameWindow?.postMessage.mock.calls.map(([message, targetOrigin]) => ({
    message,
    targetOrigin,
  })) ?? [];
}

export function resetWidgetFrameMock() {
  installWidgetFrameMock();
}
