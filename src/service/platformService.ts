export interface PlatformInfo {
  platformName?: string;
  hostname?: string;
  connectorId?: string;
  devRcAccountId?: string | number;
  isPrivate?: boolean;
  [key: string]: unknown;
}

let sessionPlatformInfo: PlatformInfo | null | undefined = null;

export async function setPlatformInfo({ platformInfo }: { platformInfo: PlatformInfo | null | undefined }): Promise<void> {
  sessionPlatformInfo = platformInfo;
}

export async function getPlatformInfo(): Promise<PlatformInfo | null | undefined> {
  if (sessionPlatformInfo) {
    return sessionPlatformInfo;
  }
  const platformInfo = await chrome.storage.local.get('platform-info');
  sessionPlatformInfo = platformInfo?.['platform-info'] as PlatformInfo | undefined;
  return sessionPlatformInfo;
}

export async function clearPlatformInfo(): Promise<void> {
  sessionPlatformInfo = null;
  await chrome.storage.local.remove('serverSideLoggingToken');
  await chrome.storage.local.remove('isAdmin');
  await chrome.storage.local.remove('crmAuthed');
  await chrome.storage.local.remove('platform-info');
  await chrome.storage.local.remove('crm_extension_bullhornUsername');
  await chrome.storage.local.remove('crm_extension_bullhorn_user_urls');
}

const platformService = {
  setPlatformInfo,
  getPlatformInfo,
  clearPlatformInfo,
};

export default platformService;
