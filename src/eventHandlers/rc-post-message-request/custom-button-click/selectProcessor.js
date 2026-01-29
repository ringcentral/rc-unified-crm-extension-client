import axios from 'axios';
import baseManifest from '../../../manifest.json';
import { getRcInfo } from '../../../lib/util';
import { getProcessorConfigurePageRender } from '../../../components/processorConfigurePage';
import { getUserSettingsOnline } from '../../../core/user';
import { checkAuth } from '../../../core/auth';
import { showNotification } from '../../../lib/util';
import { getProcessorDetails } from '../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const isAuthorized = await checkAuth();
    if (!isAuthorized) {
        showNotification({ level: 'warning', message: `Please go to user settings page and connect to your ${manifest.platforms[platformName].displayName} account.`, ttl: 5000 });
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
    }
    const selectedProcessorId = listButtonItemId.split('=')[0];
    const selectedProcessorAccess = listButtonItemId.split('=')[1];
    const selectedProcessor = data.body.button.formData.processorList.find(processor => processor.id === selectedProcessorId);
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const processor = await getProcessorDetails({ selectedProcessor});
    const processorSetting = userSettings?.[`processor_${selectedProcessorId}`];
    const activated = processorSetting?.value?.activated ?? false;
    let isLoggedIn = false;
    if (processor?.showAuthorizationButton && processor?.authStateUrl) {
        try {
            const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
            const authResponse = await axios.get(`${processor.authStateUrl}?jwtToken=${rcUnifiedCrmExtJwt}`);
            isLoggedIn = authResponse.data.successful;
            if (authResponse.data.returnMessage) {
                showNotification({ level: authResponse.data.returnMessage.messageType, message: authResponse.data.returnMessage.message, ttl: 3000 });
            }
        }
        catch (error) {
            console.error(error);
            if (error.response?.data?.returnMessage) {
                showNotification({ level: error.response.data.returnMessage.messageType, message: error.response.data.returnMessage.message, ttl: 3000 });
            }
            isLoggedIn = false;
        }
    }
    const processorConfigurePageRender = getProcessorConfigurePageRender({ processorId: selectedProcessorId, processorAccess: selectedProcessorAccess, processor, activated, isLoggedIn });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: processorConfigurePageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${processorConfigurePageRender.id}`
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;