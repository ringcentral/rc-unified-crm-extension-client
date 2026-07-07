import i18n from '../i18n';
import embeddableServices from '../service/embeddableServices';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: {
    countryCode?: string;
    [key: string]: unknown;
  };
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  // get region settings from widget
  console.log('rc-region-settings-notify:', data);
  if (data.countryCode) {
    await chrome.storage.local.set(
      { selectedRegion: data.countryCode },
    );
  }

  // Handle locale change and refresh UI strings
  if (data.countryCode) {
    await i18n.setLocale(data.countryCode);
    // Re-register service to refresh UI strings with new locale
    try {
      const services = await embeddableServices.getServiceManifest() as UnknownRecord;
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: services,
      }, '*');
    } catch (e) {
      console.warn('[i18n] Failed to refresh service manifest after country code change:', e);
    }
  }
}

export default {
  onEvent,
};
