import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

async function loadC2dHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/c2d.ts');
}

describe('c2d message handler', () => {
  it('posts a new-call widget message and acknowledges the request', async () => {
    const sendResponse = vi.fn();
    const handler = await loadC2dHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550100' },
      sendResponse,
    });

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-call',
        phoneNumber: '+16505550100',
        toCall: true,
      },
      targetOrigin: '*',
    });
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });
});
