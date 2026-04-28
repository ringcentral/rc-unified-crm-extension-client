import clickToDialMatcherSettingPage from '../../../../../components/admin/generalSettings/clickToDialMatcherSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const clickToDialMatcherSettingPageRender = clickToDialMatcherSettingPage.getClickToDialMatcherSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: clickToDialMatcherSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${clickToDialMatcherSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;