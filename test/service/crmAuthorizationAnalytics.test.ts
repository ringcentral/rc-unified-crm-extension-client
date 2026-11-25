import { getAnalyticsIdentityRevision, group, identify, reset, trackCrmLogin } from '../../src/lib/analytics';
import { getRcAccessToken, getRcInfo } from '../../src/lib/util';
import { resolveAnalyticsRcUserInfo } from '../../src/service/analyticsRcUserInfo';
import { recordCrmAuthorization } from '../../src/service/crmAuthorizationAnalytics';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/lib/analytics', () => ({
  getAnalyticsIdentityRevision: vi.fn(),
  group: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  trackCrmLogin: vi.fn(),
}));

vi.mock('../../src/lib/util', () => ({
  getRcAccessToken: vi.fn(),
  getRcInfo: vi.fn(),
}));

vi.mock('../../src/service/analyticsRcUserInfo', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/service/analyticsRcUserInfo')>(),
  resolveAnalyticsRcUserInfo: vi.fn(),
}));

const connector = { platformName: 'clio', connectorId: 'connector-1', hostname: 'clio.example' };
const extensionInfo = { id: '101', account: { id: '900' } };
const authorization = {
  serverUrl: 'https://server.example', connector, extensionInfo,
  rcAccessToken: 'rc-token', jwtToken: 'crm-jwt', analyticsRevision: 2,
};
const userInfo = {
  rcAccountId: 'account-hash', rcExtensionId: 'extension-hash',
  rcUserName: undefined, rcUserEmail: undefined,
};

describe('CRM authorization analytics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    seedStorage({ 'platform-info': connector, rcUnifiedCrmExtJwt: 'crm-jwt', rcLoginStatus: true });
    vi.mocked(getRcInfo).mockResolvedValue({ value: { cachedData: { extensionInfo } } });
    vi.mocked(getRcAccessToken).mockReturnValue('rc-token');
    vi.mocked(getAnalyticsIdentityRevision).mockReturnValue(2);
    vi.mocked(resolveAnalyticsRcUserInfo).mockResolvedValue({ userInfo, recovered: false });
  });

  it('writes the confirmed CRM platform to the resolved Mixpanel identity', async () => {
    await recordCrmAuthorization(authorization);

    expect(trackCrmLogin).toHaveBeenCalledExactlyOnceWith('clio');
    expect(identify).toHaveBeenCalledExactlyOnceWith({
      extensionId: 'extension-hash', rcAccountId: 'account-hash',
      platformName: 'clio', rcAccountIdRaw: '900', rcExtensionIdRaw: '101',
    });
    expect(group).toHaveBeenCalledExactlyOnceWith({ rcAccountId: 'account-hash' });
    expect(readStorage()).toMatchObject({
      rcUserInfo: { rcExtensionId: 'extension-hash', rcAccountId: 'account-hash' },
      analyticsIdentity: { extensionId: 'extension-hash', platformName: 'clio' },
    });
  });

  it('keeps the success event if the profile lookup fails', async () => {
    vi.mocked(resolveAnalyticsRcUserInfo).mockRejectedValueOnce(new Error('offline'));

    await recordCrmAuthorization(authorization);

    expect(trackCrmLogin).toHaveBeenCalledExactlyOnceWith('clio');
    expect(identify).not.toHaveBeenCalled();
  });

  it('does not attach the authorization event to a previously stored user identity', async () => {
    seedStorage({
      ...readStorage(),
      analyticsIdentity: { extensionId: 'different-hash', rcAccountIdRaw: '901', rcExtensionIdRaw: '102' },
    });

    await recordCrmAuthorization(authorization);

    expect(reset).toHaveBeenCalledBefore(vi.mocked(identify));
    expect(identify).toHaveBeenCalledBefore(vi.mocked(trackCrmLogin));
    expect(trackCrmLogin).toHaveBeenCalledExactlyOnceWith('clio');
  });

  it('drops stale profile work when the user logs out during identity resolution', async () => {
    vi.mocked(resolveAnalyticsRcUserInfo).mockImplementationOnce(async () => {
      vi.mocked(getAnalyticsIdentityRevision).mockReturnValue(3);
      return { userInfo, recovered: false };
    });

    await recordCrmAuthorization(authorization);

    expect(identify).not.toHaveBeenCalled();
    expect(readStorage()).not.toHaveProperty('analyticsIdentity');
  });

  it('does not emit or identify after the current connector changes', async () => {
    seedStorage({ 'platform-info': { ...connector, connectorId: 'different-connector' } });

    await recordCrmAuthorization(authorization);

    expect(trackCrmLogin).not.toHaveBeenCalled();
    expect(resolveAnalyticsRcUserInfo).not.toHaveBeenCalled();
  });
});
