import embeddableServices from '../../../../service/embeddableServices';
import authCore from '../../../../core/auth';
import { getManifest, saveManifest } from '../../../../service/manifestService';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    let inputUrl = '';
    switch (manifest.platforms[data.body.button.formData.platformId].environment.type) {
        case 'selectable':
            inputUrl = data.body.button.formData.selection;
            break;
        case 'dynamic':
            inputUrl = data.body.button.formData.url;
            break;
        case 'fixed':
            inputUrl = manifest.platforms[data.body.button.formData.platformId].environment.url;
            break;
    }
    const inputUrlObj = new URL(inputUrl);
    const inputHostname = inputUrlObj.hostname;
    await chrome.storage.local.set({
        ['platform-info']: {
            platformName: data.body.button.formData.platformId,
            platformDisplayName: data.body.button.formData.platformDisplayName,
            hostname: inputHostname,
            connectorId: data.body.button.formData.connectorId ?? '',
            isPrivate: !!data.body.button.formData.isPrivate
        }
    });
    manifest = await getManifest(true);
    await saveManifest({ manifest });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: (await embeddableServices.getServiceManifest())
    }, '*');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/settings',
    }, '*');
    const selectedPlatform = manifest.platforms[data.body.button.formData.platformId];
    const managedOAuthResult = await authCore.checkManagedOAuthBeforeCrmVisible({
        manifest,
        platformName: data.body.button.formData.platformId,
        platform: selectedPlatform
    });
    if (managedOAuthResult.blocked) {
        return;
    }
    await authCore.onUserClickConnectButton({
        platform: selectedPlatform,
        platformName: data.body.button.formData.platformId,
        manifest
    });
}

exports.onEvent = onEvent;
