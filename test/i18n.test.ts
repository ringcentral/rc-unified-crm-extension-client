// @ts-nocheck
import { seedStorage } from './setup/storageHelpers';

async function loadI18n() {
  vi.resetModules();
  const module = await import('../src/i18n/index.ts');
  return module.default;
}

describe('i18n', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('maps countries to locales, loads translations, interpolates params, and stores current locale', async () => {
    const i18n = await loadI18n();

    await expect(i18n.init('DE')).resolves.toBe('de-DE');

    expect(i18n.getLocale()).toBe('de-DE');
    expect(i18n.t('common.buttons.save')).toBe('Speichern');
    expect(i18n.t('pages.log.saveTo', { platform: 'Salesforce' })).toBe('Speichern in Salesforce');
    expect(i18n.hasKey('pages.log.saveTo')).toBe(true);
    expect(i18n.hasKey('missing.key')).toBe(false);
    expect(i18n.t('missing.key')).toBe('missing.key');
    expect(console.warn).toHaveBeenCalledWith('[i18n] Missing translation for key: missing.key');
    expect(i18n.countryToLocale('MX')).toBe('es-419');
    expect(i18n.countryToLocale('unknown')).toBe('en-US');
    expect(i18n.getSupportedLocales()).toEqual(expect.arrayContaining(['US', 'DE', 'JP']));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ currentLocale: 'de-DE' });

    await expect(i18n.setLocale('DE')).resolves.toBe('de-DE');
    await expect(i18n.setLocale('US')).resolves.toBe('en-US');
    expect(i18n.t('common.buttons.save')).toBe('Save');
  });

  it('falls back to en-US for unsupported regions and ignores storage write errors', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('storage unavailable'));
    const i18n = await loadI18n();

    await expect(i18n.init('ZZ')).resolves.toBe('en-US');

    expect(i18n.getLocale()).toBe('en-US');
    expect(i18n.t('common.buttons.save')).toBe('Save');
  });

  it('restores locale from selected region and falls back when storage read fails', async () => {
    seedStorage({
      selectedRegion: 'JP',
    });
    let i18n = await loadI18n();

    await expect(i18n.restoreLocale()).resolves.toBe('ja-JP');
    expect(i18n.getLocale()).toBe('ja-JP');

    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));
    i18n = await loadI18n();
    await expect(i18n.restoreLocale()).resolves.toBe('en-US');
    expect(i18n.getLocale()).toBe('en-US');
  });
});
