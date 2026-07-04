import { getPlatformInfo } from '../service/platformService';
import { getManifest, refreshManifest } from '../service/manifestService';
import embeddableServices from '../service/embeddableServices';
import i18n from '../i18n';
import { syncLocaleToEmbeddable } from '../lib/embeddableLocale';
import { refreshLocalizedCustomizedPageTitles } from '../service/customizedPageLocaleService';
import axios from 'axios';

async function onEvent({ data }) {
    const platformInfo = await getPlatformInfo();
    if (!platformInfo) {
        console.log('Cannot find platform info');
        return;
    }
    const manifest = await refreshManifest();
    const platform = manifest.platforms[platformInfo.platformName];
    if (platform.requestConfig?.timeout) {
        axios.defaults.timeout = platform.requestConfig.timeout * 1000;
    }
    const locale = await i18n.restoreLocale();
    await syncLocaleToEmbeddable(locale);
    const serviceManifest = await embeddableServices.getServiceManifest();
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: serviceManifest
    }, '*');
    await refreshLocalizedCustomizedPageTitles();
}

exports.onEvent = onEvent;
