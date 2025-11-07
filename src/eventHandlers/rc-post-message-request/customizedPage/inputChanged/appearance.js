import appearancePage from '../../../../components/admin/generalSettings/appearancePage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const appearancePageRender = appearancePage.getAppearancePageRender();
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: appearancePageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${appearancePageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;