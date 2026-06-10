import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const dataKeys = [...new Set((platform.adminSettings ?? [])
            .filter(setting => setting.accountDataKey)
            .map(setting => setting.accountDataKey))];
        if (dataKeys.length === 0) {
            showNotification({ level: 'info', message: 'No account data to refresh for this platform.', ttl: 3000 });
            return;
        }
        await adminCore.getAccountData({ serverUrl: manifest.serverUrl, keys: dataKeys, forceRefresh: true });
        showNotification({ level: 'success', message: 'Account data refreshed.', ttl: 3000 });
    }
    catch (e) {
        console.error('Error refreshing account data:', e);
        showNotification({ level: 'error', message: 'Failed to refresh account data. Please try again.', ttl: 3000 });
    }
    finally {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
}

exports.onEvent = onEvent;
