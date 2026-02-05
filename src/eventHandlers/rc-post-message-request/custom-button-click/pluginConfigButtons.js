import axios from 'axios';
import baseManifest from '../../../manifest.json';
import authCore from '../../../core/auth';
import { showNotification } from '../../../lib/util';
import { refreshUserSettings } from '../../../core/user';
import { getPluginConfigurePageRender } from '../../../components/pluginConfigurePage';
import { getPluginList } from '../../../service/manifestService';
import { getInstalledPluginListPageRender } from '../../../components/installedPluginListPage';
import { getAdminSettings, uploadAdminSettings } from '../../../core/admin';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
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
                    activated: true,
                    isAsync: data.body.button.formData.plugin.isAsync,
                    phase: data.body.button.formData.plugin.phase,
                    logType: data.body.button.formData.plugin.supportedLogType,
                    access: data.body.button.formData.access,
                    isAdminOnly: data.body.button.formData.isAdminOnly,
                }
            }
            await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForInstall });
            await refreshUserSettings({});
            break;
        case 'authButton':
            const getAuthUriResponse = await axios.get(`${data.body.button.formData.plugin.authorizationUrl}?jwtToken=${rcUnifiedCrmExtJwt}&pluginId=${data.body.button.formData.pluginId}`);
            const authUri = getAuthUriResponse.data;
            authCore.handleThirdPartyOAuthWindow(authUri);
            break;
        case 'logoutButton':
            const logoutResponse = await axios.post(`${data.body.button.formData.plugin.logoutUrl}?jwtToken=${rcUnifiedCrmExtJwt}`);
            if (logoutResponse.data.successful) {
                showNotification({ level: 'success', message: 'Successfully logged out.', ttl: 3000 });
                const plugin = data.body.button.formData.plugin;
                const changedSettings = {
                    [`plugin_${data.body.button.formData.pluginId}`]: {
                        value: {
                            name: plugin.name,
                            version: plugin.version,
                            activated: false,
                            isAsync: plugin.isAsync,
                            phase: plugin.phase,
                            logType: plugin.supportedLogType,
                            access: data.body.button.formData.access,
                        }
                    }
                }
                const userSettings = await refreshUserSettings({ changedSettings });
                const pluginSetting = userSettings?.[`plugin_${data.body.button.formData.pluginId}`];
                const activated = pluginSetting?.value?.activated ?? false;
                const pluginAccess = data.body.button.formData.access;
                const isAdminOnly = pluginSetting?.value?.isAdminOnly ?? false;
                const pluginConfigurePageRender = getPluginConfigurePageRender({ pluginId: data.body.button.formData.pluginId, pluginAccess, plugin, isAdminOnly, activated, isLoggedIn: false });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: pluginConfigurePageRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${pluginConfigurePageRender.id}`
                }, '*');
            }
            else {
                showNotification({ level: 'error', message: 'Failed to log out.', ttl: 3000 });
            }
            break;
        case 'removeButton':
            const adminSettingsForRemove = await getAdminSettings({ serverUrl: manifest.serverUrl });
            delete adminSettingsForRemove.userSettings.plugins[`plugin_${data.body.button.formData.pluginId}`];
            await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings: adminSettingsForRemove });
            const userSettings = await refreshUserSettings({});
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: 'goBack'
            }, '*');
            const pluginList = await getPluginList();
            const pluginListToRender = [];
            for (const settingsKey in (userSettings.plugins ?? {})) {
                if (settingsKey.startsWith('plugin_')) {
                    const targetPlugin = pluginList.find(plugin => plugin.id === settingsKey.split('plugin_')[1]);
                    pluginListToRender.push(targetPlugin);
                }
            }
            const pluginListPageRender = getInstalledPluginListPageRender({ viewType: 'installed', pluginList: pluginListToRender });
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

