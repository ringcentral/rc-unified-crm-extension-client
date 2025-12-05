import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    if (data.body.keys.some(k => k === 'piiConsent')) {
        const piiConsent = data.body.formData.piiConsent;
        const page = getErrorLogRecordPageRender({consent: piiConsent});
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