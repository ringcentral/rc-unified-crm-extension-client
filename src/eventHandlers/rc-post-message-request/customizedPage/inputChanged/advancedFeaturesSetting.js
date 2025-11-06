import advancedFeaturesSettingPage from '../../../../components/admin/managedSettings/advancedFeaturesSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const advancedFeaturesSettingPageRender = advancedFeaturesSettingPage.getAdvancedFeaturesSettingPageRender({ adminUserSettings: adminSettings?.userSettings })
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: advancedFeaturesSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${advancedFeaturesSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;