import axios from 'axios';
import { getPluginAdminConfigurePageRender } from '../../../../components/pluginAdminConfigurePage';
import { getPluginConfigurePageRender } from '../../../../components/pluginConfigurePage';
import { getUserSettingsOnline, getPluginSetting } from '../../../../core/user';
import { checkAuth } from '../../../../core/auth';
import { showNotification } from '../../../../lib/util';
import { getPluginDetails } from '../../../../service/manifestService';
import pluginService from '../../../../service/pluginService';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const isAuthorized = await checkAuth();
    if (!isAuthorized) {
        showNotification({ level: 'warning', message: `Please go to user settings page and connect to your ${manifest.platforms[platformName].displayName} account.`, ttl: 5000 });
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
    }
    if (!listButtonItemId) {
        listButtonItemId = data.body.formData.plugins;
    }
    const selectedPluginId = listButtonItemId.split('=')[0];
    const selectedPluginAccess = listButtonItemId.split('=')[1];
    const formData = data.body?.button?.formData ?? data.body.formData;
    const selectedPlugin = formData.pluginList.find(plugin => plugin.id === selectedPluginId);
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const pluginSetting = getPluginSetting(userSettings, selectedPluginId);
    const installed = !!pluginSetting;
    const plugin = await getPluginDetails({ selectedPlugin });
    const configSetting = pluginSetting?.config ?? {};
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
    const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ plugin });
    const pluginConfigurePageRender = formData.isFromAdmin ?
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
            isLoggedIn,
            hasValidLicense: licenseStatus,
            licenseStatusDescription
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

