import sharedAuthUserEditPage from '../../../../components/admin/sharedAuthUserEditPage';
import { getRcContactInfo } from '../../../../lib/util';

async function onEvent({ data, listButtonItemId }) {
    const { sharedAuthSettings } = await chrome.storage.local.get({ sharedAuthSettings: null });
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const selectedExtension = rcExtensions.find((rc) => rc.id === listButtonItemId);
    const page = sharedAuthUserEditPage.getSharedAuthUserEditPageRender({
        userFields: sharedAuthSettings?.userFields ?? [],
        userValues: sharedAuthSettings?.userValues ?? [],
        rcExtension: selectedExtension,
        formData: {
            rcExtensionId: selectedExtension?.id ?? ''
        },
        searchWord: data.body.button.formData?.userSearch?.search ?? '',
        filter: data.body.button.formData?.userSearch?.filter ?? 'All'
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
