import { getPluginList } from '../../../service/manifestService';
import { refreshUserSettings } from '../../../core/user';
import { getAdminSettings, uploadAdminSettings } from '../../../core/admin';
import { getPluginAdminConfigurePageRender } from '../../../components/pluginAdminConfigurePage';
import { getInstalledPluginListPageRender } from '../../../components/installedPluginListPage';
import { getPluginMarketListPageRender } from '../../../components/pluginMarketListPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    let userSettings;
    switch (data.body.button.id) {
        case 'installButton':
            const adminSettingsForInstall = await getAdminSettings({ serverUrl: manifest.serverUrl });
            if (!adminSettingsForInstall?.userSettings) {
                adminSettingsForInstall.userSettings = {};
            }
            if (!adminSettingsForInstall?.userSettings?.plugins) {
                adminSettingsForInstall.userSettings.plugins = {};
            }
            adminSettingsForInstall.userSettings.plugins[`plugin_${data.body.button.formData.pluginId}`] =
            {
                value: {
                    name: data.body.button.formData.plugin.name,
                    version: data.body.button.formData.plugin.version,
                    activated: {
                        value: false,
                        isCustomized: true,
                    },
                    isAsync: data.body.button.formData.plugin.isAsync,
                    phase: data.body.button.formData.plugin.phase,
                    logType: data.body.button.formData.plugin.supportedLogType,
                    access: data.body.button.formData.access
                }
            }
            await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForInstall });
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
                if (Object.keys(userSettings.plugins ?? {}).includes(`plugin_${plugin.id}`)) {
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
            break;
        case 'removeButton':
            const adminSettingsForRemove = await getAdminSettings({ serverUrl: manifest.serverUrl });
            delete adminSettingsForRemove.userSettings.plugins[`plugin_${data.body.button.formData.pluginId}`];
            await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForRemove });
            userSettings = await refreshUserSettings({});
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: 'goBack'
            }, '*');
            for (const settingsKey in (userSettings.plugins ?? {})) {
                if (settingsKey.startsWith('plugin_')) {
                    const targetPlugin = pluginList.find(plugin => plugin.id === settingsKey.split('plugin_')[1]);
                    pluginListToRender.push(targetPlugin);
                }
            }
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
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;