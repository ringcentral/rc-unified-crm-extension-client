async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { rcUserInfo } = await chrome.storage.local.get('rcUserInfo');
    let formUrl = manifest.platforms[platformName].page.feedback.url
    for (const formKey of Object.keys(data.body.button.formData)) {
        formUrl = formUrl.replace(`{${formKey}}`, encodeURIComponent(data.body.button.formData[formKey]));
    }
    formUrl = formUrl
        .replace('{crmName}', manifest.platforms[platformName].displayName)
        .replace('{userName}', rcUserInfo.rcUserName)
        .replace('{userEmail}', rcUserInfo.rcUserEmail)
        .replace('{version}', manifest.version)
    window.open(formUrl, '_blank');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
    }, '*');
}

exports.onEvent = onEvent;