import accountSettingsPage from '../../../../../components/admin/accountSettingsPage';
import adminCore from '../../../../../core/admin';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const dataKeys = [...new Set((platform.adminSettings ?? [])
        .filter(setting => setting.accountDataKey)
        .map(setting => setting.accountDataKey))];
    let accountDataOptions = {};
    if (dataKeys.length > 0) {
        try {
            accountDataOptions = await adminCore.getAccountData({ serverUrl: manifest.serverUrl, keys: dataKeys });
        }
        catch (e) {
            console.error('Error getting account data options:', e);
        }
    }
    const accountSettingsPageRender = accountSettingsPage.getAccountSettingsPageRender({
        platform,
        adminUserSettings: adminSettings?.userSettings,
        accountDataOptions
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: accountSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${accountSettingsPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;
