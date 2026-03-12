import axios from 'axios';
import authCore from '../../../../core/auth';
import { showNotification } from '../../../../lib/util';
import { t } from '../../../../i18n';
import { getPluginConfigurePageRender } from '../../../../components/pluginConfigurePage';

async function onEvent({ data, buttonId, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    switch (buttonId) {
        case 'pluginAuthButton':
            const getAuthUriResponse = await axios.get(`${data.body.button.formData.plugin.authorizationUrl}?jwtToken=${rcUnifiedCrmExtJwt}&pluginId=${data.body.button.formData.pluginId}`);
            const authUri = getAuthUriResponse.data;
            authCore.handleThirdPartyOAuthWindow(authUri);
            break;
        case 'pluginLogoutButton':
            const logoutResponse = await axios.post(`${data.body.button.formData.plugin.logoutUrl}?jwtToken=${rcUnifiedCrmExtJwt}`);
            if (logoutResponse.data.successful) {
                showNotification({ level: 'success', message: t('notifications.success.loggedOut'), ttl: 3000 });
                const pluginConfigurePageRender = getPluginConfigurePageRender({
                    pluginId: data.body.button.formData.pluginId,
                    pluginAccess: data.body.button.formData.access,
                    plugin: data.body.button.formData.plugin,
                    config: data.body.button.formData.config,
                    isLoggedIn: false
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

