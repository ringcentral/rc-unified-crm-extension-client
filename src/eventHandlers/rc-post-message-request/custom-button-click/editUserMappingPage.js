import adminCore from '../../../core/admin';
import userMappingPage from '../../../components/admin/userMappingPage/userMappingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform, recordIdFromId }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const { crmUserId, rcExtensionList } = data.body.button.formData;
    const userMapping = {
        crmUserId: crmUserId.toString(),
        rcExtensionId: rcExtensionList
    };
    if (adminSettings?.userMappings) {
        const existingUserMapping = adminSettings.userMappings.find(um => um.crmUserId == userMapping.crmUserId);
        if (existingUserMapping) {
            // Case: delete
            if (userMapping.rcExtensionId?.length === 0) {
                adminSettings.userMappings = adminSettings.userMappings.filter(um => um.crmUserId !== existingUserMapping.crmUserId);
            }
            // Case: update
            else {
                existingUserMapping.rcExtensionId = userMapping.rcExtensionId;
            }
        }
        // case: create
        else {
            adminSettings.userMappings.push(
                userMapping
            )
        }
    }
    else if (userMapping.rcExtensionId?.length > 0) {
        adminSettings.userMappings = [
            userMapping
        ]
    }
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    const updatedUserMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
    const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping: updatedUserMapping, platformDisplayName: platform.displayName });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: userMappingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack', // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;