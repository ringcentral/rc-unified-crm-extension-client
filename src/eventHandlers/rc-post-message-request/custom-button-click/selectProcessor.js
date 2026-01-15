import axios from 'axios';
import baseManifest from '../../../manifest.json';
import { getRcInfo } from '../../../lib/util';
import { getProcessorConfigurePageRender } from '../../../components/processorConfigurePage';
import { getUserSettingsOnline } from '../../../core/user';
import { checkAuth } from '../../../core/auth';
import { showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const isAuthorized = await checkAuth();
    if (!isAuthorized) {
        showNotification({ level: 'warning', message: `Please go to user settings page and connect to your ${manifest.platforms[platformName].displayName} account.`, ttl: 5000 });
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
    }
    const selectedProcessorId = listButtonItemId.split('=')[0];
    const selectedProcessorType = listButtonItemId.split('=')[1];
    const selectedProcessor = data.body.button.formData.processorList.find(processor => processor.id === selectedProcessorId);
    const rcInfo = await getRcInfo();
    let processorManifestResponse;
    switch (selectedProcessorType) {
        case 'public':
            processorManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedProcessorId}/manifest?type=processor`);
            break;
        case 'shared':
            processorManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedProcessorId}/manifest?access=internal&type=processor&accountId=${selectedProcessor.accountId}`);
            break;
        case 'private':
            processorManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedProcessorId}/manifest?access=internal&type=processor&accountId=${rcInfo.value.cachedData.accountInfo.id}`);
            break;
    }
    const userSettings = await getUserSettingsOnline({ serverUrl: manifest.serverUrl });
    const processorSetting = userSettings?.[`processor_${selectedProcessorId}`];
    const activated = processorSetting?.value?.activated ?? false;
    const selectedLogTypes = processorSetting?.value?.supportedLogTypes ?? [];
    const processor = processorManifestResponse.data?.platforms?.[selectedProcessor.name];
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
    const processorConfigurePageRender = getProcessorConfigurePageRender({ processorId: selectedProcessorId, processor, activated, selectedLogTypes, isLoggedIn });
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