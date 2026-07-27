import fs from 'node:fs';
import path from 'node:path';

// These tests guard the locale JSON files themselves (data integrity), which the
// behavioral i18n tests in `test/i18n.test.ts` do not cover. They catch the exact
// class of bug seen with the Language / Click-to-dial Matcher settings: keys that
// exist in en-US but are missing (or left as the English placeholder) in other locales.

const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales');
const REFERENCE_LOCALE = 'en-US';

// English-family locales legitimately mirror en-US wording, so they are excluded
// from the "must actually be translated" assertions.
const ENGLISH_LOCALES = new Set(['en-US', 'en-AU', 'en-CA', 'en-GB']);

// Newly added settings that regressed before: they must be translated (not left as
// the English placeholder value) in every non-English locale.
const MUST_BE_TRANSLATED_KEYS = [
  'settings.appearance.language',
  'settings.appearance.languageDesc',
  'settings.appearance.languageAuto',
  'settings.clickToDialMatcher.name',
  'settings.clickToDialMatcher.description',
  'settings.clickToDialMatcher.matcherType',
  'settings.clickToDialMatcher.regionName',
  'settings.clickToDialMatcher.allName',
];

function collectLeafKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectLeafKeyPaths(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValueAtPath(obj: Record<string, unknown>, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((acc, part) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function loadLocale(code: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), 'utf8'));
}

const localeCodes = fs
  .readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

const reference = loadLocale(REFERENCE_LOCALE);
const referenceKeys = collectLeafKeyPaths(reference).sort();
const referenceStringKeys = referenceKeys.filter((key) => typeof getValueAtPath(reference, key) === 'string');
const nonReferenceLocales = localeCodes.filter((code) => code !== REFERENCE_LOCALE);
const translatedLocales = nonReferenceLocales.filter((code) => !ENGLISH_LOCALES.has(code));

describe('i18n locale files', () => {
  it('ships the reference locale plus a broad set of supported languages', () => {
    expect(localeCodes).toContain(REFERENCE_LOCALE);
    expect(localeCodes).toEqual(
      expect.arrayContaining(['de-DE', 'es-ES', 'fr-FR', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'hi-IN']),
    );
  });

  it('reference locale actually contains the newly added settings keys', () => {
    for (const key of MUST_BE_TRANSLATED_KEYS) {
      expect(referenceKeys).toContain(key);
    }
  });

  it.each(nonReferenceLocales)('%s has exactly the same key set as en-US', (code) => {
    const localeKeys = collectLeafKeyPaths(loadLocale(code)).sort();
    const missingKeys = referenceKeys.filter((key) => !localeKeys.includes(key));
    const extraKeys = localeKeys.filter((key) => !referenceKeys.includes(key));
    expect({ code, missingKeys, extraKeys }).toEqual({ code, missingKeys: [], extraKeys: [] });
  });

  it.each(nonReferenceLocales)('%s has a non-empty string for every string key in en-US', (code) => {
    const locale = loadLocale(code);
    const emptyOrNonStringKeys = referenceStringKeys.filter((key) => {
      const value = getValueAtPath(locale, key);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect({ code, emptyOrNonStringKeys }).toEqual({ code, emptyOrNonStringKeys: [] });
  });

  it.each(translatedLocales)('%s translates the newly added settings (no English placeholders)', (code) => {
    const locale = loadLocale(code);
    const untranslatedKeys = MUST_BE_TRANSLATED_KEYS.filter(
      (key) => getValueAtPath(locale, key) === getValueAtPath(reference, key),
    );
    expect({ code, untranslatedKeys }).toEqual({ code, untranslatedKeys: [] });
  });
});
