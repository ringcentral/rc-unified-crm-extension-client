import notificationLevelSettingPage from '../../../../../components/admin/generalSettings/notificationLevelSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const notificationLevelSettingPageRender = notificationLevelSettingPage.getNotificationLevelSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: notificationLevelSettingPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${notificationLevelSettingPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;