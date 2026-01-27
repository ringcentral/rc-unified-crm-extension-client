async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const hostname = platformInfo.hostname;
    window.open(`https://${hostname}/Users/UserSettings`);
}

exports.onEvent = onEvent;