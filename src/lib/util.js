function secondsToHourMinuteSecondString(totalSeconds) {
    const hours = parseInt(totalSeconds / 3600);
    const minutes = parseInt((totalSeconds - 3600 * hours) / 60);
    const seconds = parseInt(totalSeconds - 3600 * hours - 60 * minutes);
    return `${hours}h${minutes}m${seconds}s`;
}

async function showNotification({ level, message, ttl, details = null }) {
    if (!level || !message || isObjectEmpty(message)) {
        return;
    }
    const notificationId = await RCAdapter.alertMessage({ message, ttl, level , details});
    return notificationId;
}

async function dismissNotification({notificationId}){
    if(!!notificationId)
    {
        await RCAdapter.dismissMessage(notificationId);
    }
}

function responseMessage(responseId, response) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-post-message-response',
        responseId,
        response,
    }, '*');
}

function isObjectEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

exports.secondsToHourMinuteSecondString = secondsToHourMinuteSecondString;
exports.showNotification = showNotification;
exports.dismissNotification = dismissNotification;
exports.responseMessage = responseMessage;
exports.isObjectEmpty = isObjectEmpty;