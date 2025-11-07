async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.open(`https://appconnect.labs.ringcentral.com/developers/interfaces/${data.body.formData.implementedInterfaces}`, '_blank')
}

exports.onEvent = onEvent;