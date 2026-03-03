import userCore from '../../../core/user';
import authCore from '../../../core/auth';
import { trackFactoryReset } from '../../../lib/analytics';
import { clearPlatformInfo } from '../../../service/platformService';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (rcUnifiedCrmExtJwt) {
        await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: "" });
        await authCore.unAuthorize({ serverUrl: manifest.serverUrl, rcUnifiedCrmExtJwt });
        if (platform.useLicense) {
            await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl });
        }
    }
    await clearPlatformInfo();
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-logout'
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    trackFactoryReset();
}

exports.onEvent = onEvent;