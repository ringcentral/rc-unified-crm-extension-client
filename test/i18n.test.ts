async function loadI18n() {
  vi.resetModules();
  const module = await import('../src/i18n/index.ts');
  return module.default;
}

function mockBrowserLanguages(languages) {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: languages[0],
  });
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
    expect(i18n.getSupportedLocales()).toEqual(expect.arrayContaining(['en-US', 'de-DE', 'ja-JP', 'hi-IN']));
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

  it('restores locale from browser language', async () => {
    mockBrowserLanguages(['hi-IN', 'en-US']);
    const i18n = await loadI18n();

    await expect(i18n.restoreLocale()).resolves.toBe('hi-IN');
    expect(i18n.getLocale()).toBe('hi-IN');
    expect(i18n.getBrowserLocale(['zh-Hant-TW'])).toBe('zh-TW');
    expect(i18n.getBrowserLocale(['zh-Hans-CN'])).toBe('zh-CN');
    expect(i18n.getBrowserLocale(['en-IN'])).toBe('en-US');

    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('storage unavailable'));
    mockBrowserLanguages(['unsupported']);
    await expect(i18n.restoreLocale()).resolves.toBe('en-US');
    expect(i18n.getLocale()).toBe('en-US');
  });

  it('honors a saved language preference over the browser language', async () => {
    mockBrowserLanguages(['hi-IN', 'en-US']);
    const i18n = await loadI18n();
    await chrome.storage.local.set({ userSettings: { language: { value: 'de-DE' } } });

    await expect(i18n.restoreLocale()).resolves.toBe('de-DE');
    expect(i18n.getLocale()).toBe('de-DE');
  });

  it('follows the browser language when the saved preference is "auto" or unsupported', async () => {
    mockBrowserLanguages(['hi-IN', 'en-US']);
    const i18n = await loadI18n();

    await chrome.storage.local.set({ userSettings: { language: { value: 'auto' } } });
    await expect(i18n.restoreLocale()).resolves.toBe('hi-IN');

    await chrome.storage.local.set({ userSettings: { language: { value: 'xx-YY' } } });
    await expect(i18n.restoreLocale()).resolves.toBe('hi-IN');
  });

  it('prioritizes the local languageOverride over the browser language', async () => {
    mockBrowserLanguages(['hi-IN', 'en-US']);
    const i18n = await loadI18n();
    await chrome.storage.local.set({ languageOverride: 'de-DE' });

    await expect(i18n.restoreLocale()).resolves.toBe('de-DE');
    expect(i18n.getLocale()).toBe('de-DE');
  });

  it('follows the browser language when languageOverride is explicitly "auto"', async () => {
    mockBrowserLanguages(['hi-IN', 'en-US']);
    const i18n = await loadI18n();
    // Even if a stale server value exists, an explicit "auto" override means browser.
    await chrome.storage.local.set({
      languageOverride: 'auto',
      userSettings: { language: { value: 'de-DE' } },
    });

    await expect(i18n.restoreLocale()).resolves.toBe('hi-IN');
  });

  it('lets an admin-enforced language win over the local override', async () => {
    mockBrowserLanguages(['hi-IN', 'en-US']);
    const i18n = await loadI18n();
    await chrome.storage.local.set({
      languageOverride: 'fr-FR',
      userSettings: { language: { value: 'ja-JP', customizable: false } },
    });

    await expect(i18n.restoreLocale()).resolves.toBe('ja-JP');
  });

  it('exposes supported locale options and self-referential display names', async () => {
    const i18n = await loadI18n();

    const options = i18n.getSupportedLocaleOptions();
    expect(options).toEqual(
      expect.arrayContaining([
        { id: 'de-DE', name: 'Deutsch' },
        { id: 'ja-JP', name: '日本語' },
      ]),
    );
    // The "auto" option is intentionally added by callers, not by i18n.
    expect(options.some((option) => option.id === 'auto')).toBe(false);
    expect(options).toHaveLength(i18n.getSupportedLocales().length);

    expect(i18n.getLanguageDisplayName('ko-KR')).toBe('한국어');
    expect(i18n.getLanguageDisplayName('unknown')).toBe('unknown');
  });
});
