const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

test('platformService clears platform-specific auth and cache state', async () => {
  const activePlatform = {
    platformName: 'acme',
    hostname: 'tenant.example.com',
  };
  const storage = createChromeStorage({
    'platform-info': activePlatform,
    serverSideLoggingToken: 'server-side-token',
    isAdmin: true,
    crmAuthed: true,
    crm_extension_bullhornUsername: 'bullhorn-user',
    crm_extension_bullhorn_user_urls: { restUrl: 'https://rest.example.com' },
    unrelated: 'keep-me',
  });
  global.chrome = storage.chrome;

  const platformService = await loadBundledModule('src/service/platformService.js');

  assert.deepEqual(await platformService.getPlatformInfo(), activePlatform);

  await platformService.clearPlatformInfo();

  assert.equal(storage.store['platform-info'], undefined);
  assert.equal(storage.store.serverSideLoggingToken, undefined);
  assert.equal(storage.store.isAdmin, undefined);
  assert.equal(storage.store.crmAuthed, undefined);
  assert.equal(storage.store.crm_extension_bullhornUsername, undefined);
  assert.equal(storage.store.crm_extension_bullhorn_user_urls, undefined);
  assert.equal(storage.store.unrelated, 'keep-me');
  assert.equal(await platformService.getPlatformInfo(), undefined);
});