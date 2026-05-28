import customizeTabsSettingPage from '../../../../../components/admin/generalSettings/customizeTabsSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const customizeTabsSettingPageRender = customizeTabsSettingPage.getCustomizeTabsSettingPageRender({ adminUserSettings: adminSettings?.userSettings, manifest, platformName });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: customizeTabsSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${customizeTabsSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;