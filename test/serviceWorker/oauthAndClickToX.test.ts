import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.ts');
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
    vi.mocked(chrome.tabs.sendMessage).mockReset().mockResolvedValue({ result: 'ok' });
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

  it('ignores OAuth alarms without state and re-arms while waiting for redirect URLs', async () => {
    const { onAlarm } = await loadServiceWorkerListeners();

    await onAlarm();
    expect(chrome.tabs.query).not.toHaveBeenCalled();

    seedStorage({
      loginWindowInfo: {
        platform: 'thirdParty',
        id: 44,
      },
    });
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([]);
    await onAlarm();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { url: 'https://crm.example/oauth/continue' },
    ]);
    await onAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledWith('oauthCheck', expect.objectContaining({
      when: expect.any(Number),
    }));
    expect(readStorage().loginWindowInfo).toEqual({
      platform: 'thirdParty',
      id: 44,
    });
  });

  it('opens third-party OAuth windows with callback polling state', async () => {
    const { onMessage } = await loadServiceWorkerListeners();
    const sendResponse = vi.fn();

    onMessage({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://crm.example/oauth',
    }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalledWith({
        url: 'https://crm.example/oauth',
        type: 'popup',
        width: 600,
        height: 600,
      });
    });
    expect(readStorage().loginWindowInfo).toEqual({
      platform: 'thirdParty',
      id: 31,
    });
    await vi.waitFor(() => {
      expect(chrome.alarms.create).toHaveBeenCalledWith('oauthCheck', expect.objectContaining({
        when: expect.any(Number),
      }));
    });
  });

  it('acknowledges OAuth window requests that do not provide a URI', async () => {
    const { onMessage } = await loadServiceWorkerListeners();
    const rcResponse = vi.fn();
    const thirdPartyResponse = vi.fn();

    onMessage({ type: 'openRCOAuthWindow' }, {}, rcResponse);
    onMessage({ type: 'openThirdPartyAuthWindow' }, {}, thirdPartyResponse);

    expect(rcResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(thirdPartyResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(chrome.windows.create).not.toHaveBeenCalledWith(expect.objectContaining({
      width: 600,
      height: 600,
    }));
  });

  it('relays Pipedrive direct-page callback state between installation page and popup', async () => {
    const { onMessage } = await loadServiceWorkerListeners();
    const openResponse = vi.fn();

    onMessage({
      type: 'openPopupWindowOnPipedriveDirectPage',
      platform: 'pipedrive',
      hostname: 'acme.pipedrive.com',
    }, { tab: { id: 42 } }, openResponse);

    expect(openResponse).toHaveBeenCalledWith({ result: 'ok' });
    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { action: 'needCallbackUri' });
    });
    expect(readStorage()['platform-info']).toEqual({
      platformName: 'pipedrive',
      hostname: 'acme.pipedrive.com',
    });

    const callbackResponse = vi.fn();
    onMessage({
      type: 'pipedriveCallbackUri',
      callbackUri: 'https://pipedrive.example/callback?code=abc',
    }, {}, callbackResponse);

    expect(callbackResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'pipedriveCallbackUri',
      pipedriveCallbackUri: 'https://pipedrive.example/callback?code=abc',
    });

    const requestResponse = vi.fn();
    onMessage({ type: 'popupWindowRequestPipedriveCallbackUri' }, {}, requestResponse);

    expect(requestResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'pipedriveCallbackUri',
      pipedriveCallbackUri: 'https://pipedrive.example/callback?code=abc',
    });

    const doneResponse = vi.fn();
    onMessage({ type: 'pipedriveAltAuthDone' }, {}, doneResponse);

    expect(doneResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(42, { action: 'pipedriveAltAuthDone' });
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

  it('forwards click-to-X when focusing the existing popup fails', async () => {
    seedStorage({ popupWindowId: 12 });
    vi.mocked(chrome.windows.get).mockRejectedValueOnce(new Error('missing popup'));
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'c2d',
      phoneNumber: '+16505550300',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'c2d',
        phoneNumber: '+16505550300',
      });
    });
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('restores minimized popups before forwarding click-to-X requests', async () => {
    seedStorage({ popupWindowId: 11 });
    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 11,
      state: 'minimized',
      focused: false,
      width: 450,
      height: 848,
    });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({
      type: 'c2d',
      phoneNumber: '+16505550400',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.update).toHaveBeenCalledWith(11, { state: 'normal' });
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'c2d',
      phoneNumber: '+16505550400',
    });
  });

  it('does not resize side widget windows without a popup or outside resize thresholds', async () => {
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'sideWidgetOpen', opened: true }, {}, vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.windows.get).not.toHaveBeenCalled();

    seedStorage({ popupWindowId: 11 });
    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 11,
      state: 'normal',
      focused: true,
      width: 650,
      height: 848,
    });
    onMessage({ type: 'sideWidgetOpen', opened: true }, {}, vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.windows.update).not.toHaveBeenCalledWith(11, { width: 950 });

    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 11,
      state: 'normal',
      focused: true,
      width: 500,
      height: 848,
    });
    onMessage({ type: 'sideWidgetOpen', opened: false }, {}, vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.windows.update).not.toHaveBeenCalledWith(11, { width: 200 });
  });
});
