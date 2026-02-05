import { refreshUserSettings } from '../../../core/user';
import { getRcInfo, showNotification } from '../../../lib/util';
import { getPluginList } from '../../../service/manifestService';
import { getPluginListPageRender } from '../../../components/pluginMarketListPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo.value.cachedData.extensionInfo.account.id;
    const form = data.body.button.formData;
    const changedSettings = {
        [`plugin_${form.pluginId}`]: {
            value: {
                name: form.plugin.name,
                version: form.plugin.version,
                activated: form.activated,
                isAsync: form.isAsync,
                phase: form.phase,
                access: form.access,
                logType: form.logType,
                rcAccountId,
            }
        }
    }
    const userSettings = await refreshUserSettings({ changedSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack'
    }, '*');
    // const pluginList = await getPluginList();
    // const pluginListToRender = [];
    // for (const settingsKey in userSettings) {
    //     if (settingsKey.startsWith('plugin_')) {
    //         const targetPlugin = pluginList.find(plugin => plugin.id === settingsKey.split('plugin_')[1]);
    //         pluginListToRender.push(targetPlugin);
    //     }
    // }
    // const pluginListPageRender = getPluginListPageRender({ viewType: 'installed', pluginList: pluginListToRender });
    // document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    //     type: 'rc-adapter-register-customized-page',
    //     page: pluginListPageRender
    // });
    // document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    //     type: 'rc-adapter-navigate-to',
    //     path: `/customized/${pluginListPageRender.id}`
    // }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: `Process is ${form.viewType === 'installed' ? 'updated' : 'installed'}.`, ttl: 3000 });
}

exports.onEvent = onEvent;

