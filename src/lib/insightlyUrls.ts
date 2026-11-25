const settingsPath = '/Users/UserSettings';

function parseHttpsUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string') {
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password) {
      return url;
    }
  } catch {
    return;
  }
}

export function parseInsightlySettingsUrl(value: unknown): URL | undefined {
  const url = parseHttpsUrl(value);
  if (url?.pathname === settingsPath
      && (url.hostname === 'insightly.com' || url.hostname.endsWith('.insightly.com'))) {
    return url;
  }
}

export function insightlySettingsUrlForHostname(hostname: unknown): URL | undefined {
  if (typeof hostname === 'string' && /^[a-z0-9.-]+$/i.test(hostname)) {
    return parseInsightlySettingsUrl(`https://${hostname}${settingsPath}`);
  }
}

export function isInsightlyApiUrl(value: unknown): value is string {
  const url = parseHttpsUrl(value);
  return !!url
    && /^api(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)?\.insightly\.com$/.test(url.hostname)
    && /^\/(?:v\d+(?:\.\d+)?\/?)?$/i.test(url.pathname)
    && !url.search && !url.hash;
}
