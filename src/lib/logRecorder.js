import axios from 'axios';
import { downloadTextFile } from './util';

let log = {};

async function startRecordingLogs() {
    log = {
        summary: [],
        basicInfo: {},
        details: []
    };
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
}

async function stopRecordingLogs() {
    await chrome.storage.local.remove('errorLogRecordingStatus');
    axios.defaults.headers.common['is-debug'] = false;
}

async function uploadLogs({ serverUrl }) {
    const presignedUrlResponse = await axios.get(`${serverUrl}/debug/report/url`);
    const presignedUrl = presignedUrlResponse.data.presignedUrl;
    const logs = getLog();
    const uploadResponse = await axios.put(
        presignedUrl,
        JSON.stringify(logs, null, 2),
        {
            skipAuthorization: true,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
    // download the report as json file to local as well
    downloadTextFile({ filename: 'error-log-report.json', text: JSON.stringify(logs, null, 2) });
    clearLog();
    return uploadResponse.status === 200;
}

async function isRecordingLogs() {
    const { errorLogRecordingStatus } = await chrome.storage.local.get('errorLogRecordingStatus');
    return errorLogRecordingStatus === 'recording';
}

function logBasicInfo(data) {
    log.basicInfo = data;
}

function logAction({ name, data }) {
    const timestamp = new Date().toISOString();
    let summaryEntry;
    if (name === 'user description') {
        summaryEntry = `User description: ${data}`;
        log.summary.unshift(summaryEntry);
    } else {
        if (name === 'API_REQUEST') {
            const endpoint = data.url?.split('?')[0];
            summaryEntry = `${name}: ${data.method?.toUpperCase()} ${endpoint}`;
        } else if (name === 'API_RESPONSE') {
            const endpoint = data.url?.split('?')[0];
            summaryEntry = `${name}: ${data.status} ${endpoint}`;
        } else {
            summaryEntry = `${name}: ${data.path}`;
        }
        log.summary.push(summaryEntry);
    }
    log.details.push({ timestamp, name, data });
}

function getLog() {
    return log;
}

function clearLog() {
    log.length = 0;
}

exports.startRecordingLogs = startRecordingLogs;
exports.stopRecordingLogs = stopRecordingLogs;
exports.uploadLogs = uploadLogs;
exports.isRecordingLogs = isRecordingLogs;
exports.logAction = logAction;
exports.getLog = getLog;
exports.logBasicInfo = logBasicInfo;
