import i18n from '../i18n';

const EMBEDDABLE_SUPPORTED_LOCALES = [
  'de-DE',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-US',
  'es-419',
  'es-ES',
  'fi-FI',
  'fr-CA',
  'fr-FR',
  'hi-IN',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'pt-BR',
  'pt-PT',
  'zh-CN',
  'zh-HK',
  'zh-TW'
];

function normalizeEmbeddableLocale(localeCode) {
  const normalizedLocale = i18n.normalizeLocaleCode(localeCode);
  return EMBEDDABLE_SUPPORTED_LOCALES.includes(normalizedLocale)
    ? normalizedLocale
    : i18n.FALLBACK_LOCALE;
}

async function getEffectiveLocale() {
  const { languageOverride } = await chrome.storage.local.get({ languageOverride: 'auto' });
  if (languageOverride && languageOverride !== 'auto') {
    return i18n.normalizeLocaleCode(languageOverride);
  }
  const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
  return i18n.countryToLocale(selectedRegion);
}

async function syncLocaleToEmbeddable(localeCode) {
  const effectiveLocale = localeCode || await getEffectiveLocale();
  const adapterFrame = document.querySelector('#rc-widget-adapter-frame');
  const phone = adapterFrame?.contentWindow?.phone;
  const locale = phone?.locale?.normalizeLocale
    ? phone.locale.normalizeLocale(effectiveLocale)
    : normalizeEmbeddableLocale(effectiveLocale);

  try {
    if (phone?.localeSettings?.saveLocale) {
      await phone.localeSettings.saveLocale(locale);
    } else if (phone?.locale?.setLocale) {
      await phone.locale.setLocale(locale);
    }
  } catch (e) {
    console.warn('[i18n] Failed to sync locale to embeddable:', e);
  }

  return locale;
}

export {
  getEffectiveLocale,
  normalizeEmbeddableLocale,
  syncLocaleToEmbeddable
};
