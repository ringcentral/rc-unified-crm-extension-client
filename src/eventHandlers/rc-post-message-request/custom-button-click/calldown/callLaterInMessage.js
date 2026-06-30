async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    let number = undefined;
    const resource = data.body?.resource;
    if (resource?.direction === "Inbound") {
        number = resource?.from?.phoneNumber;
    }
    else {
        const to = resource?.to;
        number = Array.isArray(to) ? to[0]?.phoneNumber : to?.phoneNumber;
    }
    if (!number) {
        return;
    }
    // try { window.postMessage({ type: 'rc-log-modal-loading-on' }, '*'); } catch (e) { /* ignore */ }
    chrome.runtime.sendMessage({ type: 'c2schedule', phoneNumber: number });
}

exports.onEvent = onEvent;