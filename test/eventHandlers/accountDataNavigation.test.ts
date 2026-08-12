import accountDataPage from '../../src/components/admin/accountDataPage.ts';
import accountDataNavigation from '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/accountData.ts';

vi.mock('../../src/components/admin/accountDataPage.ts', () => ({
  default: {
    getAccountDataPageRender: vi.fn(() => ({ id: 'accountDataPage' })),
  },
}));

describe('account data navigation handler', () => {
  it('registers the dedicated page and balances loading state', async () => {
    const windowPostMessage = vi.spyOn(window, 'postMessage');
    const widgetPostMessage = vi.fn();
    vi.spyOn(document, 'querySelector').mockReturnValue({
      contentWindow: { postMessage: widgetPostMessage },
    } as unknown as HTMLIFrameElement);

    await accountDataNavigation.onEvent({ platform: { page: {} } });

    expect(accountDataPage.getAccountDataPageRender).toHaveBeenCalled();
    expect(windowPostMessage.mock.calls).toEqual([
      [{ type: 'rc-log-modal-loading-on' }, '*'],
      [{ type: 'rc-log-modal-loading-off' }, '*'],
    ]);
    expect(widgetPostMessage).toHaveBeenNthCalledWith(1, {
      type: 'rc-adapter-register-customized-page',
      page: { id: 'accountDataPage' },
    });
    expect(widgetPostMessage).toHaveBeenNthCalledWith(2, {
      type: 'rc-adapter-navigate-to',
      path: '/customized/accountDataPage',
    }, '*');
  });
});
