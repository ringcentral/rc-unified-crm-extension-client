async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    let number = data.body?.resource?.phoneNumber;
    if (data.body?.resource?.phoneType === 'extension') {
        const phoneNumbers = data.body?.resource?.phoneNumbers;
        if (phoneNumbers && phoneNumbers.length > 0) {
            for (const phoneNumber of phoneNumbers) {
                if (phoneNumber.phoneType === 'direct') {
                    number = phoneNumber.phoneNumber;
                    break;
                }
            }
        }
    }
    if (!number) {
        return;
    }
    //  try { window.postMessage({ type: 'rc-log-modal-loading-on' }, '*'); } catch (e) { /* ignore */ }
    chrome.runtime.sendMessage({ type: 'c2schedule', phoneNumber: number });
}

exports.onEvent = onEvent;