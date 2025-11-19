import phoneSettingPage from '../../../../components/admin/managedSettings/phoneSetting';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const phoneSettingsPageRender = phoneSettingPage.getPhoneSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: phoneSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${phoneSettingsPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;