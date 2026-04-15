import adminCore from '../../../../../core/admin';
import managedAuthenticationPage from '../../../../../components/admin/managedAuthenticationPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const managedAuthSettings = await adminCore.getManagedAuthSettings({ serverUrl: manifest.serverUrl });
    const page = managedAuthenticationPage.getManagedAuthenticationPageRender({
        hasOrgFields: (managedAuthSettings?.orgFields ?? []).length > 0,
        hasUserFields: (managedAuthSettings?.userFields ?? []).length > 0
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
