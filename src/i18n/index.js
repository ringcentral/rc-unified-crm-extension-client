/**
 * Lightweight i18n module for RC Unified CRM Extension
 * Syncs with RingCentral Embeddable widget locale settings
 */

// Default locale
let currentLocale = 'en-US';

// Loaded translations cache
let translations = {};

// Fallback locale
const FALLBACK_LOCALE = 'en-US';

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

/**
 * Convert country code to locale code
 * @param {string} countryCode - Country code (e.g., 'US', 'DE')
 * @returns {string} Locale code (e.g., 'en-US', 'de-DE')
 */
function countryToLocale(countryCode) {
    return COUNTRY_TO_LOCALE_MAP[countryCode] || FALLBACK_LOCALE;
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
        const allLocales = Object.values(COUNTRY_TO_LOCALE_MAP);
        const fallbackLocale = allLocales.find(l => l.startsWith(languageCode + '-') && l !== localeCode);

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
    const localeCode = SUPPORTED_LOCALES_AS_COUNTRY_CODE.includes(countryCode)
        ? countryToLocale(countryCode)
        : FALLBACK_LOCALE;
    
    currentLocale = localeCode;
    translations = await loadTranslations(currentLocale);

    // Store locale in chrome storage for persistence
    try {
        await chrome.storage.local.set({ currentLocale });
    } catch (e) {
        // Ignore storage errors (may be in non-extension context)
    }

    return currentLocale;
}

/**
 * Set the current locale and reload translations
 * @param {string} countryCode - Country code (e.g., 'US', 'DE')
 */
async function setLocale(countryCode) {
    const localeCode = countryToLocale(countryCode);
    if (localeCode === currentLocale) return currentLocale;
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
    return [...SUPPORTED_LOCALES_AS_COUNTRY_CODE];
}

/**
 * Restore locale from storage on startup
 */
async function restoreLocale() {
    try {
        // Try to get stored country code first, fallback to stored locale for backwards compatibility
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
    getLocale,
    t,
    hasKey,
    getSupportedLocales,
    restoreLocale,
    countryToLocale,
    SUPPORTED_LOCALES: SUPPORTED_LOCALES_AS_COUNTRY_CODE,
    COUNTRY_TO_LOCALE_MAP,
    FALLBACK_LOCALE
};

export default i18n;
export { init, setLocale, getLocale, t, hasKey, getSupportedLocales, restoreLocale, countryToLocale };

