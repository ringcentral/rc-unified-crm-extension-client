import axios from 'axios';
import { saveManifest, saveManifestUrl } from '../../../../service/manifestService';
import hostnameInputPage from '../../../../components/hostnameInputPage';
import authCore from '../../../../core/auth';
import baseManifest from '../../../../manifest.json';
import { getRcInfo } from '../../../../lib/util';
import embeddableServices from '../../../../service/embeddableServices';

async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const selectedPlatformId = listButtonItemId.split('=')[0];
    const selectedPlatformType = listButtonItemId.split('=')[1];
    const selectedPlatform = data.body.button.formData.platformList.find(platform => platform.id === selectedPlatformId);
    // eslint-disable-next-line no-param-reassign
    platformName = selectedPlatform.name;
    let platformManifestResponse;
    const rcInfo = await getRcInfo();
    switch (selectedPlatformType) {
        case 'public':
            platformManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?type=connector`);
            await saveManifestUrl({ manifestUrl: `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?type=connector` });
            break;
        case 'shared':
            platformManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${selectedPlatform.accountId}`);
            await saveManifestUrl({ manifestUrl: `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${selectedPlatform.accountId}` });
            break;
        case 'private':
            platformManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${rcInfo.value.cachedData.accountInfo.id}`);
            await saveManifestUrl({ manifestUrl: `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${rcInfo.value.cachedData.accountInfo.id}` });
            break;
    }
    // eslint-disable-next-line no-param-reassign
    manifest = await saveManifest({ manifest: platformManifestResponse.data });
    if (manifest.platforms[selectedPlatform.name]?.environment?.type === 'fixed' && !manifest.platforms[selectedPlatform.name]?.environment?.instructions?.length) {
        const inputUrlObj = new URL(manifest.platforms[selectedPlatform.name]?.environment?.url);
        const inputHostname = inputUrlObj.hostname;
        await chrome.storage.local.set({
            ['platform-info']: { platformName: selectedPlatform.name, platformDisplayName: selectedPlatform.displayName ?? selectedPlatform.name, hostname: inputHostname }
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-third-party-service',
            service: (await embeddableServices.getServiceManifest())
        }, '*');
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: '/settings',
        }, '*');
        await authCore.onUserClickConnectButton({ platform, platformName, manifest });
    }
    else {
        const hostnameInputPageRender = hostnameInputPage.getHostnameInputPageRender({
            platform: manifest.platforms[selectedPlatform.name],
            isUrlValid: true
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: hostnameInputPageRender,
        }, '*');
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/customized/${hostnameInputPageRender.id}`,
        }, '*');
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;