import editUserMappingPage from '../../../../components/admin/userMappingPage/editUserMappingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (data.body.formData.searchWord) {
        const editUserMappingPageRender = editUserMappingPage.renderEditUserMappingPage({
            userMapping: data.body.formData.userMapping,
            platformDisplayName: platform.displayName,
            rcExtensions: data.body.formData.rcExtensions,
            selectedRcExtensionId: data.body.formData.rcExtensionList
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: editUserMappingPageRender
        });
    }
}

exports.onEvent = onEvent;