import { getErrorLogRecordPageRender } from '../../../components/errorLogRecordPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    await chrome.storage.local.set({ issueDescription: data.body.button.formData.issueDescription });
    const page = getErrorLogRecordPageRender({
        step: 2,
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
}

exports.onEvent = onEvent;