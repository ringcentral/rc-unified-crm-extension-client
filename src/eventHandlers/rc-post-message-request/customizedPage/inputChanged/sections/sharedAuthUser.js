import sharedAuthUserPage from '../../../../../components/admin/sharedAuthUserPage';
import { getRcContactInfo } from '../../../../../lib/util';

async function onEvent() {
    const { sharedAuthSettings } = await chrome.storage.local.get({ sharedAuthSettings: null });
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const page = sharedAuthUserPage.getSharedAuthUserPageRender({
        userFields: sharedAuthSettings?.userFields ?? [],
        userValues: sharedAuthSettings?.userValues ?? [],
        rcExtensions,
        searchWord: '',
        filter: 'All'
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
