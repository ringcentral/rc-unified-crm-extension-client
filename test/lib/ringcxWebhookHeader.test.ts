import { describe, expect, it } from 'vitest';
import { getRingCXWebhookHeader } from '../../src/lib/ringcxWebhookHeader';

describe('getRingCXWebhookHeader', () => {
  it('returns the header name and value from a logging service response', () => {
    expect(getRingCXWebhookHeader({
      ringcxWebhookUrl: 'https://ssl.example/ringcx/webhooks/token-1',
      ringcxWebhookHeader: { name: 'x-ringcx-webhook-secret', value: 'abc123', extra: true },
    })).toEqual({ name: 'x-ringcx-webhook-secret', value: 'abc123' });
  });

  it.each([
    ['no response', undefined],
    ['no header', { ringcxWebhookUrl: 'https://ssl.example/ringcx/webhooks/token-1' }],
    ['a null header', { ringcxWebhookHeader: null }],
    ['an empty value', { ringcxWebhookHeader: { name: 'x-ringcx-webhook-secret', value: '' } }],
    ['a missing name', { ringcxWebhookHeader: { value: 'abc123' } }],
    ['a non-string value', { ringcxWebhookHeader: { name: 'x-ringcx-webhook-secret', value: 123 } }],
  ])('returns null for %s', (_name, result) => {
    expect(getRingCXWebhookHeader(result as Record<string, any> | undefined)).toBeNull();
  });
});
