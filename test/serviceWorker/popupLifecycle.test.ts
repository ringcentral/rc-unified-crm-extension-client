import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.ts');
  return {
    onMessage: chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0],
    onExternalMessage: chrome.runtime.onMessageExternal.addListener.mock.calls.at(-1)[0],
    onTabUpdated: chrome.tabs.onUpdated.addListener.mock.calls.at(-1)[0],
    onFocusChanged: chrome.windows.onFocusChanged.addListener.mock.calls.at(-1)[0],
    onRemoved: chrome.windows.onRemoved.addListener.mock.calls.at(-1)[0],
    onBoundsChanged: chrome.windows.onBoundsChanged.addListener.mock.calls.at(-1)[0],
  };
}

describe('service worker popup lifecycle', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(chrome.windows.create).mockReset().mockResolvedValue({ id: 7 });
    vi.mocked(chrome.windows.get).mockReset().mockResolvedValue({
      id: 7,
      state: 'normal',
      focused: true,
      width: 450,
      height: 848,
    });
    vi.mocked(chrome.windows.update).mockReset().mockResolvedValue({ id: 7 });
    vi.mocked(chrome.windows.remove).mockReset().mockResolvedValue();
  });

  it('opens a popup window with persisted geometry and stores the popup id', async () => {
    seedStorage({
      extensionWindowStatus: {
        width: 520,
        height: 760,
        left: 100,
        top: 80,
      },
      customCrmManifest: {
        platforms: {
          salesforce: {
            auth: {
              oauth: {
                redirectUri: 'https://crm.example/oauth/callback',
              },
            },
          },
        },
      },
      'platform-info': {
        platformName: 'salesforce',
      },
    });
    const { onMessage } = await loadServiceWorkerListeners();
    const sendResponse = vi.fn();

    onMessage({ type: 'openPopupWindow' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'popup',
        focused: true,
        width: 520,
        height: 760,
        left: 100,
        top: 80,
        url: expect.stringContaining('redirectUri=https://crm.example/oauth/callback'),
      }));
    });
    expect(readStorage().popupWindowId).toBe(7);
  });

  it('opens a popup and forwards optional navigation requests', async () => {
    const { onMessage } = await loadServiceWorkerListeners();
    const sendResponse = vi.fn();

    onMessage({ type: 'openPopupWindow', navigationPath: '/settings' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'navigate',
      path: '/settings',
    });
    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalled();
    });
  });

  it('opens maximized popup windows without persisted geometry', async () => {
    seedStorage({
      extensionWindowStatus: {
        state: 'maximized',
        width: 520,
        height: 760,
      },
    });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'openPopupWindow' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'popup',
        focused: true,
        state: 'maximized',
      }));
    });
    expect(chrome.windows.create).not.toHaveBeenCalledWith(expect.objectContaining({
      width: 520,
      height: 760,
    }));
  });

  it('opens fullscreen popup windows and focuses already-open normal popups without restoring state', async () => {
    seedStorage({
      extensionWindowStatus: {
        state: 'fullscreen',
        width: 520,
        height: 760,
      },
    });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'openPopupWindow' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
        state: 'fullscreen',
      }));
    });

    seedStorage({ popupWindowId: 9 });
    vi.mocked(chrome.windows.create).mockClear();
    vi.mocked(chrome.windows.update).mockClear();
    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 9,
      state: 'normal',
      focused: true,
      width: 450,
      height: 848,
    });

    onMessage({ type: 'openPopupWindow' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.update).toHaveBeenCalledWith(9, { focused: true });
    });
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('falls back to default popup bounds when persisted position is invalid', async () => {
    seedStorage({
      extensionWindowStatus: {
        width: 520,
        height: 760,
        left: -9999,
        top: -9999,
      },
    });
    vi.mocked(chrome.windows.create)
      .mockRejectedValueOnce(new Error('invalid bounds'))
      .mockResolvedValueOnce({ id: 8 });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'openPopupWindow' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenLastCalledWith(expect.objectContaining({
        width: 450,
        height: 848,
        left: 50,
        top: 50,
      }));
    });
    expect(readStorage().popupWindowId).toBe(8);
  });

  it('falls back to a new popup when the stored popup id no longer exists', async () => {
    seedStorage({ popupWindowId: 99 });
    vi.mocked(chrome.windows.get).mockRejectedValueOnce(new Error('missing window'));
    vi.mocked(chrome.windows.create).mockResolvedValueOnce({ id: 10 });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'openPopupWindow' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'popup',
        focused: true,
      }));
    });
    expect(readStorage().popupWindowId).toBe(10);
  });

  it('focuses an existing minimized popup instead of opening another window', async () => {
    seedStorage({ popupWindowId: 9 });
    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 9,
      state: 'minimized',
      focused: false,
      width: 450,
      height: 848,
    });
    const { onMessage } = await loadServiceWorkerListeners();

    onMessage({ type: 'openPopupWindow' }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.update).toHaveBeenCalledWith(9, {
        focused: true,
        state: 'normal',
      });
    });
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('clears draw attention when the popup window receives focus', async () => {
    seedStorage({ popupWindowId: 9 });
    const { onFocusChanged } = await loadServiceWorkerListeners();

    await onFocusChanged(8);
    expect(chrome.windows.update).not.toHaveBeenCalled();

    await onFocusChanged(9);
    expect(chrome.windows.update).toHaveBeenCalledWith(9, { drawAttention: false });

    vi.mocked(chrome.windows.update).mockRejectedValueOnce(new Error('focus update failed'));
    await expect(onFocusChanged(9)).resolves.toBeUndefined();
  });

  it('expands and restores the popup width when the side widget opens and closes', async () => {
    seedStorage({ popupWindowId: 15 });
    const { onMessage } = await loadServiceWorkerListeners();

    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 15,
      state: 'normal',
      focused: true,
      width: 450,
      height: 848,
    });

    onMessage({ type: 'sideWidgetOpen', opened: true }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.update).toHaveBeenCalledWith(15, { width: 750 });
    });

    vi.mocked(chrome.windows.get).mockResolvedValueOnce({
      id: 15,
      state: 'normal',
      focused: true,
      width: 750,
      height: 848,
    });

    onMessage({ type: 'sideWidgetOpen', opened: false }, {}, vi.fn());

    await vi.waitFor(() => {
      expect(chrome.windows.update).toHaveBeenLastCalledWith(15, { width: 450 });
    });
  });

  it('cleans popup state when the popup window closes and persists bounds changes', async () => {
    seedStorage({
      popupWindowId: 12,
      errorLogRecordingStatus: { active: true },
    });
    const { onRemoved, onBoundsChanged } = await loadServiceWorkerListeners();

    await onBoundsChanged({
      id: 12,
      width: 700,
      height: 900,
      left: 20,
      top: 30,
    });
    expect(readStorage().extensionWindowStatus).toMatchObject({
      id: 12,
      width: 700,
      height: 900,
    });

    await onRemoved(12);

    expect(readStorage()).not.toHaveProperty('popupWindowId');
    expect(readStorage()).not.toHaveProperty('errorLogRecordingStatus');
  });

  it('responds to external installation probes and tracks RingSense App Connect referrals', async () => {
    const { onExternalMessage, onTabUpdated } = await loadServiceWorkerListeners();
    const installResponse = vi.fn();
    const ignoredResponse = vi.fn();

    onExternalMessage({ action: 'isInstalled' }, {}, installResponse);
    onExternalMessage({ action: 'other' }, {}, ignoredResponse);

    expect(installResponse).toHaveBeenCalledWith({ isInstalled: true });
    expect(ignoredResponse).not.toHaveBeenCalled();

    onTabUpdated(1, { url: 'https://example.com/ringsense.html?ref=AppConnect' }, {});
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    onTabUpdated(1, {
      url: 'https://app.ringcentral.com/ringsense.html?ref=AppConnect',
    }, {});

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ringsenseRefTrack',
      });
    });
  });
});
