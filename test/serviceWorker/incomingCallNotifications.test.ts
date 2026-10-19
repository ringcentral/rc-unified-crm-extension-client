import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.ts');
  return {
    onMessage: chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0],
    onClicked: chrome.notifications.onClicked.addListener.mock.calls.at(-1)[0],
    onButtonClicked: chrome.notifications.onButtonClicked.addListener.mock.calls.at(-1)[0],
  };
}

describe('service worker incoming call notifications', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(chrome.windows.create).mockReset().mockResolvedValue({ id: 5 });
    vi.mocked(chrome.windows.get).mockReset().mockResolvedValue({
      id: 5,
      state: 'minimized',
      focused: false,
      width: 450,
      height: 848,
    });
    vi.mocked(chrome.windows.update).mockReset().mockResolvedValue({ id: 5 });
    vi.mocked(chrome.notifications.create).mockClear();
    vi.mocked(chrome.notifications.clear).mockClear();
    vi.mocked(chrome.runtime.sendMessage).mockReset().mockResolvedValue({ result: 'ok' });
  });

  it('deduplicates incoming call notifications while drawing attention to an unfocused popup', async () => {
    seedStorage({ popupWindowId: 5 });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'incomingCallRinging',
      callId: 'telephony-1',
      callerName: 'Jane Smith',
      phoneNumber: '+16505550100',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'incoming-call-telephony-1',
        expect.objectContaining({
          type: 'basic',
          title: 'Incoming call',
          message: 'Call from Jane Smith',
          buttons: [{ title: 'Answer' }, { title: 'Ignore' }],
        }),
        expect.any(Function),
      );
    });
    expect(chrome.windows.update).toHaveBeenCalledWith(5, { drawAttention: true });
    expect(Object.keys(readStorage().recentIncomingCallNotificationIds)).toEqual(['telephony-1']);

    onMessage({
      type: 'incomingCallRinging',
      callId: 'telephony-1',
      callerName: 'Jane Smith',
      phoneNumber: '+16505550100',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.update).toHaveBeenCalledTimes(4);
    });
    expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
  });

  it('uses fallback call identifiers and caller labels for incoming notifications', async () => {
    seedStorage({ popupWindowId: 5 });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'incomingCallRinging',
      telephonySessionId: 'telephony-fallback',
      phoneNumber: '+16505550199',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'incoming-call-telephony-fallback',
        expect.objectContaining({
          message: 'Call from +16505550199',
        }),
        expect.any(Function),
      );
    });

    vi.mocked(chrome.notifications.create).mockClear();
    onMessage({
      type: 'incomingCallRinging',
      sessionId: 'session-fallback',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'incoming-call-session-fallback',
        expect.objectContaining({
          message: 'Call from Unknown caller',
        }),
        expect.any(Function),
      );
    });
  });

  it('opens the popup without notification when no popup exists and skips notification for focused popups', async () => {
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'incomingCallRinging',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalled();
    });
    expect(chrome.notifications.create).not.toHaveBeenCalled();

    seedStorage({ popupWindowId: 5 });
    vi.mocked(chrome.windows.create).mockClear();
    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 5,
      state: 'normal',
      focused: true,
      width: 450,
      height: 848,
    });

    onMessage({
      type: 'incomingCallRinging',
      phoneNumber: '+16505550999',
    }, {}, vi.fn());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.windows.create).not.toHaveBeenCalled();
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it('drops expired incoming notification cache entries before creating a new notification', async () => {
    seedStorage({
      popupWindowId: 5,
      recentIncomingCallNotificationIds: {
        expired: Date.now() - 1000,
        active: Date.now() + 1000,
      },
    });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'incomingCallRinging',
      callId: 'new-call',
      phoneNumber: '+16505550123',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'incoming-call-new-call',
        expect.any(Object),
        expect.any(Function),
      );
    });
    expect(readStorage().recentIncomingCallNotificationIds).toEqual(expect.objectContaining({
      active: expect.any(Number),
      'new-call': expect.any(Number),
    }));
    expect(readStorage().recentIncomingCallNotificationIds).not.toHaveProperty('expired');
  });

  it('answers and clears incoming call notifications from the notification button', async () => {
    const { onButtonClicked } = await loadServiceWorkerListeners();

    onButtonClicked('incoming-call-telephony-2', 0);

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'controlCall',
        callAction: 'answer',
      });
    });
    await vi.waitFor(() => {
      expect(chrome.notifications.clear).toHaveBeenCalledWith(
        'incoming-call-telephony-2',
        expect.any(Function),
      );
    });
  });

  it('ignores non-incoming notification actions and clears ignored calls', async () => {
    const { onButtonClicked, onClicked } = await loadServiceWorkerListeners();

    onButtonClicked('other-notification', 0);
    onClicked('other-notification');

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(chrome.notifications.clear).not.toHaveBeenCalled();

    onButtonClicked('incoming-call-telephony-ignored', 1);

    await vi.waitFor(() => {
      expect(chrome.notifications.clear).toHaveBeenCalledWith(
        'incoming-call-telephony-ignored',
        expect.any(Function),
      );
    });
  });

  it('opens the popup when an incoming notification body is clicked', async () => {
    const { onClicked } = await loadServiceWorkerListeners();

    onClicked('incoming-call-telephony-clicked');

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(chrome.notifications.clear).toHaveBeenCalledWith(
        'incoming-call-telephony-clicked',
        expect.any(Function),
      );
    });
  });

  it('clears resolved incoming call notifications by derived notification id', async () => {
    const { onMessage } = await loadServiceWorkerListeners();
    const sendResponse = vi.fn();

    onMessage({
      type: 'incomingCallResolved',
      callId: 'telephony-3',
    }, {}, sendResponse);

    await vi.waitFor(() => {
      expect(chrome.notifications.clear).toHaveBeenCalledWith(
        'incoming-call-telephony-3',
        expect.any(Function),
      );
    });
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    });
  });

  it('clears all active incoming notifications when a resolved event has no call id', async () => {
    vi.mocked(chrome.notifications.getAll).mockImplementationOnce((callback) => {
      const notifications = {
        'incoming-call-a': {},
        'incoming-call-b': {},
        unrelated: {},
      };
      callback?.(notifications);
      return Promise.resolve(notifications);
    });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'incomingCallResolved' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.notifications.clear).toHaveBeenCalledWith('incoming-call-a', expect.any(Function));
      expect(chrome.notifications.clear).toHaveBeenCalledWith('incoming-call-b', expect.any(Function));
    });
    expect(chrome.notifications.clear).not.toHaveBeenCalledWith('unrelated', expect.any(Function));
  });
});
