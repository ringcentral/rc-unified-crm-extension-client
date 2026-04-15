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

async function upsertPluginAsyncTaskIds({ taskIds }) {
    const { pluginAsyncTaskIds } = await chrome.storage.local.get({ pluginAsyncTaskIds: [] });
    pluginAsyncTaskIds.push(...taskIds);
    await chrome.storage.local.set({ pluginAsyncTaskIds });
}

async function getPluginAsyncTaskIds() {
    const { pluginAsyncTaskIds } = await chrome.storage.local.get({ pluginAsyncTaskIds: [] });
    return pluginAsyncTaskIds;
}

async function removePluginAsyncTasks({ tasks, missingTaskIds }) {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const completedTaskIds = completedTasks.map(task => task.id);
    const failedTaskIds = tasks.filter(task => task.status === 'failed').map(task => task.id);
    const toBeRemovedTaskIds = [...completedTaskIds, ...failedTaskIds, ...missingTaskIds];
    const { pluginAsyncTaskIds } = await chrome.storage.local.get({ pluginAsyncTaskIds: [] });
    const newPluginAsyncTaskIds = pluginAsyncTaskIds.filter(taskId => !toBeRemovedTaskIds.includes(taskId));
    await chrome.storage.local.set({ pluginAsyncTaskIds: newPluginAsyncTaskIds });
}

// check plugin async task every 5 minutes
function setPluginAsyncTaskCheck() {
    const pluginAsyncTaskCheckId = setInterval(pluginAsyncTaskCheck, 5 * 60 * 1000);
    return pluginAsyncTaskCheckId;
}

async function pluginAsyncTaskCheck() {
    const manifest = await getManifest();
    const pluginAsyncTaskIds = await getPluginAsyncTaskIds();
    const pluginTaskRes = await axios.post(`${manifest.serverUrl}/pluginAsyncTask`, {
        asyncTaskIds: pluginAsyncTaskIds
    });
    if (pluginTaskRes.data?.tasks?.length === 0) {
        await removePluginAsyncTasks({ tasks: [], missingTaskIds: pluginAsyncTaskIds });
        return;
    }
    let notificationMessage = '';
    const pluginNamesAndStatus = [];
    for (const task of pluginTaskRes.data.tasks) {
        const pluginName = task.cacheKey.split('-')[1];
        const taskStatus = task.status;
        pluginNamesAndStatus.push({ pluginName, taskStatus });
    }
    const distinctPluginNames = [...new Set(pluginNamesAndStatus.map(item => item.pluginName))];
    for (const pluginName of distinctPluginNames) {
        const pluginTasks = pluginNamesAndStatus.filter(item => item.pluginName === pluginName);
        notificationMessage += `${pluginName}: `;
        const distinceStatus = [...new Set(pluginTasks.map(item => item.taskStatus))];
        for (const status of distinceStatus) {
            notificationMessage += `${status}(${pluginTasks.filter(item => item.taskStatus === status).length}) `;
        }
        notificationMessage += '\n';
    }
    const missingTaskIds = pluginAsyncTaskIds.filter(taskId => !pluginTaskRes.data.tasks.some(task => task.id === taskId));
    await removePluginAsyncTasks({ tasks: pluginTaskRes.data.tasks, missingTaskIds });
    if (notificationMessage !== '') {
        showNotification({ level: 'success', message: notificationMessage, ttl: 3000 });
    }
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

exports.upsertPluginAsyncTaskIds = upsertPluginAsyncTaskIds;
exports.getPluginAsyncTaskIds = getPluginAsyncTaskIds;
exports.setPluginAsyncTaskCheck = setPluginAsyncTaskCheck;
exports.checkAndUpdatePluginVersion = checkAndUpdatePluginVersion;
exports.getPluginLicenseStatus = getPluginLicenseStatus;

// Expose for DevTools debugging
window.__PLUGIN_DEBUG__ = {
    pluginAsyncTaskCheck
};
