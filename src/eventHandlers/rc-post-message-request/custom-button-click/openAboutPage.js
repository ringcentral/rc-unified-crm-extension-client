import aboutPage from '../../../components/aboutPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const aboutPageRender = aboutPage.getAboutPageRender({ manifest });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: aboutPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/customized/aboutPage', // page id
    }, '*');
}

exports.onEvent = onEvent;