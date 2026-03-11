import autoLogPreferencesPage from '../../../../../components/admin/managedSettings/callAndSMSLoggingSetting/autoLogPreferenceSettingPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const autoLogPreferencesPageRender = autoLogPreferencesPage.getAutoLogPreferenceSettingPageRender({ adminUserSettings: adminSettings?.userSettings, contactTypes: (platform.contactTypes && platform.contactTypes.length > 0) ? platform.contactTypes : [{ value: 'contact', display: 'Contact' }] });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: autoLogPreferencesPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${autoLogPreferencesPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;