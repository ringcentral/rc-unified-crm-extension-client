import { getLogRecordSubmissionPageRender } from '../../../components/logRecordSubmissionPage';
import logRecorder from '../../../lib/logRecorder';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (!data.body.button.dismissed) {
        // close recording banner
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-update-customized-banner',
            banner: {
                id: 'log-recording-banner',
                hidden: true
            }
        }, '*');
        const logRecordSubmissionPageRender = getLogRecordSubmissionPageRender({});
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page: logRecordSubmissionPageRender
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/customized/${logRecordSubmissionPageRender.id}`, // page id
        }, '*');
    }
}

exports.onEvent = onEvent;