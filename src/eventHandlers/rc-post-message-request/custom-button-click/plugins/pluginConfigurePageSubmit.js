import { refreshUserSettings } from '../../../../core/user';
import { getRcInfo, showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo.value.cachedData.extensionInfo.account.id;
    const form = data.body.button.formData;
    const config = form.config;
    for (const k in config) {
        config[k] = {
            value: form[k],
            customizable: config[k].customizable
        };
    }
    const changedSettings = {
        [`plugin_${form.pluginId}`]: {
            value: {
                name: form.plugin.name,
                version: form.plugin.version,
                isAsync: form.isAsync,
                phase: form.phase,
                access: form.access,
                logTypes: form.logTypes,
                rcAccountId,
                config
            },
            isCustomizable: true
        }
    }
    const userSettings = await refreshUserSettings({ changedSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack'
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: `Configuration is updated.`, ttl: 3000 });
}

exports.onEvent = onEvent;

