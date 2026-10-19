import axios from 'axios';
import adminCore from '../../src/core/admin.ts';
import { getRcAccessToken } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
}));

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    authServerSideLogging: vi.fn(),
  },
}));

async function loadUserCore() {
  vi.resetModules();
  return loadModule('../../src/core/user.ts');
}

describe('user server-side logging token update', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(adminCore.authServerSideLogging).mockReset();
    vi.mocked(getRcAccessToken).mockReset().mockReturnValue('rc-access-token');
  });

  it('does nothing when server-side logging is disabled', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { serverSideLogging: { enable: false } } });
    const userCore = await loadUserCore();

    await userCore.updateSSCLToken({
      serverUrl: 'https://server.example',
      platform: { serverSideLogging: { url: 'https://ssl.example' } },
      token: 'crm-token',
    });

    expect(adminCore.authServerSideLogging).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does nothing when online user settings are missing server-side logging config', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: null });
    const userCore = await loadUserCore();

    await userCore.updateSSCLToken({
      serverUrl: 'https://server.example',
      platform: { serverSideLogging: { url: 'https://ssl.example' } },
      token: 'crm-token',
    });

    expect(adminCore.authServerSideLogging).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('authenticates server-side logging and updates CRM token when enabled', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { serverSideLogging: { enable: true } } });
    vi.mocked(adminCore.authServerSideLogging).mockResolvedValueOnce('ssl-token');
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { ok: true } });
    const userCore = await loadUserCore();

    await userCore.updateSSCLToken({
      serverUrl: 'https://server.example',
      platform: {
        name: 'salesforce',
        serverSideLogging: { url: 'https://ssl.example' },
      },
      token: 'crm-token',
    });

    expect(getRcAccessToken).toHaveBeenCalled();
    expect(adminCore.authServerSideLogging).toHaveBeenCalledWith({
      platform: {
        name: 'salesforce',
        serverSideLogging: { url: 'https://ssl.example' },
      },
    });
    expect(axios.post).toHaveBeenCalledWith('https://ssl.example/update-crm-token', {
      crmToken: 'crm-token',
      crmPlatform: 'salesforce',
      crmAdapterUrl: 'https://server.example',
    }, {
      headers: {
        Accept: 'application/json',
        'X-Access-Token': 'ssl-token',
      },
    });
  });
});
