import managedAuthOrgPage from '../../../../../components/admin/managedAuthOrgPage';

async function onEvent({ data }) {
    const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null });
    const page = managedAuthOrgPage.getManagedAuthOrgPageRender({
        orgFields: managedAuthSettings?.orgFields ?? [],
        orgValues: managedAuthSettings?.orgValues ?? {},
        formData: data.body.formData
    });
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
