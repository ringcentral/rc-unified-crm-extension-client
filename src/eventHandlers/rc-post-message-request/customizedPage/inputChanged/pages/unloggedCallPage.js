import logCore from '../../../../../core/log';
import logPage from '../../../../../components/logPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const callLogDataId = typeof data.body.formData.record === 'object'
        ? data.body.formData.record.sessionId
        : data.body.formData.record;
    const callLogNote = await logCore.getCachedNote({ sessionId: callLogDataId });
    // bring out call log page
    const { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null });
    const callLogData = unloggedCallPageDataCache.find(c => c.sessionId === callLogDataId);
    const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
    const useContactSearch = implementedInterfaces?.findContactWithName;
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
        contactPhoneNumber: callLogData.phoneNumber,
        useContactSearch
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