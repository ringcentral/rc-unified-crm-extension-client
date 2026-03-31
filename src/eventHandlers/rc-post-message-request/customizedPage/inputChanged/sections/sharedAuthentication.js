import adminCore from '../../../../../core/admin';
import sharedAuthenticationPage from '../../../../../components/admin/sharedAuthenticationPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const sharedAuthSettings = await adminCore.getSharedAuthSettings({ serverUrl: manifest.serverUrl });
    const page = sharedAuthenticationPage.getSharedAuthenticationPageRender({
        hasOrgFields: (sharedAuthSettings?.orgFields ?? []).length > 0,
        hasUserFields: (sharedAuthSettings?.userFields ?? []).length > 0
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${page.id}`,
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;
