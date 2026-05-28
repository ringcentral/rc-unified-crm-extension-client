import authCore from '../../../../core/auth';
import { showNotification } from '../../../../lib/util';

async function onEvent({ data, manifest, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const formData = data.body.button.formData ?? {};
        await authCore.saveManagedOAuthPendingValues({
            serverUrl: manifest.serverUrl,
            values: {
                clientId: formData.clientId,
                clientSecret: formData.clientSecret,
                accessTokenUri: formData.accessTokenUri,
                authorizationUri: formData.authorizationUri,
                redirectUri: formData.redirectUri,
                scopes: formData.scopes,
                hostname: formData.hostname
            }
        });
        showNotification({
            level: 'success',
            message: 'OAuth credentials will be saved after you, as the first user, successfully connect to CRM. To re-enter them, close and reopen the extension.',
            ttl: 10000
        });
        await authCore.onUserClickConnectButton({ platform, platformName, manifest });
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: 'goBack',
        }, '*');
    }
    catch (error) {
        showNotification({
            level: 'error',
            message: 'Failed to save OAuth credentials. Please try again.',
            ttl: 5000
        });
    }
    finally {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
}

exports.onEvent = onEvent;
