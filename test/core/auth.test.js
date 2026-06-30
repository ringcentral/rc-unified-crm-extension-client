const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

const authModuleStubs = {
  axios: {},
  '../lib/util': {},
  '../service/platformService': {},
  '../service/manifestService': {},
  '../lib/analytics': {},
  idb: {},
  '../components/platformSelectionPage': {},
  '../service/embeddableServices': {},
  '../components/authPage': {},
  '../components/managedOAuthSetupPage': {},
  '../components/managedOAuthMissingPage': {},
  '../misc/bullhorn': {},
  '../i18n': { t: (key) => key },
  '../components/pluginConfigurePage': {},
  '../service/pluginService': {},
  './admin': {},
  './user': {},
};

test('auth builds OAuth URL from platform OAuth configuration', async () => {
  const auth = await loadBundledModule('src/core/auth.js', {
    stubs: authModuleStubs,
  });

  const url = auth.buildOAuthUrl({
    authorizationUri: 'https://crm.example.com/oauth/authorize',
    clientId: 'client/with space',
    redirectUri: 'https://extension.example.com/oauth callback',
    scopes: 'read contacts',
    platformName: 'acme',
  });

  assert.equal(
    url,
    'https://crm.example.com/oauth/authorize?' +
      'response_type=code' +
      '&client_id=client%2Fwith%20space' +
      '&scope=read%20contacts' +
      '&state=platform=acme' +
      '&redirect_uri=https%3A%2F%2Fextension.example.com%2Foauth%20callback'
  );
});

test('auth blocks CRM visibility and opens managed OAuth setup when admin values are missing', async () => {
  const getUrls = [];
  const postedMessages = [];

  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            postedMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };

  const auth = await loadBundledModule('src/core/auth.js', {
    stubs: {
      ...authModuleStubs,
      axios: {
        async get(url) {
          getUrls.push(url);
          return {
            data: {
              hasAccountOAuth: false,
              isAdmin: true,
              pendingValues: {
                clientId: 'pending-client',
              },
            },
          };
        },
      },
      '../lib/util': {
        getRcAccessToken() {
          return 'rc-access-token';
        },
      },
      '../components/managedOAuthSetupPage': {
        getManagedOAuthSetupPageRender({ platform, pendingValues }) {
          return {
            id: 'managedOAuthSetupPage',
            platformName: platform.name,
            pendingValues,
          };
        },
      },
    },
  });

  const result = await auth.checkManagedOAuthBeforeCrmVisible({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      name: 'Acme CRM',
      auth: {
        type: 'oauth',
        oauth: {
          adminManaged: {
            enabled: true,
          },
        },
      },
    },
  });

  assert.deepEqual(getUrls, [
    'https://server.example.com/oauthManagedAuthState?platform=acme&rcAccessToken=rc-access-token',
  ]);
  assert.equal(result.blocked, true);
  assert.equal(result.state.isAdmin, true);
  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'managedOAuthSetupPage',
          platformName: 'Acme CRM',
          pendingValues: {
            clientId: 'pending-client',
          },
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/managedOAuthSetupPage',
      },
      targetOrigin: '*',
    },
  ]);
});
