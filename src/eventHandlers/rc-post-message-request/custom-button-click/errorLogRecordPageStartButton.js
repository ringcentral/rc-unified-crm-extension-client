async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    await chrome.storage.local.set({ errorLogRecordingStatus: 'recording' });
    // Here's how things would go
    // 1 From now on, all local actions will be recorded here, and axios default header will have 'is-debug' = true
    // 2. All server actions, if triggered by isDebug = true in request header, will record stack trace and send back in response for client to register
    // 3. User clicks 'Stop' button -> chrome storage clear errorLogRecordingStatus -> recorded events, along with some basic info, generate JSON file and download to user local
    // Note: All data is kept in client 
}

exports.onEvent = onEvent;