import axios from 'axios';
import { getManifest, getPluginList, getPluginDetails } from './manifestService';
import { showNotification, getRcInfo } from '../lib/util';

async function getPluginLicenseStatus({ pluginId, plugin }) {
    if (!plugin.requireLicense) {
        return {
            id: pluginId,
            licenseStatus: true,
            licenseStatusDescription: ''
        }
    }
    const manifest = await getManifest();
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo?.value?.cachedData?.accountInfo?.id?.toString()
        || rcInfo?.value?.cachedData?.extensionInfo?.account?.id?.toString();
    const licenseStatusResponse = await axios.get(`${manifest.serverUrl}/plugin/licenseStatus?rcAccountId=${rcAccountId}&pluginId=${pluginId}`);
    return { id: plugin.id, ...licenseStatusResponse.data };
}

async function checkAndUpdatePluginVersion() {
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const pluginSettingKeys = Object.keys(userSettings)?.filter(key => key.startsWith('plugin_'));
    const pluginList = await getPluginList();
    let notificationMessage = '';
    const changedSettings = {};
    for (const pluginSettingKey of pluginSettingKeys) {
        const matchedPlugin = pluginList.find(plugin => plugin.id === pluginSettingKey.split('_')[1]);

        // CASE: has version diff -> update user settings and notify user
        if (matchedPlugin && matchedPlugin.version && matchedPlugin.version !== userSettings[pluginSettingKey]?.value?.version) {
            notificationMessage += `${matchedPlugin.name} upgraded to ${matchedPlugin.version}\n`;
            const pluginDetails = await getPluginDetails({ selectedPlugin: matchedPlugin });
            changedSettings[pluginSettingKey] = {
                value: {
                    name: matchedPlugin.name,
                    version: matchedPlugin.version,
                    isAsync: pluginDetails.isAsync,
                    phase: pluginDetails.phase,
                    access: userSettings[pluginSettingKey]?.value?.access,
                    logTypes: pluginDetails.supportedLogTypes,
                }
            };
        }
    }
    if (notificationMessage !== '') {
        showNotification({ level: 'success', message: notificationMessage, ttl: 5000 });
    }
    return changedSettings;
}

exports.checkAndUpdatePluginVersion = checkAndUpdatePluginVersion;
exports.getPluginLicenseStatus = getPluginLicenseStatus;
