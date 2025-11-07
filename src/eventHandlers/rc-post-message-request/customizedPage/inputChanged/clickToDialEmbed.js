import clickToDialEmbedPage from '../../../../components/admin/generalSettings/clickToDialEmbedPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { adminSettings } = await chrome.storage.local.get('adminSettings');
    const clickToDialEmbedPageRender = clickToDialEmbedPage.getClickToDialEmbedPageRender({ adminUserSettings: adminSettings?.userSettings });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: clickToDialEmbedPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${clickToDialEmbedPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;