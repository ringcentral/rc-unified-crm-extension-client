import axios from 'axios';
import { getManifest, getPluginList, getPluginDetails } from './manifestService';
import { showNotification, getRcInfo } from '../lib/util';

interface PluginCatalogItem {
  id?: string;
  name?: string;
  version?: string;
  access?: string;
  accountId?: string;
  requireLicense?: boolean;
  [key: string]: unknown;
}

interface PluginDetails {
  isAsync?: boolean;
  phase?: string;
  supportedLogTypes?: unknown[];
  [key: string]: unknown;
}

interface PluginSettingValue {
  name?: string;
  version?: string;
  access?: string;
  [key: string]: unknown;
}

interface UserSetting {
  value?: PluginSettingValue;
}

interface ManifestWithServerUrl {
  serverUrl: string;
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

interface PluginLicenseStatusOptions {
  pluginId: string;
  plugin: PluginCatalogItem;
}

interface CheckAndUpdatePluginVersionResult {
  [settingKey: string]: {
    value: {
      name?: string;
      version?: string;
      isAsync?: boolean;
      phase?: string;
      access?: string;
      logTypes?: unknown[];
    };
  };
}

export async function getPluginLicenseStatus({ pluginId, plugin }: PluginLicenseStatusOptions) {
  if (!plugin.requireLicense) {
    return {
      id: pluginId,
      licenseStatus: true,
      licenseStatusDescription: '',
    };
  }
  const manifest = await getManifest() as ManifestWithServerUrl;
  const rcInfo = await getRcInfo() as RcInfo;
  const rcAccountId = rcInfo?.value?.cachedData?.accountInfo?.id?.toString()
    || rcInfo?.value?.cachedData?.extensionInfo?.account?.id?.toString();
  const licenseStatusResponse = await axios.get(`${manifest.serverUrl}/plugin/licenseStatus?rcAccountId=${rcAccountId}&pluginId=${pluginId}`);
  return { id: plugin.id, ...licenseStatusResponse.data };
}

export async function checkAndUpdatePluginVersion(): Promise<CheckAndUpdatePluginVersionResult> {
  const { userSettings } = await chrome.storage.local.get('userSettings') as {
    userSettings: Record<string, UserSetting>;
  };
  const pluginSettingKeys = Object.keys(userSettings)?.filter(key => key.startsWith('plugin_'));
  const pluginList = await getPluginList() as PluginCatalogItem[];
  let notificationMessage = '';
  const changedSettings: CheckAndUpdatePluginVersionResult = {};
  for (const pluginSettingKey of pluginSettingKeys) {
    const matchedPlugin = pluginList.find(plugin => plugin.id === pluginSettingKey.split('_')[1]);

    // CASE: has version diff -> update user settings and notify user
    if (matchedPlugin && matchedPlugin.version && matchedPlugin.version !== userSettings[pluginSettingKey]?.value?.version) {
      notificationMessage += `${matchedPlugin.name} upgraded to ${matchedPlugin.version}\n`;
      const pluginDetails = await getPluginDetails({ selectedPlugin: matchedPlugin }) as PluginDetails;
      changedSettings[pluginSettingKey] = {
        value: {
          name: matchedPlugin.name,
          version: matchedPlugin.version,
          isAsync: pluginDetails.isAsync,
          phase: pluginDetails.phase,
          access: userSettings[pluginSettingKey]?.value?.access,
          logTypes: pluginDetails.supportedLogTypes,
        },
      };
    }
  }
  if (notificationMessage !== '') {
    showNotification({ level: 'success', message: notificationMessage, ttl: 5000 });
  }
  return changedSettings;
}

const pluginService = {
  checkAndUpdatePluginVersion,
  getPluginLicenseStatus,
};

export default pluginService;
