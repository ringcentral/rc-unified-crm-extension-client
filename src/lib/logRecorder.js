import axios from 'axios';

const log = [];

async function startRecordingLogs() {
    await chrome.storage.local.set({ errorLogRecordingStatus: 'recording' });
    axios.defaults.headers.common['is-debug'] = true;
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-customized-banner',
        banner: {
            id: 'log-recording-banner', // banner id, required
            message: 'Recording actions...', // banner message, required
            severity: 'warning', // 'info' | 'warning' | 'error' | 'success', default: 'info'
            action: { // optional, show action button
                label: 'Stop', // action button label, required
                color: 'danger.b04'
            }
        }
    }, '*');
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack', // go back to previous page
    }, '*');
}

async function stopRecordingLogs() {
    await chrome.storage.local.remove('errorLogRecordingStatus');
    axios.defaults.headers.common['is-debug'] = false;
}

async function uploadLogs({ serverUrl }) {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const presignedUrlResponse = await axios.get(`${serverUrl}/debug/report/url?jwtToken=${rcUnifiedCrmExtJwt}`);
    const presignedUrl = presignedUrlResponse.data.presignedUrl;
    const logs = getLog();
    const uploadResponse = await axios.put(presignedUrl, JSON.stringify(logs, null, 2));
    clearLog();
    return uploadResponse.status === 200;
}

async function isRecordingLogs() {
    const { errorLogRecordingStatus } = await chrome.storage.local.get('errorLogRecordingStatus');
    return errorLogRecordingStatus === 'recording';
}

function logAction({ name, data }) {
    const timestamp = new Date().toISOString();
    log.push({ timestamp, name, data });
}

function getLog() {
    return log;
}

function clearLog(){
    log.length = 0;
}

exports.startRecordingLogs = startRecordingLogs;
exports.stopRecordingLogs = stopRecordingLogs;
exports.uploadLogs = uploadLogs;
exports.isRecordingLogs = isRecordingLogs;
exports.logAction = logAction;
exports.getLog = getLog;