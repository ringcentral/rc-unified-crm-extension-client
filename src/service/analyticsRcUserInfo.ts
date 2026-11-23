import { RcAPI } from '../lib/rcAPI';

type ExtensionInfo = {
  id?: unknown;
  account?: { id?: unknown };
  name?: string;
  contact?: { email?: string };
};

export function hasRingCentralId(value: unknown): value is string | number {
  return typeof value === 'number' ? Number.isSafeInteger(value) && value > 0 :
    typeof value === 'string' && /^[1-9]\d{0,31}$/.test(value);
}

export async function resolveAnalyticsRcUserInfo({ serverUrl, extensionInfo, isCurrent }: {
  serverUrl: string;
  extensionInfo: ExtensionInfo | undefined;
  isCurrent?: () => boolean;
}) {
  const extensionId = extensionInfo?.id;
  const accountId = extensionInfo?.account?.id;
  if (!hasRingCentralId(extensionId) || !hasRingCentralId(accountId)) {
    throw new Error('RingCentral account or extension ID is unavailable');
  }
  const api = new RcAPI();
  const lookup = () => api.getUserInfo({ serverUrl, extensionId, accountId, timeout: 3000 });
  let recovered = false;
  const response = await lookup().catch((error: unknown) => {
    if (isCurrent?.() === false) throw error;
    recovered = true;
    return lookup();
  });
  if (typeof response?.extensionId !== 'string' || !response.extensionId.trim() ||
      typeof response.accountId !== 'string' || !response.accountId.trim()) {
    throw new Error('RingCentral analytics identity is unavailable');
  }
  return {
    userInfo: {
      rcUserName: extensionInfo?.name,
      rcUserEmail: extensionInfo?.contact?.email,
      rcAccountId: response.accountId,
      rcExtensionId: response.extensionId,
    },
    recovered,
  };
}
