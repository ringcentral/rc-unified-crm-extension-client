import contactSearch from '../../../../core/customContactSearch';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const contactNameToBeSearch = data.body.button.formData.contactNameToSearch;
    const customContactSearchRes = await contactSearch.getCustomContactSearchData({ serverUrl: manifest.serverUrl, platform, contactSearch: contactNameToBeSearch, pageId: "contactSearchResultMessageLog", contactPhoneNumber: data.body.button.formData?.contactPhoneNumber });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: customContactSearchRes
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${customContactSearchRes.id}`,
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;