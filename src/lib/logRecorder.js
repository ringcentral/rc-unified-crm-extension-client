const ERROR_LOG_RECORDING_STATUS = {
    RECORDING: 'recording',
    STOPPED: 'stopped'
}

const errorLog = [];

async function isRecordingLogs(){
    const errorLogRecordingStatus = await chrome.storage.local.get('errorLogRecordingStatus');
    return errorLogRecordingStatus.errorLogRecordingStatus === ERROR_LOG_RECORDING_STATUS.RECORDING;
}

function logAction({ name, data }) {
    const timestamp = new Date().toISOString();
    errorLog.push({ timestamp, name, data });
    console.log('errorLog', errorLog);
}

function getErrorLog(){
    return errorLog;
}

function clearErrorLog(){
    errorLog.length = 0;
}

exports.isRecordingLogs = isRecordingLogs;
exports.logAction = logAction;
exports.getErrorLog = getErrorLog;
exports.clearErrorLog = clearErrorLog;