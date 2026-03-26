import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import googleSheetsPage from '../../../../components/platformSpecific/googleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    // Handle user Google Sheet selection from file picker
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { pendingUserGoogleSheetsSelection } = await chrome.storage.local.get('pendingUserGoogleSheetsSelection');
    
    if (pendingUserGoogleSheetsSelection && data.body.sheetName && data.body.sheetUrl) {
        // Check if selection is recent (within 5 minutes)
        const isRecentSelection = pendingUserGoogleSheetsSelection.timestamp && 
            (Date.now() - pendingUserGoogleSheetsSelection.timestamp < 300000);
        
        if (isRecentSelection) {
            // Update user settings with selected sheet
            const userSettings = await userCore.refreshUserSettings({
                changedSettings: {
                    googleSheetsName: {
                        value: data.body.sheetName
                    },
                    googleSheetsUrl: {
                        value: data.body.sheetUrl
                    }
                }
            });
            
            if (!userSettings) {
                showNotification({ level: 'warning', message: 'Failed to update settings', ttl: 5000 });
                window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                return;
            }
            
            // Clear pending selection
            await chrome.storage.local.remove('pendingUserGoogleSheetsSelection');
            
            showNotification({ 
                level: 'success', 
                message: `Google Sheet "${data.body.sheetName}" selected successfully`, 
                ttl: 3000
            });
            
            // Re-render user page to show the "sheet exists" UI
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: googleSheetsPage.renderGoogleSheetsPage({ manifest, userSettings })
            });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: '/customized/googleSheetsPage', // page id
            }, '*');
        } else {
            showNotification({ level: 'warning', message: 'Sheet selection expired, please try again', ttl: 3000 });
        }
    } else {
        showNotification({ level: 'warning', message: 'Failed to select sheet', ttl: 5000 });
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

