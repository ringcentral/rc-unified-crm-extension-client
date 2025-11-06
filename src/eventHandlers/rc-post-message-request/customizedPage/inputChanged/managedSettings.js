import managedSettingsPage from '../../../../components/admin/managedSettingsPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const managedSettingsPageRender = managedSettingsPage.getManagedSettingsPageRender({ crmManifest: platform });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: managedSettingsPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${managedSettingsPageRender.id}`, // page id
    }, '*');
}

exports.onEvent = onEvent;