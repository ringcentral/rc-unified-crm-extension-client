import { getLogRecordSubmissionPageRender } from '../../../../components/logRecordSubmissionPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const logRecordSubmissionPageRender = getLogRecordSubmissionPageRender({
        issueDescription: data.body.formData.issueDescription,
        piiConsent: data.body.formData.piiConsent,
        email: data.body.formData.email
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: logRecordSubmissionPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${logRecordSubmissionPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;