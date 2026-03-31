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
            let sharedManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${selectedPlatform.accountId}`;
            try {
                platformManifestResponse = await axios.get(sharedManifestUrl);
            }
            catch (e) {
                if (e.response.status === 404) {
                    sharedManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${selectedPlatform.accountId}`;
                    platformManifestResponse = await axios.get(sharedManifestUrl);
                }
                else {
                    throw e;
                }
            }
            await saveManifestUrl({ manifestUrl: sharedManifestUrl });
            break;
        case 'private':
            let privateManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${rcInfo.value.cachedData.accountInfo.id}`;
            try {
                platformManifestResponse = await axios.get(privateManifestUrl);
            }
            catch (e) {
                if (e.response.status === 404) {
                    privateManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${rcInfo.value.cachedData.accountInfo.id}`;
                    platformManifestResponse = await axios.get(privateManifestUrl);
                }
                else {
                    throw e;
                }
            }
            await saveManifestUrl({ manifestUrl: privateManifestUrl });
            break;
    }
    // eslint-disable-next-line no-param-reassign
    manifest = await saveManifest({ manifest: platformManifestResponse.data });
    if (manifest.platforms[selectedPlatform.name]?.environment?.type === 'fixed' && !manifest.platforms[selectedPlatform.name]?.environment?.instructions?.length) {
        const inputUrlObj = new URL(manifest.platforms[selectedPlatform.name]?.environment?.url);
        const inputHostname = inputUrlObj.hostname;
        await chrome.storage.local.set({
            ['platform-info']: {
                platformName: selectedPlatform.name,
                platformDisplayName: selectedPlatform.displayName ?? selectedPlatform.name,
                hostname: inputHostname,
                connectorId: selectedPlatform.id,
                isPrivate: selectedPlatformType === 'private'
            }
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
        const selectedPlatformConfig = manifest.platforms[selectedPlatform.name];
        const sharedAuthState = selectedPlatformConfig?.auth?.type === 'apiKey'
            ? await authCore.getSharedAuthState({
                serverUrl: manifest.serverUrl,
                platformName: selectedPlatform.name,
                connectorId: selectedPlatform.id,
                isPrivate: selectedPlatformType === 'private',
                rcInfo
            })
            : null;
        const hostnameInputPageRender = hostnameInputPage.getHostnameInputPageRender({
            platform: selectedPlatformConfig,
            isUrlValid: true,
            submitText: sharedAuthState?.allRequiredFieldsSatisfied ? 'Connect' : undefined,
            connectorId: selectedPlatform.id,
            isPrivate: selectedPlatformType === 'private'
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
