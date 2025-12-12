import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (data.body.keys.some(k => k === 'issueDescription' || k === 'errorLogRecordPageNextStepButton')) {
        const page = getErrorLogRecordPageRender({ step: 1, email: data.body.formData.email, issueDescription: data.body.formData.issueDescription });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-register-customized-page',
            page
        });
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/customized/${page.id}`, // page id
        }, '*');
    }
}

exports.onEvent = onEvent;