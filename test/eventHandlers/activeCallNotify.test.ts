import userCore from '../../src/core/user.ts';
import contactCore from '../../src/core/contact.ts';
import logCore from '../../src/core/log.ts';
import logPage from '../../src/components/logPage.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { cacheLogPageData, logPageFormDataDefaulting } from '../../src/lib/logUtil.ts';
import { responseMessage } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/user.ts', () => ({
  default: {
    getIncomingCallPop: vi.fn(),
    getOutgoingCallPop: vi.fn(),
    getCallPopMultiMatchBehavior: vi.fn(),
    getCallPopSetting: vi.fn(),
  },
}));

vi.mock('../../src/core/contact.ts', () => ({
  default: {
    getContact: vi.fn(),
    openContactPage: vi.fn(),
  },
}));

vi.mock('../../src/core/log.ts', () => ({
  default: {
    uploadCacheNote: vi.fn(),
    getCachedNote: vi.fn(),
  },
}));

vi.mock('../../src/components/logPage.ts', () => ({
  default: {
    getLogPageRender: vi.fn(),
  },
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/lib/logUtil.ts', () => ({
  logPageFormDataDefaulting: vi.fn(),
  cacheLogPageData: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  responseMessage: vi.fn(),
}));

async function loadActiveCallHandler() {
  vi.resetModules();
  return loadModule('../../src/eventHandlers/rc-active-call-notify.ts');
}

function setting<T>(value: T) {
  return { value, readOnly: false, readOnlyReason: '' };
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
      },
    },
  };
}

describe('rc-active-call-notify event handler', () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockReset().mockResolvedValue(manifest());
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(contactCore.getContact).mockReset().mockResolvedValue({
      matched: true,
      contactInfo: [{ id: 'contact-1', name: 'Jane Smith', type: 'Lead' }],
    });
    vi.mocked(contactCore.openContactPage).mockReset();
    vi.mocked(userCore.getIncomingCallPop).mockReset().mockReturnValue(setting('onFirstRing'));
    vi.mocked(userCore.getOutgoingCallPop).mockReset().mockReturnValue(setting('off'));
    vi.mocked(userCore.getCallPopMultiMatchBehavior).mockReset().mockReturnValue(setting('prompt'));
    vi.mocked(userCore.getCallPopSetting).mockReset().mockReturnValue(setting(true));
    vi.mocked(logCore.uploadCacheNote).mockReset();
    vi.mocked(logCore.getCachedNote).mockReset().mockResolvedValue('cached note');
    vi.mocked(logPage.getLogPageRender).mockReset().mockReturnValue({ id: 'callLogPage' });
    vi.mocked(cacheLogPageData).mockReset();
    vi.mocked(logPageFormDataDefaulting).mockReset().mockImplementation(async ({ targetPage }) => ({
      ...targetPage,
      defaulted: true,
    }));
    vi.mocked(responseMessage).mockReset();
  });

  it('handles inbound ringing by setting ongoing-call state and opening the matched contact on first ring', async () => {
    seedStorage({ userSettings: {} });
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-1',
        call: {
          telephonyStatus: 'Ringing',
          direction: 'Inbound',
          queueCall: true,
          sessionId: 'session-1',
          telephonySessionId: 'telephony-1',
          from: { phoneNumber: '+16505550100' },
          to: { phoneNumber: '+18005550100' },
        },
      },
    });

    expect(readStorage().hasOngoingCall).toBe(true);
    expect(readStorage()['is-call-queue-session-1'].isQueue).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'incomingCallRinging',
      callId: 'telephony-1',
      telephonySessionId: 'telephony-1',
      sessionId: 'session-1',
      phoneNumber: '+16505550100',
      callerName: 'Jane Smith',
    });
    expect(contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550100',
      multiContactMatchBehavior: 'prompt',
      fromCallPop: true,
    });
  });

  it('builds and navigates to a call log page when a final inbound call ends', async () => {
    seedStorage({
      userSettings: {},
      implementedInterfaces: {
        cacheCallNote: true,
        findContactWithName: true,
      },
    });
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-2',
        call: {
          telephonyStatus: 'NoCall',
          terminationType: 'final',
          direction: 'Inbound',
          sessionId: 'session-2',
          telephonySessionId: 'telephony-2',
          from: { phoneNumber: '+16505550200' },
          to: { phoneNumber: '+18005550100' },
        },
      },
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'incomingCallResolved',
      callId: 'telephony-2',
      telephonySessionId: 'telephony-2',
      sessionId: 'session-2',
      phoneNumber: '+16505550200',
      callerName: 'Jane Smith',
    });
    expect(logCore.uploadCacheNote).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      sessionId: 'session-2',
    });
    expect(cacheLogPageData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-2',
      logType: 'Call',
      triggerType: 'createLog',
      platformName: 'salesforce',
      direction: 'Inbound',
      contactInfo: [{ id: 'contact-1', name: 'Jane Smith', type: 'Lead' }],
      logInfo: {
        note: 'cached note',
        subject: 'Inbound Call from Jane Smith',
      },
    }));
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-2',
      logType: 'Call',
      triggerType: 'createLog',
      contactPhoneNumber: '+16505550200',
      useContactSearch: true,
    }));
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-update-call-log-page',
        page: { id: 'callLogPage', defaulted: true },
      },
      targetOrigin: '*',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: { type: 'rc-adapter-navigate-to', path: '/log/call/session-2' },
      targetOrigin: '*',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-2'],
      },
      targetOrigin: '*',
    });
    expect(readStorage()['call-log-data-ready-session-2'].isReady).toBe(false);
  });

  it('opens outbound call-pop when outgoing pop is configured for answer', async () => {
    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: true },
      },
      implementedInterfaces: {},
    });
    vi.mocked(userCore.getOutgoingCallPop).mockReturnValue(setting('onAnswer'));
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-3',
        call: {
          telephonyStatus: 'CallConnected',
          direction: 'Outbound',
          sessionId: 'session-3',
          telephonySessionId: 'telephony-3',
          from: { phoneNumber: '+18005550100' },
          to: { phoneNumber: '+16505550300' },
        },
      },
    });

    expect(window.postMessage).toHaveBeenCalledWith({
      type: 'rc-expandable-call-note-open',
      sessionId: 'session-3',
    }, '*');
    expect(contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550300',
      multiContactMatchBehavior: 'prompt',
      fromCallPop: true,
    });
    expect(cacheLogPageData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-3',
      direction: 'Outbound',
      logInfo: {
        subject: 'Outbound Call to Jane Smith',
        note: '',
      },
    }));
  });

  it('opens inbound call-pop on answer and skips transferred-on-hold calls', async () => {
    seedStorage({
      userSettings: {},
      implementedInterfaces: {},
    });
    vi.mocked(userCore.getIncomingCallPop).mockReturnValue(setting('onAnswer'));
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-inbound-answer',
        call: {
          telephonyStatus: 'CallConnected',
          direction: 'Inbound',
          sessionId: 'session-answer',
          telephonySessionId: 'telephony-answer',
          from: { phoneNumber: '+16505550600' },
          to: { phoneNumber: '+18005550100' },
        },
      },
    });

    expect(contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550600',
      multiContactMatchBehavior: 'prompt',
      fromCallPop: true,
    });

    const popupContext = { transferOnHold: 'telephony-transfer' };
    await handler.onEvent({
      popupContext,
      data: {
        requestId: 'request-inbound-transfer',
        call: {
          telephonyStatus: 'CallConnected',
          direction: 'Inbound',
          sessionId: 'session-transfer',
          telephonySessionId: 'telephony-transfer',
          from: { phoneNumber: '+16505550700' },
          to: { phoneNumber: '+18005550100' },
        },
      },
    });

    expect(popupContext.transferOnHold).toBe('');
    expect(contactCore.openContactPage).not.toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550700',
    }));
  });

  it('skips outbound answer call-pop for transferred-on-hold calls', async () => {
    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: true },
      },
      implementedInterfaces: {},
    });
    vi.mocked(userCore.getOutgoingCallPop).mockReturnValue(setting('onAnswer'));
    const handler = await loadActiveCallHandler();
    const popupContext = { transferOnHold: 'telephony-transfer-out' };

    await handler.onEvent({
      popupContext,
      data: {
        requestId: 'request-outbound-transfer',
        call: {
          telephonyStatus: 'CallConnected',
          direction: 'Outbound',
          sessionId: 'session-transfer-out',
          telephonySessionId: 'telephony-transfer-out',
          from: { phoneNumber: '+18005550100' },
          to: { phoneNumber: '+16505550800' },
        },
      },
    });

    expect(popupContext.transferOnHold).toBe('');
    expect(contactCore.openContactPage).not.toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550800',
    }));
    expect(cacheLogPageData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-transfer-out',
    }));
  });

  it('opens outbound call-pop when outgoing pop is configured for first ring', async () => {
    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: true },
      },
      implementedInterfaces: {},
    });
    vi.mocked(userCore.getOutgoingCallPop).mockReturnValue(setting('onFirstRing'));
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-4',
        call: {
          telephonyStatus: 'Ringing',
          direction: 'Outbound',
          sessionId: 'session-4',
          telephonySessionId: 'telephony-4',
          from: { phoneNumber: '+18005550100' },
          to: { phoneNumber: '+16505550400' },
        },
      },
    });

    expect(readStorage().hasOngoingCall).toBe(true);
    expect(contactCore.openContactPage).toHaveBeenLastCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550400',
      multiContactMatchBehavior: 'prompt',
        fromCallPop: true,
      });
  });

  it('defaults outbound final call log pages', async () => {
    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: true },
      },
      implementedInterfaces: {},
    });
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-5',
        call: {
          telephonyStatus: 'NoCall',
          terminationType: 'final',
          direction: 'Outbound',
          sessionId: 'session-5',
          telephonySessionId: 'telephony-5',
          from: { phoneNumber: '+18005550100' },
          to: { phoneNumber: '+16505550500' },
        },
      },
    });

    expect(logPageFormDataDefaulting).toHaveBeenCalledWith({
      platform: manifest().platforms.salesforce,
      targetPage: { id: 'callLogPage' },
      caseType: 'outboundCall',
      logType: 'callLog',
    });
  });

  it('acknowledges final extension-number calls without opening a log page when extension logging is disabled', async () => {
    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: false },
      },
    });
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-6',
        call: {
          telephonyStatus: 'NoCall',
          terminationType: 'final',
          direction: 'Outbound',
          sessionId: 'session-6',
          telephonySessionId: 'telephony-6',
          from: { phoneNumber: '+18005550100' },
          to: { extensionNumber: '101' },
        },
      },
    });

    expect(contactCore.getContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '101',
      isExtensionNumber: true,
    }));
    expect(responseMessage).toHaveBeenCalledWith('request-6', { data: 'ok' });
    expect(logPage.getLogPageRender).not.toHaveBeenCalled();
  });

  it('ignores non-final no-call updates', async () => {
    seedStorage({ userSettings: {} });
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-non-final',
        call: {
          telephonyStatus: 'NoCall',
          terminationType: 'intermediate',
          direction: 'Inbound',
          sessionId: 'session-non-final',
          telephonySessionId: 'telephony-non-final',
          from: { phoneNumber: '+16505550900' },
          to: { phoneNumber: '+18005550100' },
        },
      },
    });

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'incomingCallResolved',
    }));
    expect(getWidgetPostMessages()).toEqual([]);
    expect(cacheLogPageData).not.toHaveBeenCalled();
  });

  it('finalizes call data without opening the log page when call auto-popup is disabled', async () => {
    seedStorage({
      userSettings: {},
      implementedInterfaces: {},
    });
    vi.mocked(userCore.getCallPopSetting).mockReturnValue(setting(false));
    const handler = await loadActiveCallHandler();

    await handler.onEvent({
      popupContext: {},
      data: {
        requestId: 'request-no-popup',
        call: {
          telephonyStatus: 'NoCall',
          terminationType: 'final',
          direction: 'Outbound',
          sessionId: 'session-no-popup',
          telephonySessionId: 'telephony-no-popup',
          from: { phoneNumber: '+18005550100' },
          to: { phoneNumber: '+16505551000' },
        },
      },
    });

    expect(logPage.getLogPageRender).not.toHaveBeenCalled();
    expect(readStorage()['call-log-data-ready-session-no-popup'].isReady).toBe(false);
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-no-popup'],
      },
      targetOrigin: '*',
    });
  });
});
