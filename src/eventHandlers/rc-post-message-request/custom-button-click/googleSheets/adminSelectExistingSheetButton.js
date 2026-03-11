import { getRcAccessToken } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const rcAccessToken = getRcAccessToken();
    const { rcUnifiedCrmExtJwt: adminTokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    
    // Store current form data to preserve forceGoogleSheets state
    await chrome.storage.local.set({ 
        pendingAdminGoogleSheetsSelection: {
            forceGoogleSheets: !(data.body.button.formData.forceGoogleSheets?.customizable ?? true),
            timestamp: Date.now()
        }
    });
    
    window.open(`${manifest.serverUrl}/admin/googleSheets/filePicker?jwtToken=${adminTokenForExistingSheet}&rcAccessToken=${rcAccessToken}`, '_blank');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack', // page id
    }, '*');
}

exports.onEvent = onEvent;

