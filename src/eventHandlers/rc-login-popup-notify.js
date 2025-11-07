async function onEvent({ data }) {
    chrome.runtime.sendMessage({
        type: 'openRCOAuthWindow',
        oAuthUri: data.oAuthUri,
    });
}

exports.onEvent = onEvent;