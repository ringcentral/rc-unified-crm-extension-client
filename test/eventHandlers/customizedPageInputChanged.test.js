const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

function installAdapter(widgetMessages) {
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            widgetMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };
}

test('developer settings input change opens the selected implemented interface documentation', async () => {
  const openedWindows = [];
  global.window = {
    open(url, target) {
      openedWindows.push({ url, target });
    },
  };

  const developerSettingsPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/developerSettingsPage.js'
  );

  await developerSettingsPage.onEvent({
    data: {
      body: {
        formData: {
          implementedInterfaces: 'contact-search',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(openedWindows, [
    {
      url: 'https://appconnect.labs.ringcentral.com/developers/interfaces/contact-search',
      target: '_blank',
    },
  ]);
});

test('platform selection page search refreshes the customized page render with the selected filter and platform', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const debounceConfigs = [];
  const platformList = [
    { id: 'salesforce', displayName: 'Salesforce' },
    { id: 'hubspot', displayName: 'HubSpot' },
  ];
  const renderCalls = [];

  const platformSelectionPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/platformSelectionPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          createDebounceHandler(name) {
            debounceConfigs.push(name);
            return function runImmediately(request, handler) {
              return handler(request);
            };
          },
        },
        '../../../../../service/manifestService': {
          async getPlatformList() {
            return platformList;
          },
        },
        '../../../../../components/platformSelectionPage': {
          getPlatformSelectionPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'platformSelectionPage',
              platformNames: args.platformList.map((platform) => platform.displayName),
              searchWord: args.searchWord,
            };
          },
        },
      },
    }
  );

  await platformSelectionPage.onEvent({
    data: {
      body: {
        formData: {
          platformSearch: {
            search: 'hub',
            filter: 'public',
          },
          platforms: 'hubspot',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: '',
    platform: null,
  });

  assert.deepEqual(debounceConfigs, ['platformSearch']);
  assert.deepEqual(renderCalls, [
    {
      platformList,
      searchWord: 'hub',
      selectedPlatform: 'hubspot',
      filter: 'public',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'platformSelectionPage',
          platformNames: ['Salesforce', 'HubSpot'],
          searchWord: 'hub',
        },
      },
      targetOrigin: undefined,
    },
  ]);
});

test('hostname input page debounces dynamic URL edits and marks URLs outside the connector pattern invalid', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const debounceConfigs = [];
  const pendingDebounces = [];
  const hostnamePageCalls = [];

  const hostnameInputPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/hostnameInputPage.js',
    {
      stubs: {
        '../../../../../components/hostnameInputPage': {
          getHostnameInputPageRender(args) {
            hostnamePageCalls.push(args);
            return {
              id: 'hostnameInputPage',
              isUrlValid: args.isUrlValid,
              inputUrl: args.inputUrl,
            };
          },
        },
        '../../../../../core/auth': {
          async getManagedAuthState() {
            throw new Error('OAuth hostname input should not request API-key managed auth state');
          },
        },
        '../../../../../lib/util': {
          createDebounceHandler(name, delay) {
            debounceConfigs.push({ name, delay });
            return function runAndTrack(payload, handler) {
              const promise = handler(payload);
              pendingDebounces.push(promise);
              return promise;
            };
          },
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-1',
                  },
                },
              },
            };
          },
        },
      },
    }
  );

  const manifest = {
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'dynamic',
          url: 'https://*.acme.example.com/*',
        },
        auth: {
          type: 'oauth',
        },
      },
    },
  };

  await hostnameInputPage.onEvent({
    data: {
      body: {
        keys: ['url'],
        formData: {
          platformId: 'acme',
          url: 'https://wrong.example.com/app',
          selection: 'manual',
          connectorId: 'connector-1',
          isPrivate: true,
        },
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: manifest.platforms.acme,
  });
  await Promise.all(pendingDebounces);

  assert.deepEqual(debounceConfigs, [
    {
      name: 'hostnameInputPageUrl',
      delay: 300,
    },
  ]);
  assert.equal(hostnamePageCalls[0].isUrlValid, false);
  assert.equal(hostnamePageCalls[0].inputUrl, 'https://wrong.example.com/app');
  assert.equal(hostnamePageCalls[0].selection, 'manual');
  assert.equal(hostnamePageCalls[0].submitText, undefined);
  assert.equal(hostnamePageCalls[0].readyMessage, '');
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'hostnameInputPage',
          isUrlValid: false,
          inputUrl: 'https://wrong.example.com/app',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/hostnameInputPage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('hostname input page shows connect readiness when API-key managed auth fields are satisfied', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const rcInfo = {
    value: {
      cachedData: {
        accountInfo: {
          id: 'rc-account-2',
        },
      },
    },
  };
  const managedAuthCalls = [];
  const hostnamePageCalls = [];

  const hostnameInputPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/hostnameInputPage.js',
    {
      stubs: {
        '../../../../../components/hostnameInputPage': {
          getHostnameInputPageRender(args) {
            hostnamePageCalls.push(args);
            return {
              id: 'hostnameInputPage',
              submitText: args.submitText,
              readyMessage: args.readyMessage,
            };
          },
        },
        '../../../../../core/auth': {
          async getManagedAuthState(args) {
            managedAuthCalls.push(args);
            return {
              allRequiredFieldsSatisfied: true,
            };
          },
        },
        '../../../../../lib/util': {
          createDebounceHandler() {
            return function shouldNotDebounce() {
              throw new Error('non-url input changes should render immediately');
            };
          },
          async getRcInfo() {
            return rcInfo;
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        name: 'acme',
        displayName: 'Acme CRM',
        environment: {
          type: 'dynamic',
          url: 'https://*.acme.example.com/*',
        },
        auth: {
          type: 'apiKey',
        },
      },
    },
  };

  await hostnameInputPage.onEvent({
    data: {
      body: {
        keys: ['selection'],
        formData: {
          platformId: 'acme',
          url: 'https://tenant.acme.example.com/app',
          selection: 'managed',
          connectorId: 'connector-2',
          isPrivate: false,
        },
      },
    },
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: manifest.platforms.acme,
  });

  assert.deepEqual(managedAuthCalls, [
    {
      serverUrl: 'https://server.example.com',
      platformName: 'acme',
      connectorId: 'connector-2',
      isPrivate: false,
      rcInfo,
    },
  ]);
  assert.equal(hostnamePageCalls[0].isUrlValid, true);
  assert.equal(hostnamePageCalls[0].submitText, 'Connect');
  assert.equal(
    hostnamePageCalls[0].readyMessage,
    'All required authentication fields are ready. Click Connect to connect to Acme CRM.'
  );
  assert.deepEqual(widgetMessages.map(({ message }) => message), [
    {
      type: 'rc-adapter-register-customized-page',
      page: {
        id: 'hostnameInputPage',
        submitText: 'Connect',
        readyMessage: 'All required authentication fields are ready. Click Connect to connect to Acme CRM.',
      },
    },
    {
      type: 'rc-adapter-navigate-to',
      path: '/customized/hostnameInputPage',
    },
  ]);
});
