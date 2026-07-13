import contactCore from '../../src/core/contact.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

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

  it('does not update the sender number when the shared-number setting is off', async () => {
    vi.mocked(contactCore.getLocalCachedContact).mockReturnValueOnce([]);
    seedStorage({
      userSettings: { clickToSMSFromSharedNumber: { value: false } },
      smsSenderNumbers: ['+18001112222', '+16505550001'],
      smsDefaultSenderNumber: '+16505550001',
    });
    const handler = await loadC2smsHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550199' },
      sendResponse: vi.fn(),
    });

    const messages = getWidgetPostMessages();
    expect(messages.some(({ message }) => message.type === 'rc-sms-settings-update')).toBe(false);
    expect(messages.at(-1).message.type).toBe('rc-adapter-new-sms');
  });

  it('overrides the sender to the shared number before opening SMS when enabled', async () => {
    vi.mocked(contactCore.getLocalCachedContact).mockReturnValueOnce([]);
    seedStorage({
      userSettings: { clickToSMSFromSharedNumber: { value: true } },
      smsSenderNumbers: ['+16505550001', '+18001112222'],
      smsDefaultSenderNumber: '+16505550001',
    });
    const handler = await loadC2smsHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550199' },
      sendResponse: vi.fn(),
    });

    const messages = getWidgetPostMessages();
    const updateIndex = messages.findIndex(({ message }) => message.type === 'rc-sms-settings-update');
    const newSmsIndex = messages.findIndex(({ message }) => message.type === 'rc-adapter-new-sms');
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(messages[updateIndex].message).toEqual({
      type: 'rc-sms-settings-update',
      senderNumber: '+18001112222',
    });
    // sender override must be sent before opening the compose page
    expect(updateIndex).toBeLessThan(newSmsIndex);
  });

  it('does not override the sender when only the direct number is available', async () => {
    vi.mocked(contactCore.getLocalCachedContact).mockReturnValueOnce([]);
    seedStorage({
      userSettings: { clickToSMSFromSharedNumber: { value: true } },
      smsSenderNumbers: ['+16505550001'],
      smsDefaultSenderNumber: '+16505550001',
    });
    const handler = await loadC2smsHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550199' },
      sendResponse: vi.fn(),
    });

    const messages = getWidgetPostMessages();
    expect(messages.some(({ message }) => message.type === 'rc-sms-settings-update')).toBe(false);
  });

  describe('pickSharedSenderNumber', () => {
    it('returns the first sender number that differs from the direct number', async () => {
      const handler = await loadC2smsHandler();
      expect(handler.pickSharedSenderNumber({
        senderNumbers: ['+16505550001', '+18001112222', '+18003334444'],
        directNumber: '+16505550001',
      })).toBe('+18001112222');
    });

    it('returns null when no shared number is available', async () => {
      const handler = await loadC2smsHandler();
      expect(handler.pickSharedSenderNumber({
        senderNumbers: ['+16505550001'],
        directNumber: '+16505550001',
      })).toBeNull();
      expect(handler.pickSharedSenderNumber({ senderNumbers: [], directNumber: '+16505550001' })).toBeNull();
      expect(handler.pickSharedSenderNumber({ senderNumbers: null, directNumber: '+16505550001' })).toBeNull();
    });

    it('treats every number as shared when no direct number is known', async () => {
      const handler = await loadC2smsHandler();
      expect(handler.pickSharedSenderNumber({
        senderNumbers: ['+18001112222'],
        directNumber: null,
      })).toBe('+18001112222');
    });
  });
});
