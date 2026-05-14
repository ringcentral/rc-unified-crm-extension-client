import userCore from '../../core/user';
import authCore from '../../core/auth';
import calldownPage from '../../components/calldownPage';
import { responseMessage } from '../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    await chrome.storage.local.set({ crmAuthed: !!rcUnifiedCrmExtJwt });
    if (!rcUnifiedCrmExtJwt) {
        await authCore.onUserClickConnectButton({ platform, platformName, manifest });
    }
    else {
        window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
        await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: "" });
        await authCore.unAuthorize({ serverUrl: manifest.serverUrl, rcUnifiedCrmExtJwt });

        // Clear call back page after CRM disconnect
        const { userSettings } = await chrome.storage.local.get('userSettings');
        if (userCore.getShowCalldownTabSetting(userSettings).value) {
            const emptyCalldownPage = calldownPage.getCalldownPageRender(); // Get empty page
            emptyCalldownPage.hidden = true; // Hide the tab when CRM is disconnected
            emptyCalldownPage.unreadCount = 0; // Explicitly set badge to 0
            document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: emptyCalldownPage
            }, '*');
        }

        if (platform.useLicense) {
            await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl });
        }
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
    responseMessage(data.requestId, { data: 'ok' });
}

exports.onEvent = onEvent;