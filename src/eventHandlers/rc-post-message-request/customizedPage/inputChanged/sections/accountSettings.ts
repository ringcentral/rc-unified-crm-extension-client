import accountSettingsPage from '../../../../../components/admin/accountSettingsPage';
import adminCore from '../../../../../core/admin';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
    return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent({ manifest, platform }: UnknownRecord): Promise<void> {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const dataKeys = [...new Set((platform.adminSettings ?? [])
        .filter((setting: UnknownRecord) => setting.accountDataKey)
        .map((setting: UnknownRecord) => setting.accountDataKey))];
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
    getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: accountSettingsPageRender
    });
    getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${accountSettingsPageRender.id}`, // page id
    }, '*');
}

export { onEvent };
export default {
    onEvent,
};
