import { getRcInfo } from '../../../../lib/util';
import logRecorder from '../../../../lib/logRecorder';
import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const page = getErrorLogRecordPageRender({
        step: 3,
        email: data.body.button.formData.email,
        issueDescription: data.body.button.formData.issueDescription
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${page.id}`, // page id
    }, '*');
    await logRecorder.startRecordingLogs();
    // Start with saving user basic info
    const version = manifest.version;
    const rcInfo = await getRcInfo();
    const basicInfo = {
        platformInfo,
        rcUserInfo: {
            accountInfo: rcInfo.value.cachedData.accountInfo,
            extensionInfo: rcInfo.value.cachedData.extensionInfo
        },
        version
    }
    logRecorder.logAction({ name: 'basicInfo', data: basicInfo });
}

exports.onEvent = onEvent;