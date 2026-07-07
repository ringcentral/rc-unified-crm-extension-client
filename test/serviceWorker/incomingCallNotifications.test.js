import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.ts');
  return {
    onMessage: chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0],
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
});
