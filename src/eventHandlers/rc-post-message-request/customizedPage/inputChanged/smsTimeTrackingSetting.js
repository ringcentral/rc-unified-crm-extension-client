import smsTimeTrackingSettingPage from '../../../../components/admin/managedSettings/callAndSMSLoggingSetting/smsTimeTrackingSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const smsTimeTrackingSettingPageRender = smsTimeTrackingSettingPage.getSmsTimeTrackingSettingPageRender({
        adminUserSettings: adminSettings?.userSettings
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: smsTimeTrackingSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${smsTimeTrackingSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;


