import logRecorder from '../../../lib/logRecorder';
import { showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        logRecorder.logAction({ name: 'user description', data: data.body.button.formData.issueDescription });
        await logRecorder.stopRecordingLogs();
        await logRecorder.uploadLogs({ serverUrl: manifest.serverUrl });
        showNotification({ level: 'success', message: 'Successfully uploaded.', ttl: 3000 });
    } catch (error) {
        console.error('Error uploading logs:', error);
        showNotification({ level: 'error', message: 'Failed to upload logs. Please try again.', ttl: 3000 });
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');

    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack' // page id
    }, '*');
}

exports.onEvent = onEvent;