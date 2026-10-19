import adminCore from '../../src/core/admin.ts';
import accountSettingsPage from '../../src/components/admin/accountSettingsPage.ts';
import accountSettingsNavigation from '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/accountSettings.ts';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    getAccountData: vi.fn(),
  },
}));

vi.mock('../../src/components/admin/accountSettingsPage.ts', () => ({
  default: {
    getAccountSettingsPageRender: vi.fn(() => ({ id: 'accountSettingsPage' })),
  },
}));

describe('account settings navigation handler', () => {
  let windowPostMessage: ReturnType<typeof vi.spyOn>;
  let widgetPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    seedStorage({
      adminSettings: {
        userSettings: {
          callActivityType: { value: 'call' },
        },
      },
    });
    vi.mocked(adminCore.getAccountData).mockReset();
    vi.mocked(accountSettingsPage.getAccountSettingsPageRender).mockClear();
    widgetPostMessage = vi.fn();
    vi.spyOn(document, 'querySelector').mockReturnValue({
      contentWindow: { postMessage: widgetPostMessage },
    } as unknown as HTMLIFrameElement);
    windowPostMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  });

  it('shows loading until account settings data is loaded and the page is registered', async () => {
    vi.mocked(adminCore.getAccountData).mockResolvedValue({
      activityTypes: [{ const: 'call', title: 'Call' }],
    });

    await accountSettingsNavigation.onEvent({
      manifest: { serverUrl: 'https://server.example' },
      platform: {
        adminSettings: [{ accountDataKey: 'activityTypes' }],
      },
    });

    expect(windowPostMessage.mock.calls).toEqual([
      [{ type: 'rc-log-modal-loading-on' }, '*'],
      [{ type: 'rc-log-modal-loading-off' }, '*'],
    ]);
    expect(widgetPostMessage).toHaveBeenNthCalledWith(1, {
      type: 'rc-adapter-register-customized-page',
      page: { id: 'accountSettingsPage' },
    });
    expect(widgetPostMessage).toHaveBeenNthCalledWith(2, {
      type: 'rc-adapter-navigate-to',
      path: '/customized/accountSettingsPage',
    }, '*');
    expect(windowPostMessage.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(adminCore.getAccountData).mock.invocationCallOrder[0],
    );
    expect(widgetPostMessage.mock.invocationCallOrder[1]).toBeLessThan(
      windowPostMessage.mock.invocationCallOrder[1],
    );
  });

  it('turns loading off when loading account data fails', async () => {
    const error = new Error('Account data unavailable');
    vi.mocked(adminCore.getAccountData).mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await accountSettingsNavigation.onEvent({
      manifest: { serverUrl: 'https://server.example' },
      platform: {
        adminSettings: [{ accountDataKey: 'activityTypes' }],
      },
    });

    expect(consoleError).toHaveBeenCalledWith('Error getting account data options:', error);
    expect(windowPostMessage).toHaveBeenLastCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
    expect(accountSettingsPage.getAccountSettingsPageRender).toHaveBeenCalledWith(expect.objectContaining({
      accountDataOptions: {},
    }));
  });
});

