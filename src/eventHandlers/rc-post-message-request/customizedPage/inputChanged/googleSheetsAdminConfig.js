import adminCore from '../../../../core/admin';
import adminGoogleSheetsPage from '../../../../components/admin/adminGoogleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const adminSettingsResults = await adminCore.refreshAdminSettings();
    const adminSettings = adminSettingsResults.adminSettings;
    
    const adminGoogleSheetsPageRender = adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminGoogleSheetsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${adminGoogleSheetsPageRender.id}`, // page id
    }, '*');
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onEvent = onEvent;

