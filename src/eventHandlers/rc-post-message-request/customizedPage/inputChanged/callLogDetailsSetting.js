import callLogDetailsSettingPage from '../../../../components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const callLogDetailsSettingPageRender = callLogDetailsSettingPage.getCallLogDetailsSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: callLogDetailsSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${callLogDetailsSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;