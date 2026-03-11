import userCore from '../../../../core/user';
import googleSheetsPage from '../../../../components/platformSpecific/googleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const userSettings = await userCore.refreshUserSettings({});
    if (!userSettings) {
        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
        return;
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