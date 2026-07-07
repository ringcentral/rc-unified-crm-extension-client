type UnknownRecord = Record<string, unknown>;

interface TokenLookupResult {
  found: boolean;
  value?: unknown;
}

interface RenderUrlTemplateOptions {
  template: unknown;
  values?: UnknownRecord;
  userSettings?: UnknownRecord;
}

interface RenderUrlTemplateResult {
  url: unknown;
  missingTokens: string[];
}

function hasOwn(obj: unknown, key: string): obj is UnknownRecord {
  return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

function getUserSettingValue(userSettings: UnknownRecord, token: string): TokenLookupResult {
  if (!hasOwn(userSettings, token)) {
    return {
      found: false,
    };
  }
  const setting = userSettings[token];
  if (setting && typeof setting === 'object' && hasOwn(setting, 'value')) {
    return {
      found: true,
      value: setting.value,
    };
  }
  return {
    found: true,
    value: setting,
  };
}

function resolveTokenValue({
  token,
  values,
  userSettings,
}: {
  token: string;
  values: UnknownRecord;
  userSettings: UnknownRecord;
}): TokenLookupResult {
  if (hasOwn(values, token)) {
    return {
      found: true,
      value: values[token],
    };
  }
  return getUserSettingValue(userSettings, token);
}

export function renderUrlTemplate({
  template,
  values = {},
  userSettings = {},
}: RenderUrlTemplateOptions): RenderUrlTemplateResult {
  if (typeof template !== 'string') {
    return {
      url: template,
      missingTokens: [],
    };
  }
  const missingTokens: string[] = [];
  const url = template.replace(/\{([^{}\s]+)\}/g, (match, token: string) => {
    const resolved = resolveTokenValue({ token, values, userSettings });
    if (!resolved.found) {
      missingTokens.push(token);
      return match;
    }
    return String(resolved.value);
  });
  return {
    url,
    missingTokens,
  };
}

export function isSafeHttpUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('https://') || url.startsWith('http://')) &&
    !url.toLowerCase().includes('javascript')
  );
}

const urlTemplate = {
  renderUrlTemplate,
  isSafeHttpUrl,
};

export default urlTemplate;
