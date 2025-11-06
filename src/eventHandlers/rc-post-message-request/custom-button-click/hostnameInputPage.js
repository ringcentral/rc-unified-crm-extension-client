import embeddableServices from '../../../service/embeddableServices';
import authCore from '../../../core/auth';

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
        ['platform-info']: { platformName: data.body.button.formData.platformId, platformDisplayName: data.body.button.formData.platformDisplayName, hostname: inputHostname }
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

exports.onEvent = onEvent;