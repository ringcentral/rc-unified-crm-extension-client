import generalSettingPage from '../../../../../components/admin/generalSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const generalSettingsPageRender = generalSettingPage.getGeneralSettingPageRender();
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: generalSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${generalSettingsPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;