import axios from 'axios';
import baseManifest from '../manifest.json';
import { getRcAccessTokenHeaderConfig, getRcInfo } from '../lib/util';
import { getPlatformInfo, setPlatformInfo } from './platformService';
import type { PlatformInfo } from './platformService';

const LEGACY_PROD_MANIFEST_URL = 'https://unified-crm-extension.labs.ringcentral.com/crmManifest';
const LEGACY_MANIFEST_MIGRATION_FLAG = 'manifestMigratedToPublicConnector';
const PUBLIC_MIGRATION_PLATFORM_NAMES = ['bullhorn', 'clio', 'redtail', 'insightly', 'pipedrive', 'googleSheets', 'netsuite'];

type UnknownRecord = Record<string, unknown>;
type ManifestValue = AppConnectManifest | string | null;

export interface AppConnectManifest extends UnknownRecord {
  serverUrl?: string;
  platforms?: Record<string, PlatformManifest>;
}

export interface PlatformManifest extends UnknownRecord {
  override?: ManifestOverride[];
}

interface ManifestOverride {
  triggerType?: string;
  triggerValue?: unknown;
  overrideObjects?: ManifestOverrideObject[];
}

interface ManifestOverrideObject {
  path: string;
  value: unknown;
}

export interface CatalogItem extends UnknownRecord {
  id?: string;
  name?: string;
  displayName?: string;
  access?: 'public' | 'shared' | 'private' | string;
  accountId?: string;
  version?: string;
}

interface ConnectorListResponse {
  connectors?: CatalogItem[];
  nextPageToken?: string;
  sharedConnectors?: CatalogItem[];
  privateConnectors?: CatalogItem[];
}

interface RcInfo {
  value?: {
    cachedData?: {
      accountInfo?: {
        id?: unknown;
      };
      extensionInfo?: {
        account?: {
          id?: unknown;
        };
      };
    };
  };
}

let sessionManifest: ManifestValue = null;
let platformList: CatalogItem[] | null = null;

function getRcAccountId(rcInfo: RcInfo): string {
  const accountId = rcInfo?.value?.cachedData?.accountInfo?.id;
  return accountId === undefined || accountId === null ? '' : String(accountId);
}

function asConnectorList(data: unknown): ConnectorListResponse {
  return (data ?? {}) as ConnectorListResponse;
}

// The public list endpoint is paginated (20 per page); follow nextPageToken until exhausted.
async function getAllPublicConnectors(type: 'connector' | 'plugin'): Promise<CatalogItem[]> {
  const result: CatalogItem[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  do {
    const pageQuery = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const response = await axios.get(`${baseManifest.platformPublicListUrl}?type=${type}${pageQuery}`);
    const page = asConnectorList(response.data);
    result.push(...(page.connectors ?? []));
    pageToken = page.nextPageToken;
    if (pageToken) {
      if (seenTokens.has(pageToken)) {
        break;
      }
      seenTokens.add(pageToken);
    }
  } while (pageToken);
  return result;
}

function getPlatformManifest(manifest: ManifestValue, platformName?: string): PlatformManifest | undefined {
  if (!manifest || typeof manifest === 'string' || !platformName) {
    return undefined;
  }
  return manifest.platforms?.[platformName];
}

export async function getPluginDetails({
  pluginId,
  selectedPlugin,
}: {
  pluginId?: string;
  selectedPlugin: CatalogItem;
}): Promise<unknown> {
  let pluginManifestResponse;
  switch (selectedPlugin.access) {
    case 'public':
      pluginManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${pluginId ?? selectedPlugin.id}/manifest?type=plugin`);
      break;
    case 'shared':
      pluginManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${pluginId ?? selectedPlugin.id}/manifest?access=internal&type=plugin&accountId=${selectedPlugin.accountId}`);
      break;
    case 'private': {
      const rcInfo = await getRcInfo() as RcInfo;
      pluginManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${pluginId ?? selectedPlugin.id}/manifest?access=internal&type=plugin&accountId=${getRcAccountId(rcInfo)}`);
      break;
    }
  }
  return pluginManifestResponse?.data?.platforms?.[selectedPlugin.name ?? ''];
}

export async function getPlatformList(): Promise<CatalogItem[]> {
  if (platformList) {
    return platformList;
  }
  const result: CatalogItem[] = [];
  for (const platform of await getAllPublicConnectors('connector')) {
    platform.access = 'public';
    result.push(platform);
  }
  const rcInfo = await getRcInfo() as RcInfo;
  const rcAccountId = getRcAccountId(rcInfo);
  const platformInternalListResponse = await axios.get(
    `${baseManifest.platformInternalListUrl}?access=internal&type=connector&accountId=${rcAccountId}`,
    await getRcAccessTokenHeaderConfig(),
  );
  for (const platform of asConnectorList(platformInternalListResponse.data).sharedConnectors ?? []) {
    platform.access = 'shared';
    result.push(platform);
  }
  for (const platform of asConnectorList(platformInternalListResponse.data).privateConnectors ?? []) {
    platform.access = 'private';
    result.push(platform);
  }
  platformList = result;
  return platformList;
}

export async function getPluginList(): Promise<CatalogItem[]> {
  const result: CatalogItem[] = [];
  for (const plugin of await getAllPublicConnectors('plugin')) {
    plugin.access = 'public';
    result.push(plugin);
  }
  const rcInfo = await getRcInfo() as RcInfo;
  const rcAccountId = getRcAccountId(rcInfo);
  const pluginInternalListResponse = await axios.get(
    `${baseManifest.platformInternalListUrl}?access=internal&type=plugin&accountId=${rcAccountId}`,
    await getRcAccessTokenHeaderConfig(),
  );
  for (const plugin of asConnectorList(pluginInternalListResponse.data).sharedConnectors ?? []) {
    plugin.access = 'shared';
    result.push(plugin);
  }
  for (const plugin of asConnectorList(pluginInternalListResponse.data).privateConnectors ?? []) {
    plugin.access = 'private';
    result.push(plugin);
  }
  return result;
}

export async function saveManifestUrl({ manifestUrl }: { manifestUrl: string }): Promise<string> {
  await chrome.storage.local.set({ manifestUrl });
  return manifestUrl;
}

function applyOverrides(manifest: ManifestValue, platformName?: string, hostname?: string): void {
  const platformManifest = getPlatformManifest(manifest, platformName);
  const override = platformManifest?.override;
  if (!override || !manifest || typeof manifest === 'string') {
    return;
  }

  for (const overrideItem of override) {
    switch (overrideItem.triggerType) {
      // TEMP: meta should be removed after developer registration is implemented
      case 'meta':
        for (const overrideObj of overrideItem.overrideObjects ?? []) {
          setValueByPath(manifest, overrideObj.path, overrideObj.value);
        }
        break;
      case 'hostname':
        if (overrideItem.triggerValue === hostname && platformName) {
          for (const overrideObj of overrideItem.overrideObjects ?? []) {
            setValueByPath(manifest.platforms?.[platformName], overrideObj.path, overrideObj.value);
          }
        }
        break;
    }
  }
}

export async function saveManifest({ manifest }: { manifest: AppConnectManifest }): Promise<AppConnectManifest> {
  sessionManifest = manifest;
  const platformInfo = await getPlatformInfo();
  applyOverrides(sessionManifest, platformInfo?.platformName, platformInfo?.hostname);
  await chrome.storage.local.set({ customCrmManifest: sessionManifest });
  return sessionManifest as AppConnectManifest;
}

export async function refreshManifest(): Promise<ManifestValue> {
  let { manifestUrl } = await chrome.storage.local.get({ manifestUrl: null }) as { manifestUrl: string | null };
  if (!manifestUrl) {
    const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null }) as { customCrmManifest: ManifestValue };
    if (!customCrmManifest) {
      return null;
    }
    // Only legacy storage kept the manifest URL here; a stored manifest object has no URL to refresh from.
    if (typeof customCrmManifest !== 'string') {
      return getManifest();
    }
    else {
      manifestUrl = customCrmManifest;
      await saveManifestUrl({ manifestUrl });
      await chrome.storage.local.remove('customCrmManifest');
    }
  }
  const manifestResponse = await axios.get(manifestUrl);
  const manifest = manifestResponse.data as AppConnectManifest;
  await saveManifest({ manifest });
  return manifest;
}

/**
 * One-time migration for users who pinned the prod server-host manifest through the 1.x options page
 * (`customCrmManifestUrl`). Eligible connectors are moved to their public dev console connector manifest.
 * Returns true when the legacy URL was retired. Any failure leaves storage untouched so it retries next time.
 */
export async function migrateLegacyManifestUrl(): Promise<boolean> {
  const stored = await chrome.storage.local.get({
    [LEGACY_MANIFEST_MIGRATION_FLAG]: false,
    customCrmManifestUrl: null,
    manifestUrl: null,
    'platform-info': null,
  }) as {
    [LEGACY_MANIFEST_MIGRATION_FLAG]: boolean;
    customCrmManifestUrl: string | null;
    manifestUrl: string | null;
    'platform-info': PlatformInfo | null;
  };
  const platformInfo = stored['platform-info'];
  try {
    // The user already picked a dev console connector. The legacy URL (and the manifestUrl that
    // popup.ts copied from it on earlier opens) is only a stale override, so point back at the connector.
    if (platformInfo?.connectorId) {
      const hasLegacyOverride = stored.customCrmManifestUrl === LEGACY_PROD_MANIFEST_URL
        || stored.manifestUrl === LEGACY_PROD_MANIFEST_URL;
      if (!hasLegacyOverride) {
        return false;
      }
      if (stored.manifestUrl === LEGACY_PROD_MANIFEST_URL) {
        const connectorManifestUrl = platformInfo.isPrivate
          ? `${baseManifest.platformPublicListUrl}/${platformInfo.connectorId}/manifest?access=internal&type=connector&accountId=${platformInfo.devRcAccountId}`
          : `${baseManifest.platformPublicListUrl}/${platformInfo.connectorId}/manifest?type=connector`;
        const connectorManifestResponse = await axios.get(connectorManifestUrl);
        await saveManifestUrl({ manifestUrl: connectorManifestUrl });
        await saveManifest({ manifest: connectorManifestResponse.data as AppConnectManifest });
      }
      await chrome.storage.local.remove('customCrmManifestUrl');
      await chrome.storage.local.set({ [LEGACY_MANIFEST_MIGRATION_FLAG]: true });
      return true;
    }
    if (stored[LEGACY_MANIFEST_MIGRATION_FLAG] || stored.customCrmManifestUrl !== LEGACY_PROD_MANIFEST_URL) {
      return false;
    }
    if (!platformInfo?.platformName || !PUBLIC_MIGRATION_PLATFORM_NAMES.includes(platformInfo.platformName)) {
      return false;
    }
    const connector = (await getAllPublicConnectors('connector')).find(item => item.name === platformInfo.platformName);
    if (!connector?.id) {
      return false;
    }
    const manifestUrl = `${baseManifest.platformPublicListUrl}/${connector.id}/manifest?type=connector`;
    const manifestResponse = await axios.get(manifestUrl);
    const migratedPlatformInfo: PlatformInfo = {
      ...platformInfo,
      platformDisplayName: connector.displayName ?? connector.name,
      connectorId: connector.id,
      devRcAccountId: '',
      isPrivate: false,
    };
    await setPlatformInfo({ platformInfo: migratedPlatformInfo });
    await saveManifestUrl({ manifestUrl });
    await saveManifest({ manifest: manifestResponse.data as AppConnectManifest });
    await chrome.storage.local.set({
      'platform-info': migratedPlatformInfo,
      [LEGACY_MANIFEST_MIGRATION_FLAG]: true,
    });
    await chrome.storage.local.remove('customCrmManifestUrl');
    return true;
  }
  catch (e) {
    console.warn('[manifest] Legacy manifest URL migration failed, will retry next time', e);
    return false;
  }
}

export async function getManifest(forceRefresh = false): Promise<ManifestValue> {
  if (sessionManifest && !forceRefresh) {
    return sessionManifest;
  }
  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null }) as {
    customCrmManifest: ManifestValue;
  };
  const platformInfo = await getPlatformInfo();
  applyOverrides(customCrmManifest, platformInfo?.platformName, platformInfo?.hostname);
  return customCrmManifest;
}

function setValueByPath(obj: unknown, path: string, value: unknown): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  // Convert path to an array of keys
  const keys = path.split('.');

  // Get a reference to the object to traverse
  let current = obj as UnknownRecord;

  // Iterate through the keys, stopping before the last one
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    // If the current key doesn't exist or is not an object, create an empty object
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    // Move to the next level
    current = current[key] as UnknownRecord;
  }

  // Set the value at the final key
  current[keys[keys.length - 1]] = value;
}

const manifestService = {
  getPluginDetails,
  getManifest,
  getPlatformList,
  getPluginList,
  saveManifest,
  saveManifestUrl,
  refreshManifest,
  migrateLegacyManifestUrl,
};

export default manifestService;
