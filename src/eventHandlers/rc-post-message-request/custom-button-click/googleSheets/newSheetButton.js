import axios from 'axios';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import googleSheetsPage from '../../../../components/platformSpecific/googleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt: tokenForNewSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const newSheetResponse = await axios.post(`${manifest.serverUrl}/googleSheets/sheet?jwtToken=${tokenForNewSheet}`,
        {
            name: data.body.button.formData.newSheetName
        }
    );
    let userSettings;
    if (newSheetResponse.status === 200) {
        userSettings = await userCore.refreshUserSettings({
            changedSettings: {
                googleSheetsName: {
                    value: newSheetResponse.data.name
                },
                googleSheetsUrl: {
                    value: newSheetResponse.data.url
                }
            }
        });
        showNotification({ level: 'success', message: 'New sheet created successfully', ttl: 5000 });
    }
    else {
        showNotification({ level: 'warning', message: 'Failed to create new sheet', ttl: 5000 });
    }
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: googleSheetsPage.renderGoogleSheetsPage({ manifest, userSettings })
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/customized/googleSheetsPage', // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;