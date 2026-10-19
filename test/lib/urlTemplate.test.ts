import urlTemplate from '../../src/lib/urlTemplate.ts';

const { renderUrlTemplate, isSafeHttpUrl } = urlTemplate;

describe('urlTemplate', () => {
  it('replaces tokens from direct values before user settings', () => {
    const result = renderUrlTemplate({
      template: 'https://crm.example/{hostname}/contacts/{contactId}?mode={mode}',
      values: {
        hostname: 'acme',
        contactId: '123',
      },
      userSettings: {
        mode: { value: 'detail' },
        contactId: { value: 'settings-contact' },
      },
    });

    expect(result).toEqual({
      url: 'https://crm.example/acme/contacts/123?mode=detail',
      missingTokens: [],
    });
  });

  it('supports user setting objects and raw user setting values', () => {
    expect(renderUrlTemplate({
      template: '/{objectSetting}/{rawSetting}',
      userSettings: {
        objectSetting: { value: 'object-value' },
        rawSetting: 'raw-value',
      },
    })).toEqual({
      url: '/object-value/raw-value',
      missingTokens: [],
    });
  });

  it('keeps unresolved tokens in the URL and reports them', () => {
    expect(renderUrlTemplate({
      template: '/contacts/{contactId}/{missing}',
      values: { contactId: '123' },
    })).toEqual({
      url: '/contacts/123/{missing}',
      missingTokens: ['missing'],
    });
  });

  it('returns non-string templates unchanged', () => {
    expect(renderUrlTemplate({ template: null })).toEqual({
      url: null,
      missingTokens: [],
    });
  });

  it('only treats HTTP(S) URLs without javascript text as safe', () => {
    expect(isSafeHttpUrl('https://example.test/path')).toBe(true);
    expect(isSafeHttpUrl('http://example.test/path')).toBe(true);
    expect(isSafeHttpUrl('mailto:support@example.test')).toBe(false);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('https://example.test/javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});
