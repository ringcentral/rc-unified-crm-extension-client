import accountSettingsPage from '../../../../../components/admin/accountSettingsPage';
import adminCore from '../../../../../core/admin';
import { getAdminAccountDataKeys } from '../../../../../lib/accountData';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
    return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent({ manifest, platform }: UnknownRecord): Promise<void> {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
        const { adminSettings } = await chrome.storage.local.get('adminSettings') as UnknownRecord;
        const dataKeys = getAdminAccountDataKeys(platform);
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
    finally {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
}

export { onEvent };
export default {
    onEvent,
};
