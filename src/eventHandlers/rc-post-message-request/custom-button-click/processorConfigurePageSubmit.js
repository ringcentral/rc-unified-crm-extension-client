import { refreshUserSettings } from '../../../core/user';
import { showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const form = data.body.button.formData;
    const changedSettings = {
        [`processor_${form.processorId}`]: {
            value: {
                name: form.processor.name,
                version: form.processor.version,
                activated: form.activated,
                isAsync: form.isAsync,
                phase: form.phase,
                access: form.access,
            }
        }
    }
    await refreshUserSettings({ changedSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack'
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: `Process is ${form.activated ? 'activated' : 'deactivated'}.`, ttl: 3000 });
}

exports.onEvent = onEvent;