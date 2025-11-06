import adminCore from '../../../../core/admin';
import userMappingPage from '../../../../components/admin/userMappingPage/userMappingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const userMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
    adminSettings.userMappings = userMapping.map(um => ({
        crmUserId: um.crmUser.id,
        rcExtensionId: um.rcUser?.map(rc => rc.extensionId) ?? []
    }));
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping, platformDisplayName: platform.displayName });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: userMappingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${userMappingPageRender.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;