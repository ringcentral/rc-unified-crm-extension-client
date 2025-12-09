import { getRcInfo } from '../../../lib/util';
import logRecorder from '../../../lib/logRecorder';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
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