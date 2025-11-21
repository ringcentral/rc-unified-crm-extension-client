import callLogDetailsSettingPage from '../../../../components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage';
import adminCore from '../../../../core/admin';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} });
    let serverSideLoggingSubscribed = adminSettings?.userSettings?.serverSideLogging?.enable ?? false;
    if (serverSideLoggingSubscribed) {
        window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
        try {
            const serverSideLogging = await adminCore.getServerSideLogging({ platform });
            serverSideLoggingSubscribed = serverSideLogging?.subscribed ?? false;
        } catch (error) {
            console.error('Error getting server side logging:', error);
            serverSideLoggingSubscribed = false;
        }
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
    const callLogDetailsSettingPageRender = callLogDetailsSettingPage.getCallLogDetailsSettingPageRender({
        adminUserSettings: adminSettings?.userSettings,
        userPermissions,
        serverSideLoggingSubscribed
    });
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