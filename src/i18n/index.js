/**
 * Lightweight i18n module for RC Unified CRM Extension
 * Syncs with RingCentral Embeddable widget locale settings
 */

import axios from 'axios';

// Default locale
let currentLocale = 'en-US';

// Loaded translations cache
let translations = {};

// Fallback locale
const FALLBACK_LOCALE = 'en-US';

// Locale files supported by the extension UI. Most also map 1:1 to RingCentral API
// Accept-Language values, with exceptions normalized in ACCEPT_LANGUAGE_MAP below.
const SUPPORTED_LOCALES = [
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

// Map country codes to locale codes
// This maps RingCentral region country codes to the corresponding locale file
const COUNTRY_TO_LOCALE_MAP = {
    // English locales
    'US': 'en-US',
    'AU': 'en-AU',
    'CA': 'en-CA',
    'GB': 'en-GB',
    'IE': 'en-GB',    // Ireland -> fallback to British English
    'NZ': 'en-AU',    // New Zealand -> fallback to Australian English
    'SG': 'en-US',    // Singapore -> fallback to US English
    // German
    'DE': 'de-DE',
    // Spanish
    'ES': 'es-ES',
    'MX': 'es-419',   // Mexico -> Latin American Spanish
    // French
    'FR': 'fr-FR',
    // Italian
    'IT': 'it-IT',
    // Dutch
    'NL': 'nl-NL',
    // Portuguese
    'BR': 'pt-BR',
    'PT': 'pt-PT',
    // Finnish
    'FI': 'fi-FI',
    // Japanese
    'JP': 'ja-JP',
    // Korean
    'KR': 'ko-KR',
    // Chinese
    'CN': 'zh-CN',
    'HK': 'zh-HK',
    'TW': 'zh-TW'
};

// Supported country codes (matching Embeddable regions)
const SUPPORTED_LOCALES_AS_COUNTRY_CODE = Object.keys(COUNTRY_TO_LOCALE_MAP);

// Native display names for each supported locale, shown in the Language setting.
// Kept in the language's own script so they read correctly regardless of the active UI locale.
const LOCALE_DISPLAY_NAMES = {
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'en-AU': 'English (Australia)',
    'en-CA': 'English (Canada)',
    'de-DE': 'Deutsch',
    'es-ES': 'Español (España)',
    'es-419': 'Español (Latinoamérica)',
    'fr-FR': 'Français',
    'fr-CA': 'Français (Canada)',
    'hi-IN': 'हिन्दी',
    'it-IT': 'Italiano',
    'nl-NL': 'Nederlands',
    'pt-BR': 'Português (Brasil)',
    'pt-PT': 'Português (Portugal)',
    'fi-FI': 'Suomi',
    'ja-JP': '日本語',
    'ko-KR': '한국어',
    'zh-CN': '简体中文',
    'zh-HK': '繁體中文 (香港)',
    'zh-TW': '繁體中文 (台灣)'
};

// Map an internal locale code to the value RingCentral APIs expect in the Accept-Language header.
// See https://developers.ringcentral.com/guide/basics/localization
// Korean uses an underscore, and a couple of English variants fall back to the closest supported code.
const ACCEPT_LANGUAGE_MAP = {
    'en-AU': 'en-GB',
    'en-CA': 'en-US',
    'hi-IN': 'en-US',
    'ko-KR': 'ko_KR'
};

/**
 * Convert an internal locale code to the RingCentral Accept-Language header value.
 * @param {string} localeCode - Internal locale code (e.g., 'ko-KR')
 * @returns {string} Header value (e.g., 'ko_KR')
 */
function toAcceptLanguage(localeCode) {
    const normalizedLocale = normalizeLocaleCode(localeCode);
    return ACCEPT_LANGUAGE_MAP[normalizedLocale] || normalizedLocale;
}

/**
 * Set the global Accept-Language header so server/CRM responses can return localized display content.
 * @param {string} localeCode - Internal locale code
 */
function setAcceptLanguageHeader(localeCode) {
    try {
        axios.defaults.headers.common['Accept-Language'] = toAcceptLanguage(localeCode);
    } catch (e) {
        // axios may not be configured in every context; ignore
    }
}

/**
 * Keep locale codes constrained to local translation files.
 * @param {string} localeCode - Requested locale code
 * @returns {string} Supported locale code
 */
function normalizeLocaleCode(localeCode) {
    return SUPPORTED_LOCALES.includes(localeCode) ? localeCode : FALLBACK_LOCALE;
}

/**
 * Convert country code to locale code
 * @param {string} countryCode - Country code (e.g., 'US', 'DE')
 * @returns {string} Locale code (e.g., 'en-US', 'de-DE')
 */
function countryToLocale(countryCode) {
    return COUNTRY_TO_LOCALE_MAP[String(countryCode).toUpperCase()] || FALLBACK_LOCALE;
}

/**
 * Load translation file for a specific locale
 * @param {string} localeCode - Locale code (e.g., 'en-US')
 * @returns {Promise<Object>} Translation object
 */
async function loadTranslations(localeCode) {
    try {
        // Try to load the exact locale
        const module = await import(`./locales/${localeCode}.json`);
        return module.default || module;
    } catch (e) {
        // If exact locale not found, try language-only fallback (e.g., 'en-US' from 'en-GB')
        const languageCode = localeCode.split('-')[0];
        const fallbackLocale = SUPPORTED_LOCALES.find(l => l.startsWith(languageCode + '-') && l !== localeCode);

        if (fallbackLocale) {
            try {
                const module = await import(`./locales/${fallbackLocale}.json`);
                return module.default || module;
            } catch (e2) {
                console.warn(`[i18n] Failed to load fallback locale ${fallbackLocale}`);
            }
        }

        // Final fallback to en-US
        if (localeCode !== FALLBACK_LOCALE) {
            console.warn(`[i18n] Locale ${localeCode} not found, falling back to ${FALLBACK_LOCALE}`);
            try {
                const module = await import(`./locales/${FALLBACK_LOCALE}.json`);
                return module.default || module;
            } catch (e3) {
                console.error(`[i18n] Failed to load fallback locale ${FALLBACK_LOCALE}`);
            }
        }

        return {};
    }
}

/**
 * Initialize i18n with a country code
 * @param {string} countryCode - Country code (e.g., 'US', 'DE')
 */
async function init(countryCode = 'US') {
    // Convert country code to locale code
    const normalizedCountryCode = String(countryCode).toUpperCase();
    const localeCode = SUPPORTED_LOCALES_AS_COUNTRY_CODE.includes(normalizedCountryCode)
        ? countryToLocale(normalizedCountryCode)
        : FALLBACK_LOCALE;
    
    currentLocale = localeCode;
    translations = await loadTranslations(currentLocale);

    // Store locale in chrome storage for persistence
    try {
        await chrome.storage.local.set({ currentLocale });
    } catch (e) {
        // Ignore storage errors (may be in non-extension context)
    }

    setAcceptLanguageHeader(currentLocale);

    return currentLocale;
}

/**
 * Apply a specific locale code directly (bypassing the country->locale mapping).
 * Used by the explicit user-selectable Language setting.
 * @param {string} localeCode - Locale code (e.g., 'de-DE')
 */
async function applyLocaleCode(localeCode) {
    currentLocale = normalizeLocaleCode(localeCode);
    translations = await loadTranslations(currentLocale);
    try {
        await chrome.storage.local.set({ currentLocale });
    } catch (e) {
        // Ignore storage errors (may be in non-extension context)
    }
    setAcceptLanguageHeader(currentLocale);
    return currentLocale;
}

/**
 * Set the current locale and reload translations
 * @param {string} countryCode - Country code (e.g., 'US', 'DE')
 */
async function setLocale(countryCode) {
    const localeCode = countryToLocale(countryCode);
    if (localeCode === currentLocale) {
        setAcceptLanguageHeader(currentLocale);
        return currentLocale;
    }
    return await init(countryCode);
}

/**
 * Get the current locale
 * @returns {string} Current locale code
 */
function getLocale() {
    return currentLocale;
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot-separated path (e.g., 'common.buttons.save')
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Translate a key with optional interpolation
 * @param {string} key - Translation key (dot notation, e.g., 'common.buttons.save')
 * @param {Object} params - Optional interpolation parameters
 * @returns {string} Translated string or key if not found
 * 
 * @example
 * t('common.buttons.save') // "Save"
 * t('notifications.callFrom', { name: 'John' }) // "Inbound call from John"
 */
function t(key, params = {}) {
    let value = getNestedValue(translations, key);

    // If not found, return the key itself as fallback
    if (value === undefined) {
        console.warn(`[i18n] Missing translation for key: ${key}`);
        return key;
    }

    // Handle interpolation: replace {param} with actual values
    if (typeof value === 'string' && Object.keys(params).length > 0) {
        value = value.replace(/\{(\w+)\}/g, (match, paramKey) => {
            return params[paramKey] !== undefined ? params[paramKey] : match;
        });
    }

    return value;
}

/**
 * Check if a translation key exists
 * @param {string} key - Translation key
 * @returns {boolean} True if key exists
 */
function hasKey(key) {
    return getNestedValue(translations, key) !== undefined;
}

/**
 * Get all supported locales
 * @returns {string[]} Array of supported locale codes
 */
function getSupportedLocales() {
    return [...SUPPORTED_LOCALES];
}

/**
 * Get the list of selectable languages for the settings UI.
 * Includes an 'auto' option that follows the RingCentral region.
 * @returns {{id: string, name: string}[]}
 */
function getSupportedLocaleOptions() {
    const options = SUPPORTED_LOCALES.map(localeCode => ({
        id: localeCode,
        name: LOCALE_DISPLAY_NAMES[localeCode] || localeCode
    }));
    options.sort((a, b) => a.name.localeCompare(b.name));
    return options;
}

/**
 * Restore locale from storage on startup.
 * An explicit user Language override takes precedence over the RingCentral region.
 */
async function restoreLocale() {
    try {
        const { languageOverride } = await chrome.storage.local.get({ languageOverride: 'auto' });
        if (languageOverride && languageOverride !== 'auto') {
            return await applyLocaleCode(languageOverride);
        }
        // Otherwise follow the RingCentral region country code
        const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: 'US' });
        return await init(selectedRegion);
    } catch (e) {
        return await init('US');
    }
}

// Export the i18n API
const i18n = {
    init,
    setLocale,
    applyLocaleCode,
    getLocale,
    t,
    hasKey,
    getSupportedLocales,
    getSupportedLocaleOptions,
    restoreLocale,
    countryToLocale,
    toAcceptLanguage,
    setAcceptLanguageHeader,
    normalizeLocaleCode,
    LOCALE_DISPLAY_NAMES,
    SUPPORTED_LOCALES,
    SUPPORTED_REGION_COUNTRY_CODES: SUPPORTED_LOCALES_AS_COUNTRY_CODE,
    COUNTRY_TO_LOCALE_MAP,
    FALLBACK_LOCALE
};

setAcceptLanguageHeader(currentLocale);

export default i18n;
export { init, setLocale, applyLocaleCode, getLocale, t, hasKey, getSupportedLocales, getSupportedLocaleOptions, restoreLocale, countryToLocale, toAcceptLanguage, setAcceptLanguageHeader, normalizeLocaleCode };
