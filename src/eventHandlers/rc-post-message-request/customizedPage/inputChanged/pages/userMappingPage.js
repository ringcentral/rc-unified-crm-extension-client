import userMappingPage from '../../../../../components/admin/userMappingPage/userMappingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    // Case: user search in userMappingList
    if (data.body.formData.userSearch) {
        const userMappingPageRender = userMappingPage.getUserMappingPageRender({
            userMapping: data.body.formData.allUserMapping,
            platformDisplayName: platform.displayName,
            searchWord: data.body.formData.userSearch.search,
            filter: data.body.formData.userSearch.filter
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: userMappingPageRender
        });
    }
}

exports.onEvent = onEvent;