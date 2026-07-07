import axios from 'axios';
import { getManifest, getPluginList, getPluginDetails } from '../../src/service/manifestService.ts';
import { getRcInfo, showNotification } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
  getPluginList: vi.fn(),
  getPluginDetails: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcInfo: vi.fn(),
  showNotification: vi.fn(),
}));

async function loadPluginService() {
  vi.resetModules();
  return loadModule('../../src/service/pluginService.ts');
}

describe('pluginService', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(getManifest).mockReset();
    vi.mocked(getPluginList).mockReset();
    vi.mocked(getPluginDetails).mockReset();
    vi.mocked(getRcInfo).mockReset();
    vi.mocked(showNotification).mockReset();
  });

  it('bypasses license check when plugin does not require a license', async () => {
    const service = await loadPluginService();

    await expect(service.getPluginLicenseStatus({
      pluginId: 'plugin-1',
      plugin: { requireLicense: false },
    })).resolves.toEqual({
      id: 'plugin-1',
      licenseStatus: true,
      licenseStatusDescription: '',
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('gets plugin license status using RingCentral account fallback', async () => {
    vi.mocked(getManifest).mockResolvedValue({ serverUrl: 'https://server.example' });
    vi.mocked(getRcInfo).mockResolvedValue({
      value: {
        cachedData: {
          extensionInfo: {
            account: { id: 12345 },
          },
        },
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        licenseStatus: false,
        licenseStatusDescription: 'Expired',
      },
    });
    const service = await loadPluginService();

    await expect(service.getPluginLicenseStatus({
      pluginId: 'plugin-1',
      plugin: { id: 'plugin-1', requireLicense: true },
    })).resolves.toEqual({
      id: 'plugin-1',
      licenseStatus: false,
      licenseStatusDescription: 'Expired',
    });

    expect(axios.get).toHaveBeenCalledWith('https://server.example/plugin/licenseStatus?rcAccountId=12345&pluginId=plugin-1');
  });

  it('updates installed plugin settings when catalog version changes and notifies user', async () => {
    seedStorage({
      userSettings: {
        plugin_plugin1: {
          value: {
            name: 'Old Plugin',
            version: '1.0.0',
            access: 'public',
          },
        },
        unrelated: { value: true },
      },
    });
    vi.mocked(getPluginList).mockResolvedValue([
      { id: 'plugin1', name: 'New Plugin', version: '2.0.0', access: 'public' },
    ]);
    vi.mocked(getPluginDetails).mockResolvedValue({
      isAsync: true,
      phase: 'afterLog',
      supportedLogTypes: ['Call'],
    });
    const service = await loadPluginService();

    await expect(service.checkAndUpdatePluginVersion()).resolves.toEqual({
      plugin_plugin1: {
        value: {
          name: 'New Plugin',
          version: '2.0.0',
          isAsync: true,
          phase: 'afterLog',
          access: 'public',
          logTypes: ['Call'],
        },
      },
    });

    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'New Plugin upgraded to 2.0.0\n',
      ttl: 5000,
    });
  });
});
