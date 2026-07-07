import contactCore from '../../src/core/contact.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

vi.mock('../../src/core/contact.ts', () => ({
  default: {
    getLocalCachedContact: vi.fn(),
  },
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadC2smsHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/c2sms.ts');
}

describe('c2sms message handler', () => {
  beforeEach(() => {
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(contactCore.getLocalCachedContact).mockReset();
  });

  it('uses the cached contact name when opening a conversation', async () => {
    vi.mocked(contactCore.getLocalCachedContact).mockReturnValueOnce([
      { id: 'contact-1', name: 'Jane Smith' },
    ]);
    const sendResponse = vi.fn();
    const handler = await loadC2smsHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550100' },
      sendResponse,
    });

    expect(contactCore.getLocalCachedContact).toHaveBeenCalledWith({
      phoneNumber: '+16505550100',
      platformName: 'salesforce',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+16505550100',
        conversation: true,
        recipient: { name: 'Jane Smith' },
      },
      targetOrigin: '*',
    });
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('opens SMS without a recipient when no contact is cached', async () => {
    vi.mocked(contactCore.getLocalCachedContact).mockReturnValueOnce([]);
    const handler = await loadC2smsHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550199' },
      sendResponse: vi.fn(),
    });

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+16505550199',
        conversation: true,
        recipient: {},
      },
      targetOrigin: '*',
    });
  });
});
