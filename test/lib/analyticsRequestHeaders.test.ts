import axios from 'axios';
import { loadModule } from '../helpers/loadModule';

const capture = vi.hoisted(() => ({ interceptor: undefined as any }));
vi.mock('axios', () => ({ default: { interceptors: { request: { use: vi.fn(fn => { capture.interceptor = fn; }) } } } }));

function requestHeaders(initial: Record<string, string> = {}) {
  const values = { ...initial };
  Object.defineProperties(values, {
    set: { value: (name, value) => { values[name] = value; } },
    delete: { value: name => { delete values[name]; } },
  });
  return values;
}

describe('analytics request headers', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('attaches normalized raw IDs only to the configured adapter origin and path', async () => {
    vi.resetModules();
    const headers = await loadModule('../../src/lib/analyticsRequestHeaders.ts');
    headers.setRawAnalyticsRequestHeaders('https://adapter.example/core', 900, '101');
    expect(axios.interceptors.request.use).toHaveBeenCalled();
    const forUrl = url => capture.interceptor({ url, headers: requestHeaders() }).headers;
    expect(forUrl('https://adapter.example/core/contact')).toEqual({ 'rc-analytics-account-id': '900', 'rc-analytics-extension-id': '101' });
    for (const url of ['https://platform.ringcentral.com/restapi', 'https://crm.example/contact', 'https://adapter.example/core-other/contact']) {
      expect(forUrl(url)).toEqual({});
    }
    headers.clearRawAnalyticsRequestHeaders();
    expect(forUrl('https://adapter.example/core/contact')).toEqual({});
  });
  it('replaces user context, strips stale supplied headers and respects the disable switch', async () => {
    vi.resetModules();
    const headers = await loadModule('../../src/lib/analyticsRequestHeaders.ts');
    headers.setRawAnalyticsRequestHeaders('https://adapter.example', '900', '101');
    headers.setRawAnalyticsRequestHeaders('https://adapter.example', '901', '202');
    const request = () => ({ url: '/contact', baseURL: 'https://adapter.example', headers: requestHeaders({ 'rc-analytics-extension-id': '101' }) });
    expect(capture.interceptor(request()).headers).toEqual({ 'rc-analytics-account-id': '901', 'rc-analytics-extension-id': '202' });
    vi.stubEnv('MIXPANEL_RAW_IDS_ENABLED', 'false');
    expect(capture.interceptor(request()).headers).toEqual({});
  });
});
