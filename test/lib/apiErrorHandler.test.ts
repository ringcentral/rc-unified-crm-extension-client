import authCore from '../../src/core/auth.ts';
import { showNotification } from '../../src/lib/util.ts';
import { trackCrmAuthFail } from '../../src/lib/analytics.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';

vi.mock('../../src/core/auth.ts', () => ({
  default: {
    clearLocalCrmAuthState: vi.fn(),
    onUserClickConnectButton: vi.fn(),
  },
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../src/lib/analytics.ts', () => ({
  trackCrmAuthFail: vi.fn(),
}));

async function loadApiErrorHandler() {
  vi.resetModules();
  return import('../../src/lib/apiErrorHandler.ts');
}

describe('apiErrorHandler', () => {
  beforeEach(() => {
    vi.mocked(getPlatformInfo).mockResolvedValue({ platformName: 'salesforce' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects CRM auth-required messages in response body forms', async () => {
    const { default: apiErrorHandler } = await loadApiErrorHandler();

    expect(apiErrorHandler.isCrmAuthRequiredResponse({
      status: 400,
      data: 'Please authorize CRM platform',
    })).toBe(true);
    expect(apiErrorHandler.isCrmAuthRequiredResponse({
      status: 400,
      data: { returnMessage: { message: 'Please authorize CRM platform' } },
    })).toBe(true);
    expect(apiErrorHandler.isCrmAuthRequiredResponse({
      status: 401,
      data: { message: 'Please authorize CRM platform' },
    })).toBe(false);
  });

  it('clears CRM auth cache, tracks, invokes callback, and notifies user once', async () => {
    const { default: apiErrorHandler, CRM_AUTH_REQUIRED_MESSAGE } = await loadApiErrorHandler();
    const callback = vi.fn();
    vi.mocked(authCore.clearLocalCrmAuthState).mockResolvedValue(true);
    apiErrorHandler.registerCrmAuthCacheClearedHandler(callback);

    await expect(apiErrorHandler.handleApiError({
      response: {
        status: 400,
        data: { message: 'Please authorize CRM platform' },
      },
    })).resolves.toBe(true);

    expect(authCore.clearLocalCrmAuthState).toHaveBeenCalledTimes(1);
    expect(trackCrmAuthFail).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: CRM_AUTH_REQUIRED_MESSAGE,
      ttl: 60000,
    });
  });

  it('throttles repeated CRM auth cache clearing for five seconds', async () => {
    const { default: apiErrorHandler } = await loadApiErrorHandler();
    vi.mocked(authCore.clearLocalCrmAuthState).mockResolvedValue(true);

    await apiErrorHandler.handleApiError({
      response: {
        status: 400,
        data: { message: 'Please authorize CRM platform' },
      },
    });
    await apiErrorHandler.handleApiError({
      response: {
        status: 400,
        data: { message: 'Please authorize CRM platform' },
      },
    });

    expect(authCore.clearLocalCrmAuthState).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5001);
    await apiErrorHandler.handleApiError({
      response: {
        status: 400,
        data: { message: 'Please authorize CRM platform' },
      },
    });

    expect(authCore.clearLocalCrmAuthState).toHaveBeenCalledTimes(2);
  });

  it('does nothing for unrelated API errors or when no local CRM auth was cleared', async () => {
    const { default: apiErrorHandler } = await loadApiErrorHandler();
    vi.mocked(authCore.clearLocalCrmAuthState).mockResolvedValue(false);

    await expect(apiErrorHandler.handleApiError({
      response: {
        status: 500,
        data: { message: 'Server error' },
      },
    })).resolves.toBe(false);
    await expect(apiErrorHandler.handleApiError({
      response: {
        status: 400,
        data: { message: 'Please authorize CRM platform' },
      },
    })).resolves.toBe(false);

    expect(trackCrmAuthFail).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('can suppress user notification while still clearing auth state', async () => {
    const { default: apiErrorHandler } = await loadApiErrorHandler();
    vi.mocked(authCore.clearLocalCrmAuthState).mockResolvedValue(true);

    await expect(apiErrorHandler.handleApiError({
      response: {
        status: 400,
        data: { message: 'Please authorize CRM platform' },
      },
    }, { showUserNotification: false })).resolves.toBe(true);

    expect(showNotification).not.toHaveBeenCalled();
  });
  describe('Pipedrive auto reconnect', () => {
    const invalidResponse = { data: { successful: false, errorCode: 'CRM_SESSION_INVALID' } };

    beforeEach(() => {
      vi.mocked(getPlatformInfo).mockResolvedValue({ platformName: 'pipedrive' });
      vi.mocked(authCore.clearLocalCrmAuthState).mockResolvedValue(true);
    });

    it('opens the auth popup instead of the generic notice when the CRM auth is required', async () => {
      const { default: apiErrorHandler } = await loadApiErrorHandler();

      await apiErrorHandler.handleApiError({ response: { status: 400, data: { message: 'Please authorize CRM platform' } } });

      expect(authCore.onUserClickConnectButton).toHaveBeenCalledTimes(1);
      expect(showNotification).toHaveBeenCalledTimes(1);
      expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ message: apiErrorHandler.CRM_RECONNECT_MESSAGE }));
    });

    it('reconnects on an in-band CRM_SESSION_INVALID response', async () => {
      const { default: apiErrorHandler } = await loadApiErrorHandler();

      await expect(apiErrorHandler.handleSessionInvalidResponse(invalidResponse)).resolves.toBe(true);

      expect(authCore.clearLocalCrmAuthState).toHaveBeenCalledTimes(1);
      expect(authCore.onUserClickConnectButton).toHaveBeenCalledTimes(1);
    });

    it('does not reconnect when no session was stored, such as after a logout', async () => {
      const { default: apiErrorHandler } = await loadApiErrorHandler();
      vi.mocked(authCore.clearLocalCrmAuthState).mockResolvedValue(false);

      await expect(apiErrorHandler.handleSessionInvalidResponse(invalidResponse)).resolves.toBe(false);

      expect(authCore.onUserClickConnectButton).not.toHaveBeenCalled();
    });

    it('prompts at most once per cooldown window', async () => {
      const { default: apiErrorHandler } = await loadApiErrorHandler();

      await apiErrorHandler.requestAutoReconnect();
      await apiErrorHandler.requestAutoReconnect();
      expect(authCore.onUserClickConnectButton).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60 * 1000);
      await apiErrorHandler.requestAutoReconnect();
      expect(authCore.onUserClickConnectButton).toHaveBeenCalledTimes(2);
    });

    it('ignores other responses and other platforms', async () => {
      const { default: apiErrorHandler } = await loadApiErrorHandler();

      await expect(apiErrorHandler.handleSessionInvalidResponse({ data: { successful: true } })).resolves.toBe(false);

      vi.mocked(getPlatformInfo).mockResolvedValue({ platformName: 'salesforce' });
      await expect(apiErrorHandler.handleSessionInvalidResponse(invalidResponse)).resolves.toBe(false);
      await expect(apiErrorHandler.requestAutoReconnect()).resolves.toBe(false);

      expect(authCore.clearLocalCrmAuthState).not.toHaveBeenCalled();
      expect(authCore.onUserClickConnectButton).not.toHaveBeenCalled();
    });
  });
});
