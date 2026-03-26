import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import adminGoogleSheetsPage from '../../../../components/admin/adminGoogleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    
    // Remove admin Google Sheets settings
    adminSettings.userSettings.googleSheetsName = {
        value: '',
        customizable: true
    };
    adminSettings.userSettings.googleSheetsUrl = {
        value: '',
        customizable: true
    };
    
    await chrome.storage.local.set({ adminSettings });
    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
    await userCore.refreshUserSettings({
        changedSettings: {
            googleSheetsName: {
                value: ''
            },
            googleSheetsUrl: {
                value: ''
            }
        }
    });
    
    showNotification({ level: 'success', message: 'Admin Google Sheet removed successfully', ttl: 3000 });
    
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings })
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/customized/adminGoogleSheetsPage', // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

