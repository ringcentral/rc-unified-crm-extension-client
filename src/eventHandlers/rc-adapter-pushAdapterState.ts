import { getPlatformInfo } from '../service/platformService';
import { refreshManifest } from '../service/manifestService';
import embeddableServices from '../service/embeddableServices';
import i18n from '../i18n';
import { syncLocaleToEmbeddableWhenReady } from '../lib/embeddableLocale';
import { refreshLocalizedCustomizedPageTitles } from '../service/customizedPageLocaleService';
import axios from 'axios';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: unknown;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  void data;
  const platformInfo = await getPlatformInfo();
  if (!platformInfo) {
    console.log('Cannot find platform info');
    return;
  }
  const manifest = await refreshManifest() as UnknownRecord;
  const platform = manifest.platforms[platformInfo.platformName ?? ''];
  if (platform.requestConfig?.timeout) {
    axios.defaults.timeout = platform.requestConfig.timeout * 1000;
  }
  const locale = await i18n.restoreLocale();
  await syncLocaleToEmbeddableWhenReady(locale);
  const serviceManifest = await embeddableServices.getServiceManifest();
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-third-party-service',
    service: serviceManifest,
  }, '*');
  await refreshLocalizedCustomizedPageTitles();
}

export default {
  onEvent,
};
