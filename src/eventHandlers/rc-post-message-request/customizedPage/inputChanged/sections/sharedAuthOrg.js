import sharedAuthOrgPage from '../../../../../components/admin/sharedAuthOrgPage';

async function onEvent() {
    const { sharedAuthSettings } = await chrome.storage.local.get({ sharedAuthSettings: null });
    const page = sharedAuthOrgPage.getSharedAuthOrgPageRender({
        orgFields: sharedAuthSettings?.orgFields ?? [],
        orgValues: sharedAuthSettings?.orgValues ?? {}
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
