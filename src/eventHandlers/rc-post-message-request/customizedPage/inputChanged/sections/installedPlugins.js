import { getInstalledPluginListPageRender } from '../../../../../components/installedPluginListPage';
import { getPluginList } from '../../../../../service/manifestService';
import { getAllPluginSettings } from '../../../../../core/user';
import pluginService from '../../../../../service/pluginService';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const pluginList = await getPluginList();
    const pluginListToRender = [];
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const installedPlugins = getAllPluginSettings(adminSettings.userSettings);
    for (const pluginId in installedPlugins) {
        const targetPlugin = pluginList.find(plugin => plugin.id === pluginId);
        targetPlugin.requireLicense = installedPlugins[pluginId].requireLicense;
        targetPlugin.licenseStatusUrl = installedPlugins[pluginId].licenseStatusUrl;
        if (targetPlugin) {
            pluginListToRender.push(targetPlugin);
        }
    }
    // fetch license status for all plugins as a batch
    const licenseStatuses = await Promise.all(pluginListToRender.map(plugin => pluginService.getPluginLicenseStatus({ plugin })));
    for (const plugin of pluginListToRender) {
        const licenseStatus = licenseStatuses.find(status => status.id === plugin.id);
        plugin.licenseStatus = licenseStatus.licenseStatus;
        plugin.licenseStatusDescription = licenseStatus.licenseStatusDescription;
        plugin.errorMessage = licenseStatus.errorMessage;
    }
    const installedPluginListPageRender = getInstalledPluginListPageRender({ pluginList: pluginListToRender, isFromAdmin: true });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: installedPluginListPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${installedPluginListPageRender.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;