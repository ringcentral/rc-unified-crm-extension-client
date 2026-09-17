import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.ts');
  return {
    onMessage: chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0],
    onAlarm: chrome.alarms.onAlarm.addListener.mock.calls.at(-1)[0],
    onWindowRemoved: chrome.windows.onRemoved.addListener.mock.calls.at(-1)[0],
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
    vi.mocked(chrome.notifications.create).mockClear();
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
      redirectUri: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html',
    });
    await vi.waitFor(() => {
      expect(chrome.alarms.create).toHaveBeenCalledWith('oauthCheck', expect.objectContaining({
        when: expect.any(Number),
      }));
    });

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { url: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html?code=abc' },
    ]);
    await onAlarm({ name: 'oauthCheck' });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'oauthCallBack',
      platform: 'rc',
      callbackUri: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html?code=abc',
    });
    expect(chrome.windows.remove).toHaveBeenCalledWith(31);
    expect(readStorage()).not.toHaveProperty('loginWindowInfo');
  });

  it('ignores unrelated alarms and clears stale state when the OAuth window has no tabs', async () => {
    const { onAlarm } = await loadServiceWorkerListeners();

    await onAlarm({ name: 'unrelatedAlarm' });
    await onAlarm({ name: 'oauthCheck' });
    expect(chrome.tabs.query).not.toHaveBeenCalled();

    seedStorage({
      loginWindowInfo: {
        platform: 'thirdParty',
        id: 44,
        redirectUri: 'https://redirect.example/oauth',
        deadline: Date.now() + 60_000,
      },
    });
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([]);
    await onAlarm({ name: 'oauthCheck' });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(readStorage()).not.toHaveProperty('loginWindowInfo');
  });

  it('re-arms while a third-party OAuth window is waiting for its redirect URL', async () => {
    const { onAlarm } = await loadServiceWorkerListeners();

    seedStorage({
      loginWindowInfo: {
        platform: 'thirdParty',
        id: 44,
        redirectUri: 'https://redirect.example/oauth',
        deadline: Date.now() + 60_000,
      },
    });
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { url: 'https://crm.example/oauth/continue' },
    ]);
    await onAlarm({ name: 'oauthCheck' });
    expect(chrome.alarms.create).toHaveBeenCalledWith('oauthCheck', expect.objectContaining({
      when: expect.any(Number),
    }));
    expect(readStorage().loginWindowInfo).toEqual({
      platform: 'thirdParty',
      id: 44,
      redirectUri: 'https://redirect.example/oauth',
      deadline: expect.any(Number),
    });
  });

  it('closes timed-out third-party OAuth windows, clears state, and notifies the user', async () => {
    const { onAlarm } = await loadServiceWorkerListeners();
    seedStorage({
      loginWindowInfo: {
        platform: 'thirdParty',
        id: 45,
        redirectUri: 'https://redirect.example/oauth',
        deadline: Date.now() - 1,
      },
    });

    await onAlarm({ name: 'oauthCheck' });

    expect(chrome.windows.remove).toHaveBeenCalledWith(45);
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    expect(readStorage()).not.toHaveProperty('loginWindowInfo');
    expect(chrome.notifications.create).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'images/logo128.png',
      title: 'Connection timed out',
      message: 'CRM login did not complete. Please try Connect again.',
    });
  });

  it('clears OAuth polling state as soon as the login window is closed', async () => {
    const { onWindowRemoved } = await loadServiceWorkerListeners();
    seedStorage({
      loginWindowInfo: {
        platform: 'thirdParty',
        id: 46,
        redirectUri: 'https://redirect.example/oauth',
        deadline: Date.now() + 60_000,
      },
    });

    await onWindowRemoved(46);

    expect(readStorage()).not.toHaveProperty('loginWindowInfo');
    expect(chrome.notifications.create).not.toHaveBeenCalled();
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
      redirectUri: 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html',
      deadline: expect.any(Number),
    });
    await vi.waitFor(() => {
      expect(chrome.alarms.create).toHaveBeenCalledWith('oauthCheck', expect.objectContaining({
        when: expect.any(Number),
      }));
    });
  });

  it('persists and matches a connector-specific OAuth redirect URI', async () => {
    seedStorage({
      ['platform-info']: { platformName: 'zendesk' },
      customCrmManifest: {
        platforms: {
          zendesk: {
            auth: {
              oauth: { redirectUri: 'https://zendesk.example/oauth/callback' },
            },
          },
        },
      },
    });
    const { onMessage, onAlarm } = await loadServiceWorkerListeners();

    onMessage({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://zendesk.example/oauth/authorize',
    }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(readStorage().loginWindowInfo?.redirectUri).toBe('https://zendesk.example/oauth/callback');
    });
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { url: 'https://zendesk.example/oauth/callback?code=abc' },
    ]);

    await onAlarm({ name: 'oauthCheck' });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'oauthCallBack',
      platform: 'thirdParty',
      callbackUri: 'https://zendesk.example/oauth/callback?code=abc',
    }));
    expect(readStorage()).not.toHaveProperty('loginWindowInfo');
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
