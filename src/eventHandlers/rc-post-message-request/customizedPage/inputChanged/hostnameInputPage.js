import hostnameInputPage from '../../../../components/hostnameInputPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    let isUrlValid = true;
    if (manifest.platforms[data.body.formData.platformId]?.environment?.url) {
        const urlIdentifierRegex = new RegExp(manifest.platforms[data.body.formData.platformId].environment.url.replace(/\*/g, '.*'));
        isUrlValid = urlIdentifierRegex.test(data.body.formData.url);
    }
    const hostnameInputPageRender = hostnameInputPage.getHostnameInputPageRender(
        {
            platform: manifest.platforms[data.body.formData.platformId],
            inputUrl: data.body.formData.url,
            selection: data.body.formData.selection,
            isUrlValid
        });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: hostnameInputPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${hostnameInputPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;