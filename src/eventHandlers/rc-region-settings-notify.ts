import i18n from '../i18n';
import embeddableServices from '../service/embeddableServices';
import { syncLocaleToEmbeddableWhenReady } from '../lib/embeddableLocale';
import { refreshLocalizedCustomizedPageTitles } from '../service/customizedPageLocaleService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: {
    countryCode?: string;
    [key: string]: unknown;
  };
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  // get region settings from widget
  console.log('rc-region-settings-notify:', data);
  if (!data.countryCode) {
    return;
  }

  try {
    await chrome.storage.local.set(
      { selectedRegion: data.countryCode },
    );
  } catch (e) {
    console.warn('[i18n] Failed to persist selectedRegion:', e);
  }

  const previousLocale = i18n.getLocale();
  const newLocale = await i18n.restoreLocale();
  await syncLocaleToEmbeddableWhenReady(newLocale);
  if (newLocale === previousLocale) {
    return;
  }

  // Re-register service to refresh UI strings with new locale
  try {
    const services = await embeddableServices.getServiceManifest() as UnknownRecord;
    const adapterFrame = document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame');
    adapterFrame?.contentWindow?.postMessage({
      type: 'rc-adapter-register-third-party-service',
      service: services,
    }, '*');
    await refreshLocalizedCustomizedPageTitles();
  } catch (e) {
    console.warn('[i18n] Failed to refresh service manifest after country code change:', e);
  }
}

export default {
  onEvent,
};
