import callAndSMSLoggingSettingPage from '../../../../../components/admin/managedSettings/callAndSMSLoggingSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const callAndSMSLoggingSettingPageRender = callAndSMSLoggingSettingPage.getCallAndSMSLoggingSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: callAndSMSLoggingSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${callAndSMSLoggingSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;