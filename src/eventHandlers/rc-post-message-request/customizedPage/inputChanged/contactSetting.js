import contactSettingPage from '../../../../components/admin/managedSettings/contactSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const contactSettingPageRender = contactSettingPage.getContactSettingPageRender({ adminUserSettings: adminSettings?.userSettings, renderOverridingNumberFormat: platform.name == 'clio' || platform.name == 'insightly', renderAllowExtensionNumberLogging: !!platform.enableExtensionNumberLoggingSetting });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: contactSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${contactSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;