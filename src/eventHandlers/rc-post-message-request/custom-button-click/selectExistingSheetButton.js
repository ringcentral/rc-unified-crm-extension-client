async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { rcUnifiedCrmExtJwt: tokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    window.open(`${manifest.serverUrl}/googleSheets/filePicker?token=${tokenForExistingSheet}`, '_blank');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack', // page id
    }, '*');
}

exports.onEvent = onEvent;