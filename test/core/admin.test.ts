// @ts-nocheck
import axios from 'axios';
import adminPage from '../../src/components/admin/adminPage.ts';
import authCore from '../../src/core/auth.ts';
import { RcAPI } from '../../src/lib/rcAPI.ts';
import { getRcAccessToken, getRcContactInfo, showNotification } from '../../src/lib/util.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const rcApiMocks = vi.hoisted(() => {
  const getInteropCode = vi.fn(async () => 'interop-code');
  return {
    getInteropCode,
    RcAPI: vi.fn(function RcAPI() {
      this.getInteropCode = getInteropCode;
    }),
  };
});

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/components/admin/adminPage.ts', () => ({
  default: {
    getAdminPageRender: vi.fn(() => ({ id: 'adminPage' })),
  },
}));

vi.mock('../../src/core/auth.ts', () => ({
  default: {
    setAuth: vi.fn(),
  },
}));

vi.mock('../../src/lib/rcAPI.ts', () => ({
  RcAPI: rcApiMocks.RcAPI,
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
  getRcContactInfo: vi.fn(async () => [
    { id: 'user-1', type: 'User' },
    { id: 'site-1', type: 'Site' },
  ]),
  showNotification: vi.fn(),
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadAdminCore() {
  vi.resetModules();
  return loadModule('../../src/core/admin.ts');
}

function platform() {
  return {
    name: 'salesforce',
    serverSideLogging: {
      url: 'https://ssl.example',
      additionalFields: [{ const: 'disposition' }],
      useAdminAssignedUserToken: true,
    },
  };
}

describe('admin core', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.delete).mockReset();
    vi.mocked(adminPage.getAdminPageRender).mockReset().mockReturnValue({ id: 'adminPage' });
    vi.mocked(authCore.setAuth).mockReset();
    rcApiMocks.RcAPI.mockClear();
    rcApiMocks.getInteropCode.mockReset().mockResolvedValue('interop-code');
    vi.mocked(getRcAccessToken).mockReset().mockReturnValue('rc-access-token');
    vi.mocked(getRcContactInfo).mockReset().mockResolvedValue([
      { id: 'user-1', type: 'User' },
      { id: 'site-1', type: 'Site' },
    ]);
    vi.mocked(showNotification).mockReset();
    vi.mocked(getManifest).mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        salesforce: platform(),
      },
    });
    vi.mocked(getPlatformInfo).mockResolvedValue({
      platformName: 'salesforce',
      connectorId: 'connector-1',
      isPrivate: true,
    });
  });

  it('gets and uploads admin settings with RingCentral access token', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { userSettings: { autoLogCall: { value: true } } } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: {} });
    const adminCore = await loadAdminCore();

    await expect(adminCore.getAdminSettings({ serverUrl: 'https://server.example' })).resolves.toEqual({
      userSettings: { autoLogCall: { value: true } },
    });
    await adminCore.uploadAdminSettings({
      serverUrl: 'https://server.example',
      adminSettings: { userSettings: {} },
    });

    expect(axios.get).toHaveBeenCalledWith('https://server.example/admin/settings?rcAccessToken=rc-access-token');
    expect(axios.post).toHaveBeenCalledWith('https://server.example/admin/settings?rcAccessToken=rc-access-token', {
      adminSettings: { userSettings: {} },
    });
    expect(readStorage().adminSettings).toEqual({ userSettings: {} });
  });

  it('refreshes admin settings, registers admin page, and updates auth display', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmUserInfo: { name: 'CRM User' },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { userSettings: {} } });
    const adminCore = await loadAdminCore();

    await expect(adminCore.refreshAdminSettings()).resolves.toEqual({
      adminSettings: { userSettings: {} },
    });

    expect(adminPage.getAdminPageRender).toHaveBeenCalledWith({ platform: platform() });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-customized-page',
        page: { id: 'adminPage' },
      },
      targetOrigin: '*',
    });
    expect(authCore.setAuth).toHaveBeenCalledWith(true, 'CRM User', true);
    expect(readStorage()).toMatchObject({
      isAdmin: true,
      adminSettings: { userSettings: {} },
    });
  });

  it('authenticates server-side logging and stores token', async () => {
    seedStorage({ rcUserInfo: { rcAccountId: 'account-1' } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { jwtToken: 'ssl-token' } });
    const adminCore = await loadAdminCore();

    await expect(adminCore.authServerSideLogging({ platform: platform() })).resolves.toBe('ssl-token');

    expect(RcAPI).toHaveBeenCalled();
    expect(rcApiMocks.getInteropCode).toHaveBeenCalledWith({
      rcAccessToken: 'rc-access-token',
      rcClientId: 'Y4m1YREFKbXdDoet5djv46',
    });
    expect(axios.get).toHaveBeenCalledWith('https://ssl.example/oauth/callback?code=interop-code&rcAccountId=account-1', {
      headers: { Accept: 'application/json' },
    });
    expect(readStorage().serverSideLoggingToken).toBe('ssl-token');
  });

  it('enables server-side logging with existing token and admin settings', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'crm-jwt',
      serverSideLoggingToken: 'ssl-token',
      adminSettings: {
        userSettings: {
          addCallLogLegs: { value: true },
        },
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { subscribed: false } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { subscribed: true } });
    const adminCore = await loadAdminCore();

    await adminCore.enableServerSideLogging({
      serverUrl: 'https://server.example',
      platform: platform(),
      subscriptionLevel: 'Account',
      loggingByAdmin: true,
      sources: ['extension'],
    });

    expect(axios.post).toHaveBeenCalledWith('https://ssl.example/subscribe', {
      crmToken: 'crm-jwt',
      crmPlatform: 'salesforce',
      crmAdapterUrl: 'https://server.example',
      subscriptionLevel: 'Account',
      loggingByAdmin: true,
      loggingWithUserAssigned: false,
      detailedCallLog: true,
      sources: ['extension'],
    }, {
      headers: {
        Accept: 'application/json',
        'X-Access-Token': 'ssl-token',
      },
    });
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Server side logging turned ON. Auto call log inside the extension will be forced OFF.',
      ttl: 5000,
    });
  });

  it('gets, saves, and deletes managed auth/OAuth settings with connector context', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { scope: 'account' } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { saved: true } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { scope: 'account', refreshed: true } });
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { deleted: true } });
    const adminCore = await loadAdminCore();

    await expect(adminCore.getManagedAuthSettings({ serverUrl: 'https://server.example' }))
      .resolves.toEqual({ scope: 'account' });
    await expect(adminCore.saveManagedAuthSettings({
      serverUrl: 'https://server.example',
      scope: 'account',
      values: { apiKey: 'secret' },
      fieldsToRemove: ['oldKey'],
    })).resolves.toEqual({ saved: true });
    await expect(adminCore.deleteManagedOAuthAccount({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
    })).resolves.toEqual({ deleted: true });

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://server.example/admin/managedAuth?jwtToken=jwt-1&rcAccessToken=rc-access-token&connectorId=connector-1&isPrivate=true');
    expect(axios.post).toHaveBeenCalledWith('https://server.example/admin/managedAuth?jwtToken=jwt-1&rcAccessToken=rc-access-token&connectorId=connector-1&isPrivate=true', {
      scope: 'account',
      values: { apiKey: 'secret' },
      rcExtensionId: undefined,
      rcUserName: undefined,
      fieldsToRemove: ['oldKey'],
    });
    expect(axios.delete).toHaveBeenCalledWith('https://server.example/admin/managedOAuth/account?rcAccessToken=rc-access-token&platform=salesforce');
  });

  it('returns null when admin settings cannot be loaded', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network'));
    const adminCore = await loadAdminCore();

    await expect(adminCore.getAdminSettings({ serverUrl: 'https://server.example' })).resolves.toBeNull();
  });

  it('loads server-side logging subscription with a fresh token and after token refresh', async () => {
    seedStorage({ rcUserInfo: { rcAccountId: 'account-1' } });
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { jwtToken: 'ssl-token' } })
      .mockResolvedValueOnce({ data: { subscribed: true } });
    const adminCore = await loadAdminCore();

    await expect(adminCore.getServerSideLogging({ platform: platform() })).resolves.toEqual({ subscribed: true });
    expect(readStorage().serverSideLoggingToken).toBe('ssl-token');

    seedStorage({
      rcUserInfo: { rcAccountId: 'account-1' },
      serverSideLoggingToken: 'expired-token',
    });
    vi.mocked(axios.get)
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { jwtToken: 'new-token' } })
      .mockResolvedValueOnce({ data: { subscribed: false } });

    await expect(adminCore.getServerSideLogging({ platform: platform() })).resolves.toEqual({ subscribed: false });
    expect(readStorage().serverSideLoggingToken).toBe('new-token');
  });

  it('gets and uploads server-side logging additional field values', async () => {
    seedStorage({ rcUserInfo: { rcAccountId: 'account-1' } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { disposition: 'demo' } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { saved: true } });
    const adminCore = await loadAdminCore();

    await expect(adminCore.getServerSideLoggingAdditionalFieldValues({ platform: platform() }))
      .resolves.toEqual({ disposition: 'demo' });
    await expect(adminCore.uploadServerSideLoggingAdditionalFieldValues({
      platform: platform(),
      formData: {
        serverSideLoggingHolder: {
          disposition: 'demo',
        },
      },
    })).resolves.toEqual({ saved: true });

    expect(axios.get).toHaveBeenCalledWith('https://server.example/admin/serverLoggingSettings?rcAccountId=account-1');
    expect(axios.post).toHaveBeenCalledWith('https://server.example/admin/serverLoggingSettings?rcAccountId=account-1', {
      additionalFieldValues: { disposition: 'demo' },
    });
  });

  it('disables server-side logging and retries unsubscribe after token refresh', async () => {
    seedStorage({
      rcUserInfo: { rcAccountId: 'account-1' },
      serverSideLoggingToken: 'expired-token',
    });
    vi.mocked(axios.get)
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { jwtToken: 'new-token' } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { ok: true } });
    const adminCore = await loadAdminCore();

    await adminCore.disableServerSideLogging({ platform: platform() });

    expect(axios.post).toHaveBeenCalledWith('https://ssl.example/unsubscribe', {}, {
      headers: {
        Accept: 'application/json',
        'X-Access-Token': 'new-token',
      },
    });
  });

  it('updates do-not-log numbers with parsed phone numbers and retries on expired token', async () => {
    seedStorage({
      rcUserInfo: { rcAccountId: 'account-1' },
      serverSideLoggingToken: 'expired-token',
      selectedRegion: 'US',
    });
    vi.mocked(axios.post)
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { ok: true } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { jwtToken: 'new-token' } });
    const adminCore = await loadAdminCore();

    await adminCore.updateServerSideDoNotLogNumbers({
      platform: platform(),
      doNotLogNumbers: '+16505550100,123',
    });

    expect(axios.post).toHaveBeenLastCalledWith('https://ssl.example/do-not-log-numbers', {
      doNotLogNumbers: '+16505550100,123',
    }, {
      headers: {
        Accept: 'application/json',
        'X-Access-Token': 'new-token',
      },
    });
  });

  it('returns report stats and appends local unlogged-call stats for current user', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { totalCalls: 10 } })
      .mockResolvedValueOnce({ data: { loggedCallCount: 2 } });
    RCAdapter.getUnloggedCalls = vi.fn(async () => ({
      calls: [
        { sessionId: 'inside', startTime: '2026-07-03T09:00:00Z' },
        { sessionId: 'outside', startTime: '2026-07-01T09:00:00Z' },
      ],
      hasMore: false,
    }));
    const adminCore = await loadAdminCore();

    await expect(adminCore.getAdminReportStats({
      serverUrl: 'https://server.example',
      timezone: 'Asia/Shanghai',
      timeFrom: '2026-07-03T00:00:00Z',
      timeTo: '2026-07-04T00:00:00Z',
      groupBy: 'day',
    })).resolves.toEqual({ totalCalls: 10 });
    await expect(adminCore.getAdminReportStats({
      serverUrl: 'https://server.example',
      timezone: 'Asia/Shanghai',
      groupBy: 'day',
    })).resolves.toBeNull();
    await expect(adminCore.getUserExtensionReportStats({
      serverUrl: 'https://server.example',
      rcExtensionId: '~',
      timezone: 'Asia/Shanghai',
      timeFrom: '2026-07-03T00:00:00Z',
      timeTo: '2026-07-04T00:00:00Z',
    })).resolves.toEqual({
      loggedCallCount: 2,
      unloggedCallStats: {
        unloggedCallCount: 1,
        calls: [{ sessionId: 'inside', startTime: '2026-07-03T09:00:00Z' }],
      },
    });
  });

  it('gets and reinitializes user mapping with RingCentral users and departments only', async () => {
    seedStorage({ rcUserInfo: { rcAccountId: 'account-1' } });
    vi.mocked(getRcContactInfo).mockResolvedValue([
      { id: 'user-1', type: 'User' },
      { id: 'department-1', type: 'Department' },
      { id: 'company-1', type: 'Company' },
    ]);
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { mappings: [] } })
      .mockResolvedValueOnce({ data: { reinitialized: true } });
    const adminCore = await loadAdminCore();

    await expect(adminCore.getUserMapping({ serverUrl: 'https://server.example' })).resolves.toEqual({ mappings: [] });
    await expect(adminCore.reinitializeUserMapping({ serverUrl: 'https://server.example' })).resolves.toEqual({ reinitialized: true });

    expect(axios.post).toHaveBeenNthCalledWith(1, 'https://server.example/admin/userMapping?rcAccessToken=rc-access-token', {
      rcExtensionList: [
        { id: 'user-1', type: 'User' },
        { id: 'department-1', type: 'Department' },
      ],
    });
    expect(axios.post).toHaveBeenNthCalledWith(2, 'https://server.example/admin/reinitializeUserMapping?rcAccountId=account-1&rcAccessToken=rc-access-token', {
      rcExtensionList: [
        { id: 'user-1', type: 'User' },
        { id: 'department-1', type: 'Department' },
      ],
    });
  });

  it('authenticates App Connect server and ignores auth failures', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockRejectedValueOnce(new Error('network'));
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const adminCore = await loadAdminCore();

    await adminCore.authAppConnectServer({ serverUrl: 'https://server.example' });
    await expect(adminCore.authAppConnectServer({ serverUrl: 'https://server.example' })).resolves.toBeUndefined();

    expect(rcApiMocks.getInteropCode).toHaveBeenCalledWith({
      rcAccessToken: 'rc-access-token',
      rcClientId: undefined,
    });
    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://server.example/ringcentral/oauth/callback?code=interop-code', {
      headers: { Accept: 'application/json' },
    });
    expect(consoleLog).toHaveBeenCalledWith('Cannot auth app connect server', expect.any(Error));
  });
});
