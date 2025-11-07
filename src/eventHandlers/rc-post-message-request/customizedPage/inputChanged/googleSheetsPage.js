import googleSheetsPage from '../../../../components/platformSpecific/googleSheetsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const {userSettings} = await chrome.storage.local.get({ userSettings: null });
    const updatedGoogleSheetsPage = googleSheetsPage.getUpdatedGoogleSheetsPage({ page: data.body.page, formData: data.body.formData, manifest, userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: updatedGoogleSheetsPage
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${updatedGoogleSheetsPage.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;