import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';
import { getRcInfo } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const rcUserInfo = await getRcInfo();
    const errorLogRecordPageRender = getErrorLogRecordPageRender({ email: rcUserInfo?.value?.cachedData?.extensionInfo?.contact?.email ?? '' });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: errorLogRecordPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${errorLogRecordPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;