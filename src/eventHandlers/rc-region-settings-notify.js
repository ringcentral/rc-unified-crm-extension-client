import i18n from '../i18n';
import embeddableServices from '../service/embeddableServices';

async function onEvent({data}){
    // get region settings from widget  
    console.log('rc-region-settings-notify:', data);
    if (data.countryCode) {
      await chrome.storage.local.set(
        { selectedRegion: data.countryCode }
      )
    }

    // If the user picked an explicit language, the region should not override it.
    const { languageOverride } = await chrome.storage.local.get({ languageOverride: 'auto' });
    const hasManualLanguage = languageOverride && languageOverride !== 'auto';

    // Handle locale change and refresh UI strings
    if (data.countryCode && !hasManualLanguage) {
      await i18n.setLocale(data.countryCode);
      // Re-register service to refresh UI strings with new locale
      try {
        const services = await embeddableServices.getServiceManifest();
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
          type: 'rc-adapter-register-third-party-service',
          service: services
        }, '*');
      } catch (e) {
        console.warn('[i18n] Failed to refresh service manifest after country code change:', e);
      }
    }
}

exports.onEvent = onEvent;