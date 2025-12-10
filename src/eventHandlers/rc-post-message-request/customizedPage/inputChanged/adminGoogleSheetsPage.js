import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import adminGoogleSheetsPage from '../../../../components/admin/adminGoogleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    
    if (data.body.keys && data.body.keys.includes('forceGoogleSheets')) {
        const isManaged = !(data.body.formData.forceGoogleSheets?.customizable ?? true);
        if (adminSettings?.userSettings?.googleSheetsName) {
            adminSettings.userSettings.googleSheetsName.customizable = !isManaged;
        }
        if (adminSettings?.userSettings?.googleSheetsUrl) {
            adminSettings.userSettings.googleSheetsUrl.customizable = !isManaged;
        }
        await chrome.storage.local.set({ adminSettings });
        await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
        
        // Update user settings with admin settings if managed
        if (isManaged && adminSettings?.userSettings?.googleSheetsName?.value) {
            // If managed and admin has a sheet, force the admin values to user settings
            await userCore.refreshUserSettings({
                changedSettings: {
                    googleSheetsName: {
                        value: adminSettings.userSettings.googleSheetsName.value
                    },
                    googleSheetsUrl: {
                        value: adminSettings.userSettings.googleSheetsUrl?.value || ''
                    }
                }
            });
        } else {
            // If not managed or no admin sheet, just refresh to get latest from server
            await userCore.refreshUserSettings({});
        }
        
        showNotification({ 
            level: 'success', 
            message: `Google Sheets setting ${isManaged ? 'enforced for all users' : 'made customizable for users'}`, 
            ttl: 3000 
        });
    }
    
    const updatedAdminGoogleSheetsPage = adminGoogleSheetsPage.getUpdatedAdminGoogleSheetsPage({ page: data.body.page, formData: data.body.formData });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: updatedAdminGoogleSheetsPage
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${updatedAdminGoogleSheetsPage.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

