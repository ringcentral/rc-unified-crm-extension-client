import axios from 'axios';
import baseManifest from '../manifest.json';
import { getRcInfo } from '../lib/util';
import { getPlatformInfo } from './platformService';

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
  access?: 'public' | 'shared' | 'private' | string;
  accountId?: string;
  version?: string;
}

interface ConnectorListResponse {
  connectors?: CatalogItem[];
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
  return String(rcInfo.value.cachedData.accountInfo.id);
}

function asConnectorList(data: unknown): ConnectorListResponse {
  return (data ?? {}) as ConnectorListResponse;
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
  const platformPublicListResponse = await axios.get(`${baseManifest.platformPublicListUrl}?type=connector`);
  for (const platform of asConnectorList(platformPublicListResponse.data).connectors ?? []) {
    platform.access = 'public';
    result.push(platform);
  }
  const rcInfo = await getRcInfo() as RcInfo;
  const rcAccountId = getRcAccountId(rcInfo);
  const platformInternalListResponse = await axios.get(`${baseManifest.platformInternalListUrl}?access=internal&type=connector&accountId=${rcAccountId}`);
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
  const pluginPublicListResponse = await axios.get(`${baseManifest.platformPublicListUrl}?type=plugin`);
  for (const plugin of asConnectorList(pluginPublicListResponse.data).connectors ?? []) {
    plugin.access = 'public';
    result.push(plugin);
  }
  const rcInfo = await getRcInfo() as RcInfo;
  const rcAccountId = getRcAccountId(rcInfo);
  const pluginInternalListResponse = await axios.get(`${baseManifest.platformInternalListUrl}?access=internal&type=plugin&accountId=${rcAccountId}`);
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
    const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null }) as { customCrmManifest: string | null };
    if (!customCrmManifest) {
      return null;
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
};

export default manifestService;
