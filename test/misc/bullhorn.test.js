const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function createBullhornPlatform() {
  return {
    name: 'bullhorn',
    auth: {
      oauth: {
        clientId: 'bullhorn-client-id',
      },
    },
  };
}

async function loadBullhorn({ initialStorage = {}, axiosGet } = {}) {
  const storage = createChromeStorage(initialStorage);
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };
  const notifications = [];

  const bullhorn = await loadBundledModule('src/misc/bullhorn.js', {
    stubs: {
      axios: {
        get: axiosGet ?? (async () => {
          throw new Error('unexpected axios.get');
        }),
      },
      '../lib/util': {
        showNotification(payload) {
          notifications.push(payload);
        },
      },
      '../lib/analytics': {
        trackCrmAuthFail() {},
      },
      '../service/embeddableServices': {
        async getServiceManifest() {
          return { id: 'service' };
        },
      },
      '../service/manifestService': {
        async getManifest() {
          return { serverUrl: 'https://server.example.com' };
        },
      },
      '../components/calldownPage': {
        getCalldownPageRender() {
          return { id: 'calldownPage' };
        },
      },
      '../core/user': {
        getShowCalldownTabSetting() {
          return { value: false };
        },
      },
    },
  });

  return { bullhorn, storage, runtimeMessages, notifications };
}

test.afterEach(() => {
  delete global.chrome;
});

test('tryConnectToBullhorn opens third-party auth using cached Bullhorn OAuth URL', async () => {
  const axiosCalls = [];
  const { bullhorn, runtimeMessages, notifications } = await loadBullhorn({
    initialStorage: {
      crm_extension_bullhorn_user_urls: {
        oauthUrl: 'https://auth.bullhorn.example.com/oauth',
      },
    },
    async axiosGet(url) {
      axiosCalls.push(url);
      return { data: {} };
    },
  });

  await bullhorn.tryConnectToBullhorn({ platform: createBullhornPlatform() });

  assert.deepEqual(axiosCalls, []);
  assert.deepEqual(notifications, []);
  assert.deepEqual(runtimeMessages, [
    {
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://auth.bullhorn.example.com/oauth/authorize?response_type=code&action=Login&client_id=bullhorn-client-id&state=platform=bullhorn&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html',
    },
  ]);
});

test('tryConnectToBullhorn fetches and caches Bullhorn loginInfo before opening auth when URL cache is missing', async () => {
  const axiosCalls = [];
  const { bullhorn, storage, runtimeMessages, notifications } = await loadBullhorn({
    initialStorage: {
      crm_extension_bullhornUsername: 'ada.bullhorn',
    },
    async axiosGet(url) {
      axiosCalls.push(url);
      return {
        data: {
          oauthUrl: 'https://auth.bullhorn.example.com/oauth',
          restUrl: 'https://rest.bullhorn.example.com/rest',
        },
      };
    },
  });

  await bullhorn.tryConnectToBullhorn({ platform: createBullhornPlatform() });

  assert.deepEqual(axiosCalls, [
    'https://rest.bullhornstaffing.com/rest-services/loginInfo?username=ada.bullhorn',
  ]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, 'warning');
  assert.match(notifications[0].message, /Login failure/);
  assert.deepEqual(storage.store.crm_extension_bullhorn_user_urls, {
    oauthUrl: 'https://auth.bullhorn.example.com/oauth',
    restUrl: 'https://rest.bullhorn.example.com/rest',
  });
  assert.deepEqual(runtimeMessages, [
    {
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://auth.bullhorn.example.com/oauth/authorize?response_type=code&action=Login&client_id=bullhorn-client-id&state=platform=bullhorn&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html',
    },
  ]);
});