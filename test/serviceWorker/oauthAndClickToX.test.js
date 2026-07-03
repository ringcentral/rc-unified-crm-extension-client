import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.js');
  return {
    onMessage: chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0],
    onAlarm: chrome.alarms.onAlarm.addListener.mock.calls.at(-1)[0],
  };
}

describe('service worker OAuth and click-to-X flows', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(chrome.windows.create).mockReset().mockResolvedValue({ id: 31 });
    vi.mocked(chrome.windows.get).mockReset().mockResolvedValue({
      id: 11,
      state: 'normal',
      focused: true,
      width: 450,
      height: 848,
    });
    vi.mocked(chrome.windows.update).mockReset().mockResolvedValue({ id: 11 });
    vi.mocked(chrome.windows.remove).mockReset().mockResolvedValue();
    vi.mocked(chrome.tabs.query).mockReset().mockResolvedValue([]);
    vi.mocked(chrome.runtime.sendMessage).mockReset().mockResolvedValue({ result: 'ok' });
    vi.mocked(chrome.alarms.create).mockReset();
  });

  it('opens RingCentral OAuth windows and polls for redirect callback URLs', async () => {
    const { onMessage, onAlarm } = await loadServiceWorkerListeners();
    const sendResponse = vi.fn();

    onMessage({
      type: 'openRCOAuthWindow',
      oAuthUri: 'https://login.example/oauth',
    }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalledWith({
        url: 'https://login.example/oauth',
        type: 'popup',
        width: 600,
        height: 600,
      });
    });
    expect(readStorage().loginWindowInfo).toEqual({
      platform: 'rc',
      id: 31,
    });
    await vi.waitFor(() => {
      expect(chrome.alarms.create).toHaveBeenCalledWith('oauthCheck', expect.objectContaining({
        when: expect.any(Number),
      }));
    });

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { url: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html?code=abc' },
    ]);
    await onAlarm();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'oauthCallBack',
      platform: 'rc',
      callbackUri: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html?code=abc',
    });
    expect(chrome.windows.remove).toHaveBeenCalledWith(31);
    expect(readStorage()).not.toHaveProperty('loginWindowInfo');
  });

  it('caches the latest cold-start click-to-X request and returns it once', async () => {
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'c2schedule',
      phoneNumber: '+16505550100',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalled();
    });

    const firstResponse = vi.fn();
    onMessage({ type: 'checkForClickToXCache' }, {}, firstResponse);
    expect(firstResponse).toHaveBeenCalledWith(expect.objectContaining({
      type: 'c2schedule',
      phoneNumber: '+16505550100',
      at: expect.any(Number),
    }));

    const secondResponse = vi.fn();
    onMessage({ type: 'checkForClickToXCache' }, {}, secondResponse);
    expect(secondResponse).toHaveBeenCalledWith(null);
  });

  it('forwards click-to-X directly when the popup already exists', async () => {
    seedStorage({ popupWindowId: 11 });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'c2sms',
      phoneNumber: '+16505550200',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'c2sms',
        phoneNumber: '+16505550200',
      });
    });
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });
});
