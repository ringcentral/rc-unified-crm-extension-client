import contactSearch from '../../../core/customContactSearch';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const contactToBeSearch = data.body.button.formData.contactNameToSearch;
    const customContactSearchResponse = await contactSearch.getCustomContactSearchData({ serverUrl: manifest.serverUrl, platform, contactSearch: contactToBeSearch, pageId: "contactSearchResultCallLog", contactPhoneNumber: data.body.button.formData?.contactPhoneNumber });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: customContactSearchResponse
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${customContactSearchResponse.id}`,
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;