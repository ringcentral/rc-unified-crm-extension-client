import managedAuthUserEditPage from '../../../../../components/admin/managedAuthUserEditPage';
import { getRcContactInfo } from '../../../../../lib/util';

async function onEvent({ data }) {
    const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null });
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const selectedExtension = rcExtensions.find((rc) => rc.id === data.body.formData.rcExtensionId);
    const page = managedAuthUserEditPage.getManagedAuthUserEditPageRender({
        userFields: managedAuthSettings?.userFields ?? [],
        userValues: managedAuthSettings?.userValues ?? [],
        rcExtension: selectedExtension,
        formData: data.body.formData,
        searchWord: data.body.formData?.searchWord ?? '',
        filter: data.body.formData?.filter ?? 'All'
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page
    });
}

exports.onEvent = onEvent;
