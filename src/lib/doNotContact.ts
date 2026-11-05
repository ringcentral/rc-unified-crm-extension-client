import { parsePhoneNumber } from 'awesome-phonenumber';

// Numbers with at most this many digits are treated as extensions, as in the do-not-log list.
const EXTENSION_MAX_DIGITS = 6;
const ALLOWED_ENTRY_CHARS = /^[+\d\s\-().*]+$/;
const FORMATTING_CHARS = /[\s\-().]/g;

export type DoNotContactStatus = 'restrict' | 'warn' | 'allow';

export type EntryInvalidReason = 'empty' | 'characters' | 'noDigit' | 'wildcardNeedsCountryCode' | 'unparsable';

export type EntryValidation = { valid: boolean; reason?: EntryInvalidReason };

type CompiledList = {
  exact: Set<string>;
  patterns: RegExp[];
};

export type DoNotContactMatcher = {
  restrict: CompiledList;
  warn: CompiledList;
};

export type DoNotContactCheckResult = {
  status: DoNotContactStatus;
  restrictedNumbers: string[];
  warnedNumbers: string[];
};

function compact(raw: unknown): string {
  return String(raw ?? '').trim().replace(FORMATTING_CHARS, '');
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

function toE164(value: string, region: string): string | null {
  const parsed = parsePhoneNumber(value, { regionCode: region });
  return parsed.valid ? parsed.number.e164 : null;
}

export function validateEntry(raw: unknown, region = 'US'): EntryValidation {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') {
    return { valid: false, reason: 'empty' };
  }
  if (!ALLOWED_ENTRY_CHARS.test(trimmed)) {
    return { valid: false, reason: 'characters' };
  }
  const value = compact(trimmed);
  if (value.lastIndexOf('+') > 0) {
    return { valid: false, reason: 'characters' };
  }
  if (digitsOf(value) === '') {
    return { valid: false, reason: 'noDigit' };
  }
  if (value.includes('*')) {
    return value.startsWith('+') ? { valid: true } : { valid: false, reason: 'wildcardNeedsCountryCode' };
  }
  if (!value.startsWith('+') && digitsOf(value).length <= EXTENSION_MAX_DIGITS) {
    return { valid: true };
  }
  return toE164(value, region) ? { valid: true } : { valid: false, reason: 'unparsable' };
}

// Returns the canonical form a candidate number is matched in: digits for an extension,
// E.164 for a full number, or null when the number cannot be interpreted.
export function normalizeNumber(raw: unknown, region = 'US'): string | null {
  const value = compact(raw);
  if (!/^\+?\d+$/.test(value)) {
    return null;
  }
  if (!value.startsWith('+') && value.length <= EXTENSION_MAX_DIGITS) {
    return value;
  }
  return toE164(value, region) ?? (value.startsWith('+') ? value : null);
}

function compileList(entries: unknown[], region: string): CompiledList {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const entry of entries) {
    try {
      if (!validateEntry(entry, region).valid) {
        console.warn('[doNotContact] Ignoring invalid entry', entry);
        continue;
      }
      const value = compact(entry);
      if (value.includes('*')) {
        const body = value.slice(1).split('*').join('\\d*');
        patterns.push(new RegExp(`^\\+${body}$`));
      }
      else {
        const normalized = normalizeNumber(value, region);
        if (normalized) {
          exact.add(normalized);
        }
      }
    }
    catch (error) {
      console.warn('[doNotContact] Ignoring unreadable entry', entry, error);
    }
  }
  return { exact, patterns };
}

export function buildMatcher({ restrict, warn, region = 'US' }: { restrict: unknown[]; warn: unknown[]; region?: string }): DoNotContactMatcher {
  return {
    restrict: compileList(restrict, region),
    warn: compileList(warn, region),
  };
}

function matches(list: CompiledList, normalized: string): boolean {
  return list.exact.has(normalized) || list.patterns.some((pattern) => pattern.test(normalized));
}

export function checkNumbers({ numbers, matcher, region = 'US' }: { numbers: unknown[]; matcher: DoNotContactMatcher; region?: string }): DoNotContactCheckResult {
  const restrictedNumbers: string[] = [];
  const warnedNumbers: string[] = [];
  for (const number of numbers) {
    const normalized = normalizeNumber(number, region);
    if (!normalized) {
      continue;
    }
    if (matches(matcher.restrict, normalized)) {
      restrictedNumbers.push(String(number));
    }
    else if (matches(matcher.warn, normalized)) {
      warnedNumbers.push(String(number));
    }
  }
  let status: DoNotContactStatus = 'allow';
  if (restrictedNumbers.length > 0) {
    status = 'restrict';
  }
  else if (warnedNumbers.length > 0) {
    status = 'warn';
  }
  return { status, restrictedNumbers, warnedNumbers };
}

// Trims, drops blanks and duplicates, and stops at the first entry that can't be saved.
export function normalizeEntryList(raw: unknown, region = 'US'): { entries: string[]; invalid?: { entry: string; reason: EntryInvalidReason } } {
  const entries: string[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw) ? raw : []) {
    const entry = String(item ?? '').trim();
    if (entry === '' || seen.has(entry)) {
      continue;
    }
    const validation = validateEntry(entry, region);
    if (!validation.valid) {
      return { entries, invalid: { entry, reason: validation.reason as EntryInvalidReason } };
    }
    seen.add(entry);
    entries.push(entry);
  }
  return { entries };
}

export default {
  validateEntry,
  normalizeEntryList,
  normalizeNumber,
  buildMatcher,
  checkNumbers,
};
