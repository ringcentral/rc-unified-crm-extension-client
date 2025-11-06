import phoneNumberFormatPage from '../../../../components/admin/generalSettings/phoneNumberFormatPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const phoneNumberFormatPageRender = phoneNumberFormatPage.getPhoneNumberFormatPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: phoneNumberFormatPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${phoneNumberFormatPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;