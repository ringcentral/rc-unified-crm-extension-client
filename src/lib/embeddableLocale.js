import i18n from '../i18n';

const DEFAULT_SYNC_ATTEMPTS = 20;
const DEFAULT_SYNC_RETRY_DELAY = 250;

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEmbeddablePhone() {
  return document.querySelector('#rc-widget-adapter-frame')?.contentWindow?.phone;
}

function getLocaleForPhone(phone, localeCode) {
  return phone?.locale?.normalizeLocale
    ? phone.locale.normalizeLocale(localeCode)
    : normalizeEmbeddableLocale(localeCode);
}

async function applyLocaleToPhone(phone, locale) {
  if (!phone) {
    return false;
  }

  try {
    if (phone.localeSettings?.saveLocale) {
      await phone.localeSettings.saveLocale(locale);
      return true;
    }
    if (phone.locale?.setLocale) {
      await phone.locale.setLocale(locale);
      return true;
    }
  } catch (e) {
    console.warn('[i18n] Failed to sync locale to embeddable:', e);
  }

  return false;
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
  const phone = getEmbeddablePhone();
  const locale = getLocaleForPhone(phone, effectiveLocale);

  await applyLocaleToPhone(phone, locale);

  return locale;
}

async function syncLocaleToEmbeddableWhenReady(
  localeCode,
  {
    attempts = DEFAULT_SYNC_ATTEMPTS,
    retryDelay = DEFAULT_SYNC_RETRY_DELAY,
  } = {},
) {
  const effectiveLocale = localeCode || await getEffectiveLocale();
  let locale = normalizeEmbeddableLocale(effectiveLocale);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const phone = getEmbeddablePhone();
    locale = getLocaleForPhone(phone, effectiveLocale);

    if (await applyLocaleToPhone(phone, locale)) {
      return locale;
    }

    if (attempt < attempts - 1) {
      await delay(retryDelay);
    }
  }

  return locale;
}

export {
  getEffectiveLocale,
  normalizeEmbeddableLocale,
  syncLocaleToEmbeddable,
  syncLocaleToEmbeddableWhenReady
};
