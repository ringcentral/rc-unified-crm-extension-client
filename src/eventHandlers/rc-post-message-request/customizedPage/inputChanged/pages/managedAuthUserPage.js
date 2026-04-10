import managedAuthUserPage from '../../../../../components/admin/managedAuthUserPage';
import { getRcContactInfo } from '../../../../../lib/util';

async function onEvent({ data }) {
    const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null });
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const page = managedAuthUserPage.getManagedAuthUserPageRender({
        userFields: managedAuthSettings?.userFields ?? [],
        userValues: managedAuthSettings?.userValues ?? [],
        rcExtensions,
        searchWord: data.body.formData?.userSearch?.search ?? '',
        filter: data.body.formData?.userSearch?.filter ?? 'All'
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
