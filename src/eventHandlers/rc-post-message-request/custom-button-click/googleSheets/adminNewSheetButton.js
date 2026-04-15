import axios from 'axios';
import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification, getRcAccessToken } from '../../../../lib/util';
import adminGoogleSheetsPage from '../../../../components/admin/adminGoogleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const rcAccessTokenNewSheet = getRcAccessToken();
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    
    try{
    const adminNewSheetResponse = await axios.post(`${manifest.serverUrl}/admin/googleSheets/sheet?rcAccessToken=${rcAccessTokenNewSheet}`,
        {
            name: data.body.button.formData.newSheetName
        }
    );
        // Set admin settings for Google Sheets
        const isManaged = !(data.body.button.formData.forceGoogleSheets?.customizable ?? true);
        adminSettings.userSettings.googleSheetsName = {
            value: adminNewSheetResponse.data.name,
            customizable: !isManaged
        };
        adminSettings.userSettings.googleSheetsUrl = {
            value: adminNewSheetResponse.data.url,
            customizable: !isManaged
        };
        await chrome.storage.local.set({ adminSettings });
        await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
              
        showNotification({ 
            level: 'success', 
            message: `Admin Google Sheet "${adminNewSheetResponse.data.name}" created successfully${isManaged ? ' and enforced for all users' : ''}`, 
            ttl: 5000 
        });
    } catch (error) {
        showNotification({ level: 'warning', message: 'Failed to create new sheet', ttl: 5000 });
    }
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

