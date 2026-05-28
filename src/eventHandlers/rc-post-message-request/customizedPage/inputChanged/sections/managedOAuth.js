import managedOAuthAdminPage from '../../../../../components/admin/managedOAuthAdminPage';

async function onEvent() {
    const page = managedOAuthAdminPage.getManagedOAuthAdminPageRender();
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${page.id}`,
    }, '*');
}

exports.onEvent = onEvent;
