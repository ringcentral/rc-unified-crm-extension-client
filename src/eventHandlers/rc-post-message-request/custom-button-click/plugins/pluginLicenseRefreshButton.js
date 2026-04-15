import pluginService from '../../../../service/pluginService';
import { getPluginConfigurePageRender } from '../../../../components/pluginConfigurePage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const pluginId = data.body.button.formData.pluginId;
        const { licenseStatus, licenseStatusDescription } = await pluginService.getPluginLicenseStatus({ pluginId, plugin: data.body.button.formData.plugin });
        const pluginConfigurePageRender = getPluginConfigurePageRender({
            pluginId,
            pluginAccess: data.body.button.formData.access,
            plugin: data.body.button.formData.plugin,
            config: data.body.button.formData.config,
            isLoggedIn: data.body.button.formData.isLoggedIn,
            hasValidLicense: licenseStatus,
            licenseStatusDescription
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: "rc-adapter-register-customized-page",
            page: pluginConfigurePageRender
        });
    }
    catch (error) {
        console.error(error);
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;