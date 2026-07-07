// @ts-nocheck
import axios from 'axios';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { getRcInfo } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcInfo: vi.fn(),
}));

async function loadManifestService() {
  vi.resetModules();
  return loadModule('../../src/service/manifestService.ts');
}

function mockRcInfo(accountId = 'account-1') {
  vi.mocked(getRcInfo).mockResolvedValue({
    value: {
      cachedData: {
        accountInfo: { id: accountId },
        extensionInfo: {
          account: { id: accountId },
        },
      },
    },
  });
}

describe('manifestService', () => {
  beforeEach(() => {
    vi.mocked(getPlatformInfo).mockResolvedValue({
      platformName: 'salesforce',
      hostname: 'acme.example',
    });
    mockRcInfo();
  });

  it('merges public, shared, and private connector lists with access markers', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'public-1' }] } })
      .mockResolvedValueOnce({
        data: {
          sharedConnectors: [{ id: 'shared-1' }],
          privateConnectors: [{ id: 'private-1' }],
        },
      });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPlatformList()).resolves.toEqual([
      { id: 'public-1', access: 'public' },
      { id: 'shared-1', access: 'shared' },
      { id: 'private-1', access: 'private' },
    ]);

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://appconnect.labs.ringcentral.com/public-api/connectors?type=connector');
    expect(axios.get).toHaveBeenNthCalledWith(2, 'https://appconnect.labs.ringcentral.com/public-api/connectors/internal?access=internal&type=connector&accountId=account-1');
  });

  it('merges public, shared, and private plugin lists with access markers', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'public-plugin' }] } })
      .mockResolvedValueOnce({
        data: {
          sharedConnectors: [{ id: 'shared-plugin' }],
          privateConnectors: [{ id: 'private-plugin' }],
        },
      });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPluginList()).resolves.toEqual([
      { id: 'public-plugin', access: 'public' },
      { id: 'shared-plugin', access: 'shared' },
      { id: 'private-plugin', access: 'private' },
    ]);

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://appconnect.labs.ringcentral.com/public-api/connectors?type=plugin');
    expect(axios.get).toHaveBeenNthCalledWith(2, 'https://appconnect.labs.ringcentral.com/public-api/connectors/internal?access=internal&type=plugin&accountId=account-1');
  });

  it('loads plugin details with access-specific catalog URLs', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { platforms: { publicPlugin: { name: 'Public Plugin' } } } })
      .mockResolvedValueOnce({ data: { platforms: { sharedPlugin: { name: 'Shared Plugin' } } } })
      .mockResolvedValueOnce({ data: { platforms: { privatePlugin: { name: 'Private Plugin' } } } });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPluginDetails({
      selectedPlugin: { id: 'public-plugin', name: 'publicPlugin', access: 'public' },
    })).resolves.toEqual({ name: 'Public Plugin' });
    await expect(manifestService.getPluginDetails({
      selectedPlugin: { id: 'shared-plugin', name: 'sharedPlugin', access: 'shared', accountId: 'shared-account' },
    })).resolves.toEqual({ name: 'Shared Plugin' });
    await expect(manifestService.getPluginDetails({
      selectedPlugin: { id: 'private-plugin', name: 'privatePlugin', access: 'private' },
    })).resolves.toEqual({ name: 'Private Plugin' });

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://appconnect.labs.ringcentral.com/public-api/connectors/public-plugin/manifest?type=plugin');
    expect(axios.get).toHaveBeenNthCalledWith(2, 'https://appconnect.labs.ringcentral.com/public-api/connectors/shared-plugin/manifest?access=internal&type=plugin&accountId=shared-account');
    expect(axios.get).toHaveBeenNthCalledWith(3, 'https://appconnect.labs.ringcentral.com/public-api/connectors/private-plugin/manifest?access=internal&type=plugin&accountId=account-1');
  });

  it('saves manifest URL in local storage', async () => {
    const manifestService = await loadManifestService();

    await expect(manifestService.saveManifestUrl({ manifestUrl: 'https://manifest.example/manifest.json' }))
      .resolves.toBe('https://manifest.example/manifest.json');

    expect(readStorage()).toEqual({
      manifestUrl: 'https://manifest.example/manifest.json',
    });
  });

  it('applies meta and hostname overrides when saving a manifest', async () => {
    const manifestService = await loadManifestService();
    const manifest = {
      serverUrl: 'https://default.example',
      platforms: {
        salesforce: {
          embedUrls: ['https://default.example/*'],
          override: [
            {
              triggerType: 'meta',
              overrideObjects: [
                { path: 'serverUrl', value: 'https://meta.example' },
              ],
            },
            {
              triggerType: 'hostname',
              triggerValue: 'acme.example',
              overrideObjects: [
                { path: 'embedUrls.0', value: 'https://acme.example/*' },
              ],
            },
          ],
        },
      },
    };

    const saved = await manifestService.saveManifest({ manifest });

    expect(saved.serverUrl).toBe('https://meta.example');
    expect(saved.platforms.salesforce.embedUrls[0]).toBe('https://acme.example/*');
    expect(readStorage().customCrmManifest).toEqual(saved);
  });

  it('refreshes a manifest from the stored manifest URL', async () => {
    seedStorage({ manifestUrl: 'https://manifest.example/manifest.json' });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        serverUrl: 'https://server.example',
        platforms: {
          salesforce: {},
        },
      },
    });
    const manifestService = await loadManifestService();

    await expect(manifestService.refreshManifest()).resolves.toMatchObject({
      serverUrl: 'https://server.example',
    });
    expect(axios.get).toHaveBeenCalledWith('https://manifest.example/manifest.json');
  });

  it('migrates legacy custom manifest storage into manifestUrl when refreshing', async () => {
    seedStorage({
      customCrmManifest: 'https://legacy.example/manifest.json',
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        serverUrl: 'https://server.example',
        platforms: {
          salesforce: {},
        },
      },
    });
    const manifestService = await loadManifestService();

    await manifestService.refreshManifest();

    expect(readStorage().manifestUrl).toBe('https://legacy.example/manifest.json');
    expect(readStorage().customCrmManifest).toMatchObject({
      serverUrl: 'https://server.example',
    });
  });

  it('returns null when refresh has neither manifestUrl nor customCrmManifest', async () => {
    const manifestService = await loadManifestService();

    await expect(manifestService.refreshManifest()).resolves.toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('loads stored custom manifest and applies overrides in getManifest', async () => {
    seedStorage({
      customCrmManifest: {
        serverUrl: 'https://default.example',
        platforms: {
          salesforce: {
            override: [
              {
                triggerType: 'meta',
                overrideObjects: [
                  { path: 'serverUrl', value: 'https://meta.example' },
                ],
              },
            ],
          },
        },
      },
    });
    const manifestService = await loadManifestService();

    await expect(manifestService.getManifest()).resolves.toMatchObject({
      serverUrl: 'https://meta.example',
    });
  });
});
