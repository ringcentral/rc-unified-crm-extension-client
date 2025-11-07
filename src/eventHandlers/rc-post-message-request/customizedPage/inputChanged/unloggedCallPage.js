import logCore from '../../../../core/log';
import logPage from '../../../../components/logPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const callLogNote = await logCore.getCachedNote({ sessionId: data.body.formData.record.sessionId });
    // bring out call log page
    const callLogDataId = data.body.formData.record;
    const { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null });
    const callLogData = unloggedCallPageDataCache.find(c => c.sessionId === callLogDataId);
    const callLogPageRender = logPage.getLogPageRender({
        id: callLogData.sessionId,
        manifest,
        logType: 'Call',
        contactInfo: callLogData.contactInfo,
        triggerType: 'createLog',
        platformName,
        direction: callLogData.direction,
        logInfo: {
            note: callLogNote
        },
        contactPhoneNumber: callLogData.phoneNumber
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-update-call-log-page',
        page: callLogPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/log/call/${callLogData.sessionId}`,
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;