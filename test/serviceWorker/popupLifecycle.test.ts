import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadServiceWorkerListeners() {
  vi.resetModules();
  await import('../../src/sw.ts');
  return {
    onMessage: chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0],
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
});
