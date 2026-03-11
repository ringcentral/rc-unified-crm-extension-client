import customSettingsPage from '../../../../../components/admin/managedSettings/customSettingsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const customSettingsPageRender = customSettingsPage.getCustomSettingsPageRender({ crmManifest: platform, adminUserSettings: adminSettings?.userSettings, userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: customSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${customSettingsPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;