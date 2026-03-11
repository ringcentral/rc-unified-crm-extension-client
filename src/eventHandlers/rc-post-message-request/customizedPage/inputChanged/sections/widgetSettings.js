import widgetSettingsPage from '../../../../../components/admin/generalSettings/widgetSettingsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const widgetSettingsPageRender = widgetSettingsPage.getWidgetSettingsPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: widgetSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${widgetSettingsPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;

