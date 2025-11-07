import developerSettingsPage from '../../../components/developerSettingsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const developerSettingsPageRender = developerSettingsPage.getDeveloperSettingsPageRender({});
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: developerSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/customized/developerSettingsPage', // page id
    }, '*');
}

exports.onEvent = onEvent;