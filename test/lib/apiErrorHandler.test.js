import authCore from '../../src/core/auth.js';
import { showNotification } from '../../src/lib/util.js';
import { trackCrmAuthFail } from '../../src/lib/analytics.js';

vi.mock('../../src/core/auth.js', () => ({
  default: {
    clearLocalCrmAuthState: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.js', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../src/lib/analytics.js', () => ({
  trackCrmAuthFail: vi.fn(),
}));

async function loadApiErrorHandler() {
  vi.resetModules();
  return import('../../src/lib/apiErrorHandler.js');
}

describe('apiErrorHandler', () => {
  beforeEach(() => {
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
});
