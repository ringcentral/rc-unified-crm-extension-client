import axios from 'axios';
import authCore from '../../../../core/auth';
import { showNotification } from '../../../../lib/util';
import { t } from '../../../../i18n';
import { getMergedPluginConfigFromFormData, getPluginConfigurePageRender } from '../../../../components/pluginConfigurePage';
import pluginService from '../../../../service/pluginService';

async function onEvent({ data, buttonId, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    switch (buttonId) {
        case 'pluginAuthButton':
            const getAuthUriResponse = await axios.get(`${data.body.button.formData.plugin.authorizationUrl}?pluginId=${data.body.button.formData.pluginId}`);
            const authUri = getAuthUriResponse.data?.authUrl ?? getAuthUriResponse.data;
            authCore.handleThirdPartyOAuthWindow(authUri);
            await chrome.storage.local.set({ 'cachedPluginConfigFormData': data.body.button.formData });
            break;
        case 'pluginLogoutButton':
            const logoutResponse = await axios.post(`${data.body.button.formData.plugin.logoutUrl}`,
                {
                    jwtToken: rcUnifiedCrmExtJwt
                }
            );
            const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ pluginId: data.body.button.formData.pluginId, plugin: data.body.button.formData.plugin });
            if (logoutResponse.data.successful) {
                showNotification({ level: 'success', message: t('notifications.success.loggedOut'), ttl: 3000 });
                const pluginConfigurePageRender = getPluginConfigurePageRender({
                    pluginId: data.body.button.formData.pluginId,
                    pluginAccess: data.body.button.formData.access,
                    plugin: data.body.button.formData.plugin,
                    config: getMergedPluginConfigFromFormData(data.body.button.formData),
                    isLoggedIn: false,
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
            }
            else {
                showNotification({ level: 'error', message: t('notifications.error.logoutFailed'), ttl: 3000 });
            }
            break;
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

