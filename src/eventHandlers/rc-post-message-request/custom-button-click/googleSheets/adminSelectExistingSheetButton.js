const { getRcInfo } = require('../../../../core/user');

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { rcUnifiedCrmExtJwt: adminTokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const rcInfo = await getRcInfo();
    const rcAccountId = rcInfo?.value?.cachedData?.accountInfo?.id?.toString()
        || rcInfo?.value?.cachedData?.extensionInfo?.account?.id?.toString();
    // Store current form data to preserve forceGoogleSheets state
    await chrome.storage.local.set({
        pendingAdminGoogleSheetsSelection: {
            forceGoogleSheets: !(data.body.button.formData.forceGoogleSheets?.customizable ?? true),
            timestamp: Date.now()
        }
    });

    window.open(`${manifest.serverUrl}/admin/googleSheets/filePicker?jwtToken=${adminTokenForExistingSheet}&rcAccountId=${rcAccountId}`, '_blank');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack', // page id
    }, '*');
}

exports.onEvent = onEvent;

