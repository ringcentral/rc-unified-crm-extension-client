import implementedInterfacesPage from '../../../components/developerSettingsPage/implementedInterfacesPage';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null });
    const implementedInterfacesPageRender = implementedInterfacesPage.getImplementedInterfacesPageRender({ implementedInterfaces });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: implementedInterfacesPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/customized/implementedInterfacesPage', // page id
    }, '*');
}

exports.onEvent = onEvent;