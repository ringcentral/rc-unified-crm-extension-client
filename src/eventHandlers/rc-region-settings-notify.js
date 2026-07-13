import i18n from '../i18n';
import embeddableServices from '../service/embeddableServices';
import { syncLocaleToEmbeddableWhenReady } from '../lib/embeddableLocale';
import { refreshLocalizedCustomizedPageTitles } from '../service/customizedPageLocaleService';

async function onEvent({data}){
    // get region settings from widget
    console.log('rc-region-settings-notify:', data);
    if (!data?.countryCode) {
      return;
    }

    try {
      await chrome.storage.local.set({ selectedRegion: data.countryCode });
    } catch (e) {
      console.warn('[i18n] Failed to persist selectedRegion:', e);
    }

    // If the user picked an explicit language, the region should not override it.
    const { languageOverride } = await chrome.storage.local.get({ languageOverride: 'auto' });
    const hasManualLanguage = languageOverride && languageOverride !== 'auto';
    if (hasManualLanguage) {
      await syncLocaleToEmbeddableWhenReady(languageOverride);
      return;
    }

    // Handle locale change and refresh UI strings.
    // The widget re-fires this event whenever the Localization page is opened or
    // touched, so only refresh the service manifest when the locale actually
    // changed. Re-registering on every notification resets the in-progress
    // settings UI and makes it look like changes were not saved.
    const previousLocale = i18n.getLocale();
    const newLocale = await i18n.setLocale(data.countryCode);
    await syncLocaleToEmbeddableWhenReady(newLocale);
    if (newLocale === previousLocale) {
      return;
    }

    // Re-register service to refresh UI strings with new locale
    try {
      const services = await embeddableServices.getServiceManifest();
      const adapterFrame = document.querySelector("#rc-widget-adapter-frame");
      adapterFrame?.contentWindow?.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: services
      }, '*');
      await refreshLocalizedCustomizedPageTitles();
    } catch (e) {
      console.warn('[i18n] Failed to refresh service manifest after country code change:', e);
    }
}

exports.onEvent = onEvent;
