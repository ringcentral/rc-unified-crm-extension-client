import axios from 'axios';
import { getPluginList } from '../../../../service/manifestService';
import { getPluginSetting, refreshUserSettings, getAllPluginSettings } from '../../../../core/user';
import { getAdminSettings, uploadAdminSettings } from '../../../../core/admin';
import { getPluginAdminConfigurePageRender } from '../../../../components/pluginAdminConfigurePage';
import { getInstalledPluginListPageRender } from '../../../../components/installedPluginListPage';
import { getPluginMarketListPageRender } from '../../../../components/pluginMarketListPage';
import { getRcAccessToken, getRcInfo, showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform, buttonId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const pluginList = await getPluginList();
        const pluginListToRender = [];
        let userSettings;
        switch (buttonId) {
            case 'installButton':
                const adminSettingsForInstall = await getAdminSettings({ serverUrl: manifest.serverUrl });
                if (!adminSettingsForInstall?.userSettings) {
                    adminSettingsForInstall.userSettings = {};
                }
                const config = {};
                for (const c of data.body.button.formData.plugin.pageContent) {
                    config[c.const] = {
                        value: null,
                        customizable: true
                    };
                }
                adminSettingsForInstall.userSettings[`plugin_${data.body.button.formData.pluginId}`] =
                {
                    value: {
                        name: data.body.button.formData.plugin.name,
                        version: data.body.button.formData.plugin.version,
                        isAsync: data.body.button.formData.plugin.isAsync,
                        logTypes: data.body.button.formData.plugin.supportedLogTypes,
                        access: data.body.button.formData.access,
                        requireLicense: data.body.button.formData.plugin.requireLicense,
                        config
                    },
                    customizable: true
                }
                await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForInstall });
                try {
                    await axios.post(`${manifest.serverUrl}/plugin/register`, {
                        pluginId: data.body.button.formData.pluginId,
                        pluginAccess: data.body.button.formData.access,
                        pluginName: data.body.button.formData.plugin.name
                    });
                } catch (registerError) {
                    adminSettingsForInstall.userSettings[`plugin_${data.body.button.formData.pluginId}`].isRemoved = true;
                    await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForInstall });
                    throw registerError;
                }
                userSettings = await refreshUserSettings({});
                // Refresh detail config page to installed state
                const pluginConfigurePageRender = getPluginAdminConfigurePageRender({
                    pluginId: data.body.button.formData.pluginId,
                    pluginAccess: data.body.button.formData.access,
                    plugin: data.body.button.formData.plugin,
                    installed: true
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: pluginConfigurePageRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${pluginConfigurePageRender.id}`
                }, '*');
                // Refresh market page
                for (const plugin of pluginList) {
                    if (getPluginSetting(userSettings, plugin.id)) {
                        continue;
                    }
                    pluginListToRender.push(plugin);
                }
                const pluginMarketPageRender = getPluginMarketListPageRender({
                    pluginList: pluginListToRender,
                    searchWord: '',
                    filter: null
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: pluginMarketPageRender
                });

                // Refresh installed plugin list page
                const installedPlugins = getAllPluginSettings(userSettings);
                const installedPluginsToRender = [];
                for (const pluginId in installedPlugins) {
                    const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
                    if (targetPlugin) {
                        installedPluginsToRender.push(targetPlugin);
                    }
                }
                const installedPluginListPageRender = getInstalledPluginListPageRender({ pluginList: installedPluginsToRender, isFromAdmin: true });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: installedPluginListPageRender
                });
                break;
            case 'removeButton':
                const adminSettingsForRemove = await getAdminSettings({ serverUrl: manifest.serverUrl });
                adminSettingsForRemove.userSettings[`plugin_${data.body.button.formData.pluginId}`].isRemoved = true;
                await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForRemove });
                try {
                    await axios.delete(`${manifest.serverUrl}/plugin/unregister?pluginName=${data.body.button.formData.plugin.name}&pluginId=${data.body.button.formData.pluginId}`);
                }
                catch (unregisterError) {
                    console.error(unregisterError);
                    throw unregisterError;
                }
                userSettings = await refreshUserSettings({ settingKeysToRemove: [`plugin_${data.body.button.formData.pluginId}`] });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack'
                }, '*');
                for (const pluginId in getAllPluginSettings(userSettings)) {
                    const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
                    if (targetPlugin) {
                        pluginListToRender.push(targetPlugin);
                    }
                }
                // Refresh installed plugin list page
                const pluginListPageRender = getInstalledPluginListPageRender({ pluginList: pluginListToRender, isFromAdmin: true });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: pluginListPageRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${pluginListPageRender.id}`
                }, '*');
                break;
        }
    } catch (e) {
        showNotification({
            level: 'error',
            message: e.response?.data?.returnMessage || e.message || 'Plugin installation failed.',
            ttl: 5000
        });
        console.error(e);
    } finally {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
}

exports.onEvent = onEvent;
