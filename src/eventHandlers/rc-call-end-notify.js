async function onEvent({ data }) {
    if (data.call.isOnHold) {
        await chrome.storage.local.set({ [`${data.call.partyData.sessionId}-transfer-on-hold`]: true });
    }
}

exports.onEvent = onEvent;