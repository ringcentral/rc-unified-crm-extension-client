import { getAnalyticsIdentityRevision, group, identify, reset, trackCrmLogin } from '../lib/analytics';
import { getRcAccessToken, getRcInfo } from '../lib/util';
import { hasRingCentralId, resolveAnalyticsRcUserInfo } from './analyticsRcUserInfo';
import type { PlatformInfo } from './platformService';

type Authorization = {
  serverUrl: string;
  connector: PlatformInfo;
  extensionInfo: { id?: unknown; account?: { id?: unknown }; name?: string; contact?: { email?: string } };
  rcAccessToken: string;
  jwtToken: string;
  analyticsRevision: number;
};

const connectorFields = ['platformName', 'connectorId', 'hostname', 'devRcAccountId', 'isPrivate'] as const;

export async function recordCrmAuthorization({
  serverUrl, connector, extensionInfo, rcAccessToken, jwtToken, analyticsRevision,
}: Authorization): Promise<void> {
  const platformName = connector.platformName;
  const rawExtensionId = extensionInfo.id;
  const rawAccountId = extensionInfo.account?.id;
  if (!platformName || !jwtToken || !hasRingCentralId(rawExtensionId) || !hasRingCentralId(rawAccountId)) return;

  const isCurrent = () => !!rcAccessToken && getRcAccessToken() === rcAccessToken &&
    getAnalyticsIdentityRevision() === analyticsRevision;
  const matchesUser = (account: unknown, extension: unknown) =>
    String(account) === String(rawAccountId) && String(extension) === String(rawExtensionId);

  const readCurrentContext = async () => {
    if (!isCurrent()) return;
    const [rcInfo, stored] = await Promise.all([
      getRcInfo(),
      chrome.storage.local.get(['platform-info', 'rcLoginStatus', 'rcUnifiedCrmExtJwt', 'analyticsIdentity']),
    ]);
    const currentConnector = stored['platform-info'] as PlatformInfo | undefined;
    const currentExtension = rcInfo?.value?.cachedData?.extensionInfo;
    if (!isCurrent() || stored.rcLoginStatus === false || stored.rcUnifiedCrmExtJwt !== jwtToken ||
        !matchesUser(currentExtension?.account?.id, currentExtension?.id) ||
        connectorFields.some(field => currentConnector?.[field] !== connector[field])) return;
    return stored;
  };

  try {
    const initialContext = await readCurrentContext();
    if (!initialContext) return;

    const previous = initialContext.analyticsIdentity as {
      extensionId?: string;
      rcAccountIdRaw?: unknown;
      rcExtensionIdRaw?: unknown;
    } | undefined;
    // Keep the success event if lookup fails, except when the SDK may still be using another user's identity.
    const needsIdentification = previous && !matchesUser(previous.rcAccountIdRaw, previous.rcExtensionIdRaw);
    if (!needsIdentification) trackCrmLogin(platformName);

    const { userInfo } = await resolveAnalyticsRcUserInfo({ serverUrl, extensionInfo, isCurrent });
    if (!await readCurrentContext()) return;
    const identity = {
      extensionId: userInfo.rcExtensionId,
      rcAccountId: userInfo.rcAccountId,
      platformName,
      rcAccountIdRaw: rawAccountId,
      rcExtensionIdRaw: rawExtensionId,
    };
    await chrome.storage.local.set({ rcUserInfo: userInfo, analyticsIdentity: identity });
    if (!isCurrent()) return;
    if (previous?.extensionId && previous.extensionId !== identity.extensionId) reset();
    identify(identity);
    group({ rcAccountId: userInfo.rcAccountId });
    if (needsIdentification) trackCrmLogin(platformName);
  }
  catch {
    console.warn('Failed to update CRM analytics identity');
  }
}
