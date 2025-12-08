import axios from 'axios';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    await chrome.storage.local.set({ errorLogRecordingStatus: 'recording' });
    axios.defaults.headers.common['is-debug'] = true;
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-customized-banner',
        banner: {
            id: 'log-recording-banner', // banner id, required
            message: 'Recording actions...', // banner message, required
            severity: 'warning', // 'info' | 'warning' | 'error' | 'success', default: 'info'
            action: { // optional, show action button
                label: 'Stop' // action button label, required
            }
        }
    }, '*');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack', // go back to previous page
    }, '*');
    // Here's how things would go
    // 1 From now on, all local actions will be recorded here, and axios default header will have 'is-debug' = true
    // 2. All server actions, if triggered by isDebug = true in request header, will record stack trace and send back in response for client to register
    // 3. User clicks 'Stop' button -> chrome storage clear errorLogRecordingStatus -> show user a form for it to submit to us
    // Note: All data is kept in client 
}

exports.onEvent = onEvent;