import axios from 'axios';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { getRcAccessTokenHeaderConfig, getRcInfo } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
  setPlatformInfo: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessTokenHeaderConfig: vi.fn(() => ({
    headers: {
      'X-RC-Access-Token': 'rc-access-token',
    },
  })),
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
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://appconnect.labs.ringcentral.com/public-api/connectors/internal?access=internal&type=connector&accountId=account-1',
      { headers: { 'X-RC-Access-Token': 'rc-access-token' } },
    );
    expect(getRcAccessTokenHeaderConfig).toHaveBeenCalledTimes(1);
  });

  it('follows nextPageToken to collect every public connector page', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'public-1' }], nextPageToken: 'token 1' } })
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'public-2' }], nextPageToken: 'token-2' } })
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'public-3' }] } })
      .mockResolvedValueOnce({ data: { privateConnectors: [{ id: 'private-1' }] } });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPlatformList()).resolves.toEqual([
      { id: 'public-1', access: 'public' },
      { id: 'public-2', access: 'public' },
      { id: 'public-3', access: 'public' },
      { id: 'private-1', access: 'private' },
    ]);

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://appconnect.labs.ringcentral.com/public-api/connectors?type=connector');
    expect(axios.get).toHaveBeenNthCalledWith(2, 'https://appconnect.labs.ringcentral.com/public-api/connectors?type=connector&pageToken=token%201');
    expect(axios.get).toHaveBeenNthCalledWith(3, 'https://appconnect.labs.ringcentral.com/public-api/connectors?type=connector&pageToken=token-2');
  });

  it('stops paging when the server repeats a page token', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'a' }], nextPageToken: 't' } })
      .mockResolvedValueOnce({ data: { connectors: [{ id: 'b' }], nextPageToken: 't' } })
      .mockResolvedValueOnce({ data: {} });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPlatformList()).resolves.toEqual([
      { id: 'a', access: 'public' },
      { id: 'b', access: 'public' },
    ]);
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it('caches platform list results and handles empty catalog payloads', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPlatformList()).resolves.toEqual([]);
    await expect(manifestService.getPlatformList()).resolves.toEqual([]);

    expect(axios.get).toHaveBeenCalledTimes(2);
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
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://appconnect.labs.ringcentral.com/public-api/connectors/internal?access=internal&type=plugin&accountId=account-1',
      { headers: { 'X-RC-Access-Token': 'rc-access-token' } },
    );
    expect(getRcAccessTokenHeaderConfig).toHaveBeenCalledTimes(1);
  });

  it('returns an empty plugin list when catalog payloads omit connector arrays', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: {} });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPluginList()).resolves.toEqual([]);
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

  it('loads plugin details with explicit plugin id and returns undefined for unsupported access', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        platforms: {
          '': { name: 'Fallback Plugin' },
        },
      },
    });
    const manifestService = await loadManifestService();

    await expect(manifestService.getPluginDetails({
      pluginId: 'explicit-plugin',
      selectedPlugin: { id: 'catalog-id', access: 'public' },
    })).resolves.toEqual({ name: 'Fallback Plugin' });
    await expect(manifestService.getPluginDetails({
      selectedPlugin: { id: 'unknown-plugin', access: 'unknown' },
    })).resolves.toBeUndefined();

    expect(axios.get).toHaveBeenCalledWith('https://appconnect.labs.ringcentral.com/public-api/connectors/explicit-plugin/manifest?type=plugin');
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

  it('ignores non-matching overrides and creates nested override paths', async () => {
    const manifestService = await loadManifestService();
    const manifest = {
      serverUrl: 'https://default.example',
      platforms: {
        salesforce: {
          override: [
            {
              triggerType: 'meta',
            },
            {
              triggerType: 'hostname',
              triggerValue: 'other.example',
              overrideObjects: [
                { path: 'embedUrls.0', value: 'https://other.example/*' },
              ],
            },
            {
              triggerType: 'hostname',
              triggerValue: 'acme.example',
              overrideObjects: [
                { path: 'nested.child.value', value: 'created' },
              ],
            },
          ],
        },
      },
    };

    const saved = await manifestService.saveManifest({ manifest });

    expect(saved.platforms.salesforce).not.toHaveProperty('embedUrls');
    expect(saved.platforms.salesforce.nested.child.value).toBe('created');
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

  it('keeps a stored manifest object when refreshing without manifestUrl', async () => {
    seedStorage({
      customCrmManifest: {
        serverUrl: 'https://stored.example',
        platforms: {
          salesforce: {},
        },
      },
    });
    const manifestService = await loadManifestService();

    await expect(manifestService.refreshManifest()).resolves.toMatchObject({
      serverUrl: 'https://stored.example',
    });
    expect(axios.get).not.toHaveBeenCalled();
    expect(readStorage().manifestUrl).toBeUndefined();
    expect(readStorage().customCrmManifest).toMatchObject({
      serverUrl: 'https://stored.example',
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

  it('returns cached session manifest unless force refresh is requested', async () => {
    const manifestService = await loadManifestService();

    await manifestService.saveManifest({
      manifest: {
        serverUrl: 'https://session.example',
        platforms: {
          salesforce: {},
        },
      },
    });
    seedStorage({
      customCrmManifest: {
        serverUrl: 'https://storage.example',
        platforms: {
          salesforce: {},
        },
      },
    });

    await expect(manifestService.getManifest()).resolves.toMatchObject({
      serverUrl: 'https://session.example',
    });
    await expect(manifestService.getManifest(true)).resolves.toMatchObject({
      serverUrl: 'https://storage.example',
    });
  });

  describe('migrateLegacyManifestUrl', () => {
    const prodManifestUrl = 'https://unified-crm-extension.labs.ringcentral.com/crmManifest';
    const publicListUrl = 'https://appconnect.labs.ringcentral.com/public-api/connectors';
    const clioManifest = {
      serverUrl: 'https://unified-crm-extension.labs.ringcentral.com',
      platforms: { clio: {} },
    };

    function mockPublicCatalog() {
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: { connectors: [{ id: 'clio-id', name: 'clio', displayName: 'Clio' }] },
        })
        .mockResolvedValueOnce({ data: clioManifest });
    }

    it('moves an eligible legacy user to the public connector manifest', async () => {
      seedStorage({
        customCrmManifestUrl: prodManifestUrl,
        'platform-info': { platformName: 'clio', hostname: 'app.clio.com' },
      });
      mockPublicCatalog();
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(true);

      expect(axios.get).toHaveBeenNthCalledWith(1, `${publicListUrl}?type=connector`);
      expect(axios.get).toHaveBeenNthCalledWith(2, `${publicListUrl}/clio-id/manifest?type=connector`);
      const storage = readStorage();
      expect(storage.manifestUrl).toBe(`${publicListUrl}/clio-id/manifest?type=connector`);
      expect(storage.customCrmManifest).toMatchObject({ serverUrl: clioManifest.serverUrl });
      expect(storage.customCrmManifestUrl).toBeUndefined();
      expect(storage.manifestMigratedToPublicConnector).toBe(true);
      expect(storage['platform-info']).toEqual({
        platformName: 'clio',
        hostname: 'app.clio.com',
        platformDisplayName: 'Clio',
        connectorId: 'clio-id',
        devRcAccountId: '',
        isPrivate: false,
      });
    });

    it('does nothing again once migrated', async () => {
      seedStorage({
        manifestMigratedToPublicConnector: true,
        customCrmManifestUrl: prodManifestUrl,
        'platform-info': { platformName: 'clio' },
      });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(false);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it.each([
      ['a custom manifest URL', 'https://custom.example/crmManifest', { platformName: 'clio' }],
      ['a connector outside the migration list', prodManifestUrl, { platformName: 'gohighlevel' }],
      ['a legacy freshdesk platform', prodManifestUrl, { platformName: 'freshdesk' }],
      ['no platform info', prodManifestUrl, null],
    ])('leaves %s untouched', async (_label, customCrmManifestUrl, platformInfo) => {
      seedStorage({ customCrmManifestUrl, 'platform-info': platformInfo });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(false);

      expect(axios.get).not.toHaveBeenCalled();
      expect(readStorage().customCrmManifestUrl).toBe(customCrmManifestUrl);
      expect(readStorage().manifestMigratedToPublicConnector).toBeUndefined();
    });

    it('retires the legacy URL when the user already selected a dev console connector', async () => {
      seedStorage({
        customCrmManifestUrl: prodManifestUrl,
        manifestUrl: 'https://private.example/manifest',
        'platform-info': { platformName: 'gohighlevel', connectorId: 'private-id', isPrivate: true },
      });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(true);

      expect(axios.get).not.toHaveBeenCalled();
      expect(readStorage().customCrmManifestUrl).toBeUndefined();
      expect(readStorage().manifestUrl).toBe('https://private.example/manifest');
      expect(readStorage().manifestMigratedToPublicConnector).toBe(true);
    });

    it('repoints a stale prod manifestUrl to the selected public connector, even after the flag was set', async () => {
      seedStorage({
        manifestMigratedToPublicConnector: true,
        manifestUrl: prodManifestUrl,
        'platform-info': { platformName: 'clio', connectorId: 'clio-id', isPrivate: false },
      });
      vi.mocked(axios.get).mockResolvedValueOnce({ data: clioManifest });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(true);

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(`${publicListUrl}/clio-id/manifest?type=connector`);
      expect(readStorage().manifestUrl).toBe(`${publicListUrl}/clio-id/manifest?type=connector`);
      expect(readStorage().customCrmManifest).toMatchObject({ serverUrl: clioManifest.serverUrl });
    });

    it('repoints a stale prod manifestUrl to the selected private connector', async () => {
      seedStorage({
        customCrmManifestUrl: prodManifestUrl,
        manifestUrl: prodManifestUrl,
        'platform-info': { platformName: 'custom', connectorId: 'private-id', isPrivate: true, devRcAccountId: 'acct-9' },
      });
      vi.mocked(axios.get).mockResolvedValueOnce({ data: clioManifest });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(true);

      const privateUrl = `${publicListUrl}/private-id/manifest?access=internal&type=connector&accountId=acct-9`;
      expect(axios.get).toHaveBeenCalledWith(privateUrl);
      expect(readStorage().manifestUrl).toBe(privateUrl);
      expect(readStorage().customCrmManifestUrl).toBeUndefined();
    });

    it('does nothing for a selected connector with no legacy override', async () => {
      seedStorage({
        manifestUrl: `${publicListUrl}/clio-id/manifest?type=connector`,
        'platform-info': { platformName: 'clio', connectorId: 'clio-id' },
      });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(false);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('leaves storage untouched so it retries when the public connector is missing', async () => {
      seedStorage({
        customCrmManifestUrl: prodManifestUrl,
        'platform-info': { platformName: 'clio' },
      });
      vi.mocked(axios.get).mockResolvedValueOnce({ data: { connectors: [{ id: 'other', name: 'other' }] } });
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(false);

      expect(readStorage().customCrmManifestUrl).toBe(prodManifestUrl);
      expect(readStorage().manifestMigratedToPublicConnector).toBeUndefined();
    });

    it('leaves storage untouched so it retries when the network fails', async () => {
      seedStorage({
        customCrmManifestUrl: prodManifestUrl,
        'platform-info': { platformName: 'clio' },
      });
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('offline'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manifestService = await loadManifestService();

      await expect(manifestService.migrateLegacyManifestUrl()).resolves.toBe(false);

      expect(readStorage().customCrmManifestUrl).toBe(prodManifestUrl);
      expect(readStorage().manifestMigratedToPublicConnector).toBeUndefined();
      expect(readStorage().manifestUrl).toBeUndefined();
      warn.mockRestore();
    });
  });

  it('returns stored string manifests without applying overrides', async () => {
    seedStorage({
      customCrmManifest: 'https://string-manifest.example/manifest.json',
    });
    const manifestService = await loadManifestService();

    await expect(manifestService.getManifest(true)).resolves.toBe('https://string-manifest.example/manifest.json');
  });
});
