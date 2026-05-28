import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

async function onEvent({ manifest, platformName }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        await adminCore.deleteManagedOAuthAccount({
            serverUrl: manifest.serverUrl,
            platformName
        });
    }
    catch (error) {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        showNotification({ level: 'error', message: 'Failed to delete managed OAuth account. Please try again.', ttl: 3000 });
        return;
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'success', message: 'Managed OAuth account deleted.', ttl: 3000 });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
}

exports.onEvent = onEvent;
