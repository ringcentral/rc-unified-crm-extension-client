import axios from 'axios';
import baseManifest from '../../../manifest.json';
import { getRcInfo } from '../../../lib/util';
import { getPluginAdminConfigurePageRender } from '../../../components/pluginAdminConfigurePage';
import { getPluginConfigurePageRender } from '../../../components/pluginConfigurePage';
import { getUserSettingsOnline } from '../../../core/user';
import { checkAuth } from '../../../core/auth';
import { showNotification } from '../../../lib/util';
import { getPluginDetails } from '../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const isAuthorized = await checkAuth();
    if (!isAuthorized) {
        showNotification({ level: 'warning', message: `Please go to user settings page and connect to your ${manifest.platforms[platformName].displayName} account.`, ttl: 5000 });
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
    }
    const selectedPluginId = listButtonItemId.split('=')[0];
    const selectedPluginAccess = listButtonItemId.split('=')[1];
    const selectedPlugin = data.body.button.formData.pluginList.find(plugin => plugin.id === selectedPluginId);
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const installed = Object.keys(userSettings?.plugins ?? {}).includes(`plugin_${selectedPluginId}`);
    const plugin = await getPluginDetails({ selectedPlugin });
    const pluginSetting = userSettings?.plugins?.[`plugin_${selectedPluginId}`];
    const configSetting = pluginSetting?.value?.config ?? {};
    let isLoggedIn = false;
    if (plugin?.showAuthorizationButton && plugin?.authStateUrl) {
        try {
            const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
            const authResponse = await axios.get(`${plugin.authStateUrl}?jwtToken=${rcUnifiedCrmExtJwt}`);
            isLoggedIn = authResponse.data.successful;
            if (authResponse.data.returnMessage) {
                showNotification({ level: authResponse.data.returnMessage.messageType, message: authResponse.data.returnMessage.message, ttl: 3000 });
            }
        }
        catch (error) {
            console.error(error);
            if (error.response?.data?.returnMessage) {
                showNotification({ level: error.response.data.returnMessage.messageType, message: error.response.data.returnMessage.message, ttl: 3000 });
            }
            isLoggedIn = false;
        }
    }
    const pluginConfigurePageRender = data.body.button.formData.isFromAdmin ?
        getPluginAdminConfigurePageRender({
            pluginId: selectedPluginId,
            pluginAccess: selectedPluginAccess,
            plugin,
            installed,
        }) :
        getPluginConfigurePageRender({
            pluginId: selectedPluginId,
            pluginAccess: selectedPluginAccess,
            plugin,
            config: configSetting,
            isLoggedIn
        });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: pluginConfigurePageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${pluginConfigurePageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

