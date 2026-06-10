import accountDataPage from '../../../../../components/admin/accountDataPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const accountDataPageRender = accountDataPage.getAccountDataPageRender({ platform });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: accountDataPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${accountDataPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;
