import adminCore from '../../../core/admin';
import { showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    await adminCore.reinitializeUserMapping({ serverUrl: manifest.serverUrl });
    showNotification({ level: 'success', message: 'User mapping reinitialized.', ttl: 5000 });
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;