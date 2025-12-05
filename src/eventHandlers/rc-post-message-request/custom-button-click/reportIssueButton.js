import { getErrorLogRecordPageRender } from '../../../components/errorLogRecordPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const errorLogRecordPageRender = getErrorLogRecordPageRender({ consent: false });
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