import { loadModule } from '../helpers/loadModule';
import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadPlatformService() {
  vi.resetModules();
  return loadModule('../../src/service/platformService.ts');
}

describe('platformService', () => {
  it('returns platform info from memory after it is set', async () => {
    const platformService = await loadPlatformService();

    await platformService.setPlatformInfo({
      platformInfo: {
        platformName: 'salesforce',
        hostname: 'salesforce.example',
      },
    });

    expect(await platformService.getPlatformInfo()).toEqual({
      platformName: 'salesforce',
      hostname: 'salesforce.example',
    });
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  it('loads platform info from chrome storage when session cache is empty', async () => {
    seedStorage({
      'platform-info': {
        platformName: 'hubspot',
        hostname: 'hubspot.example',
      },
    });
    const platformService = await loadPlatformService();

    await expect(platformService.getPlatformInfo()).resolves.toEqual({
      platformName: 'hubspot',
      hostname: 'hubspot.example',
    });
  });

  it('clears platform and CRM-auth related local state', async () => {
    seedStorage({
      serverSideLoggingToken: 'ssl-token',
      isAdmin: true,
      crmAuthed: true,
      'platform-info': { platformName: 'salesforce' },
      crm_extension_bullhornUsername: 'user',
      crm_extension_bullhorn_user_urls: { restUrl: 'https://rest.example' },
      unrelated: 'keep-me',
    });
    const platformService = await loadPlatformService();

    await platformService.clearPlatformInfo();

    expect(readStorage()).toEqual({ unrelated: 'keep-me' });
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('serverSideLoggingToken');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('isAdmin');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('crmAuthed');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('platform-info');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('crm_extension_bullhornUsername');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('crm_extension_bullhorn_user_urls');
  });
});
