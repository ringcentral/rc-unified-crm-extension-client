const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('./helpers/bundledModule.cjs');
const { createChromeStorage } = require('./helpers/chromeStorage.cjs');

const originalWarn = console.warn;

async function loadI18n(initialStorage = {}) {
  const storage = createChromeStorage(initialStorage);
  global.chrome = storage.chrome;
  console.warn = () => {};

  const i18n = await loadBundledModule('src/i18n/index.js');
  return { i18n, storage };
}

test.afterEach(() => {
  console.warn = originalWarn;
  delete global.chrome;
});

test('i18n maps RingCentral country codes to extension locales with en-US fallback', async () => {
  const { i18n } = await loadI18n();

  assert.equal(i18n.countryToLocale('US'), 'en-US');
  assert.equal(i18n.countryToLocale('DE'), 'de-DE');
  assert.equal(i18n.countryToLocale('MX'), 'es-419');
  assert.equal(i18n.countryToLocale('ZZ'), 'en-US');
});

test('i18n loads translations, interpolates params, and returns the key for missing translations', async () => {
  const { i18n, storage } = await loadI18n();

  assert.equal(await i18n.init('US'), 'en-US');
  assert.equal(i18n.t('common.buttons.save'), 'Save');
  assert.equal(i18n.t('pages.about.versionLabel', { version: '1.2.3' }), 'Version: 1.2.3');
  assert.equal(i18n.t('missing.translation.key'), 'missing.translation.key');
  assert.equal(storage.store.currentLocale, 'en-US');
});

test('i18n restores the locale from selectedRegion storage', async () => {
  const { i18n, storage } = await loadI18n({ selectedRegion: 'DE' });

  assert.equal(await i18n.restoreLocale(), 'de-DE');
  assert.equal(i18n.getLocale(), 'de-DE');
  assert.equal(i18n.t('common.buttons.save'), 'Speichern');
  assert.equal(storage.store.currentLocale, 'de-DE');
});

test('i18n restores legacy currentLocale storage when selectedRegion is absent', async () => {
  const { i18n, storage } = await loadI18n({ currentLocale: 'de-DE' });

  assert.equal(await i18n.restoreLocale(), 'de-DE');
  assert.equal(i18n.getLocale(), 'de-DE');
  assert.equal(i18n.t('common.buttons.save'), 'Speichern');
  assert.equal(storage.store.currentLocale, 'de-DE');
});