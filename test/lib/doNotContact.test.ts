import { buildMatcher, checkNumbers, normalizeEntryList, normalizeNumber, validateEntry } from '../../src/lib/doNotContact.ts';

function check(numbers: string[], restrict: string[], warn: string[] = [], region = 'US') {
  return checkNumbers({ numbers, matcher: buildMatcher({ restrict, warn, region }), region });
}

describe('validateEntry', () => {
  it.each([
    '+14155551234',
    '(415) 555-1234',
    '1234',
    '+1415*',
    '+44 20 7946 *',
    '+1*',
  ])('accepts %s', (entry) => {
    expect(validateEntry(entry, 'US')).toEqual({ valid: true });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['call me', 'characters'],
    ['+1415+5551234', 'characters'],
    ['*', 'noDigit'],
    ['+*', 'noDigit'],
    ['415*', 'wildcardNeedsCountryCode'],
    ['12*', 'wildcardNeedsCountryCode'],
    ['5551234999999999', 'unparsable'],
  ])('rejects %s as %s', (entry, reason) => {
    expect(validateEntry(entry, 'US')).toEqual({ valid: false, reason });
  });

  it('parses full numbers in the given region', () => {
    expect(validateEntry('020 7946 0958', 'GB')).toEqual({ valid: true });
    expect(validateEntry('020 7946 0958', 'US')).toEqual({ valid: false, reason: 'unparsable' });
  });
});

describe('normalizeNumber', () => {
  it('normalizes full numbers to E.164 and keeps extensions as digits', () => {
    expect(normalizeNumber('(415) 555-2671', 'US')).toBe('+14155552671');
    expect(normalizeNumber('+44 20 7946 0958', 'US')).toBe('+442079460958');
    expect(normalizeNumber('1234', 'US')).toBe('1234');
  });

  it('returns null for values that are not phone numbers', () => {
    expect(normalizeNumber('', 'US')).toBeNull();
    expect(normalizeNumber('abc', 'US')).toBeNull();
    expect(normalizeNumber(undefined, 'US')).toBeNull();
    expect(normalizeNumber('5551234999999999', 'US')).toBeNull();
  });
});

describe('checkNumbers', () => {
  it('allows everything when both lists are empty', () => {
    expect(check(['+14155552671'], [])).toEqual({ status: 'allow', restrictedNumbers: [], warnedNumbers: [] });
  });

  it('matches exact numbers across formats', () => {
    expect(check(['+14155552671'], ['(415) 555-2671']).status).toBe('restrict');
    expect(check(['4155552671'], ['+14155552671']).status).toBe('restrict');
    expect(check(['+14155552672'], ['+14155552671']).status).toBe('allow');
  });

  it('matches extensions only exactly', () => {
    expect(check(['1234'], ['1234']).status).toBe('restrict');
    expect(check(['12345'], ['1234']).status).toBe('allow');
  });

  it('matches wildcard patterns', () => {
    expect(check(['+14155552671'], ['+1415*']).status).toBe('restrict');
    expect(check(['+16505552671'], ['+1415*']).status).toBe('allow');
    expect(check(['+442079460958'], [], ['+44 20 7946 *']).status).toBe('warn');
    expect(check(['+14155552671'], ['+1*55*71']).status).toBe('restrict');
    expect(check(['+14155552672'], ['+1*55*71']).status).toBe('allow');
  });

  it('does not let wildcard patterns match extensions', () => {
    expect(check(['1415'], ['+1415*']).status).toBe('allow');
  });

  it('warns when only the warn list matches', () => {
    expect(check(['+14155552671'], [], ['+14155552671'])).toEqual({
      status: 'warn',
      restrictedNumbers: [],
      warnedNumbers: ['+14155552671'],
    });
  });

  it('lets the restrict list win when a number is on both lists', () => {
    expect(check(['+14155552671'], ['+14155552671'], ['+1415*'])).toEqual({
      status: 'restrict',
      restrictedNumbers: ['+14155552671'],
      warnedNumbers: [],
    });
  });

  it('restricts a multi-recipient request when any recipient is restricted', () => {
    const result = check(['+14155552671', '+16505550100', '+12125550123'], ['+16505550100'], ['+14155552671']);
    expect(result.status).toBe('restrict');
    expect(result.restrictedNumbers).toEqual(['+16505550100']);
    expect(result.warnedNumbers).toEqual(['+14155552671']);
  });

  it('skips invalid entries and unreadable numbers without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = check(['not-a-number', '+14155552671'], ['415*', '', '*', '+14155552671']);
      expect(result.status).toBe('restrict');
      expect(result.restrictedNumbers).toEqual(['+14155552671']);
      expect(warn).toHaveBeenCalled();
    }
    finally {
      warn.mockRestore();
    }
  });

  it('uses the region to read national numbers', () => {
    expect(check(['020 7946 0958'], ['+442079460958'], [], 'GB').status).toBe('restrict');
  });
});

describe('normalizeEntryList', () => {
  it('trims entries and drops blanks and duplicates', () => {
    expect(normalizeEntryList([' +14155552671 ', '', '  ', '+14155552671', '+1650*'], 'US')).toEqual({
      entries: ['+14155552671', '+1650*'],
    });
  });

  it('returns an empty list for non-array input', () => {
    expect(normalizeEntryList(undefined, 'US')).toEqual({ entries: [] });
    expect(normalizeEntryList('+14155552671', 'US')).toEqual({ entries: [] });
  });

  it('stops at the first invalid entry and reports why', () => {
    expect(normalizeEntryList(['+14155552671', '415*', 'bad entry'], 'US')).toEqual({
      entries: ['+14155552671'],
      invalid: { entry: '415*', reason: 'wildcardNeedsCountryCode' },
    });
  });
});
