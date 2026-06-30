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

function createHandlerStub(calls, name) {
  return {
    async onEvent(args) {
      calls.push({ name, args });
    },
  };
}

function createRouterStubs(calls) {
  const stubs = {};
  const handlerPaths = [
    './pages/c2dSchedulePage',
    './pages/editUserMappingPage',
    './pages/userMappingPage',
    './pages/hostnameInputPage',
    './pages/platformSelectionPage',
    './pages/getMultiContactPopPromptPage',
    './pages/calldownPage',
    './pages/googleSheetsPage',
    './pages/contactSearchResultCallLog',
    './pages/contactSearchResultMessageLog',
    './pages/reportPage',
    './pages/unloggedCallPage',
    './pages/developerSettingsPage',
    './pages/getErrorLogRecordPage',
    './pages/logRecordSubmissionPage',
    './pages/adminGoogleSheetsPage',
    './pages/pluginAdminSettingsPage',
    './pages/managedAuthUserPage',
    './pages/managedAuthUserEditPage',
    './sections/generalSettings',
    './sections/managedSettings',
    './sections/appearance',
    './sections/clickToDialMatcher',
    './sections/customizeTabs',
    './sections/widgetSettings',
    './sections/notificationLevel',
    './sections/phoneNumberFormat',
    './sections/clickToDialEmbed',
    './sections/callAndSMSLogging',
    './sections/serverSideLoggingSetting',
    './sections/contactSetting',
    './sections/advancedFeaturesSetting',
    './sections/customSettings',
    './sections/callLogDetailsSetting',
    './sections/autoLogPreferences',
    './sections/userMapping',
    './sections/googleSheetsAdminConfig',
    './sections/pluginsAdminConfig',
    './sections/installedPlugins',
    './sections/managedAuthentication',
    './sections/managedOAuth',
    './sections/managedAuthOrg',
    './sections/managedAuthUser',
    '../../pluginMarketListPage',
    '../../custom-button-click/plugins/selectPlugin',
    './appointmentsPage',
    './appointmentPage',
  ];

  for (const handlerPath of handlerPaths) {
    stubs[handlerPath] = createHandlerStub(calls, handlerPath);
  }
  return stubs;
}

test('customized page input router responds to the widget and passes plugin id to plugin admin settings page', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calls = [];
  const router = await loadBundledModule('src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js', {
    stubs: createRouterStubs(calls),
  });

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const platform = {
    name: 'acme',
  };
  const data = {
    requestId: 'req-plugin-admin-settings',
    body: {
      page: {
        id: 'pluginAdminSettingsPage',
      },
      formData: {
        section: 'plugin-alpha',
      },
    },
  };

  await router.onEvent({
    data,
    manifest,
    platformInfo: {
      hostname: 'crm.example.com',
    },
    platformName: 'acme',
    platform,
  });

  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-post-message-response',
        responseId: 'req-plugin-admin-settings',
        response: {
          data: 'ok',
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, './pages/pluginAdminSettingsPage');
  assert.equal(calls[0].args.data, data);
  assert.equal(calls[0].args.manifest, manifest);
  assert.equal(calls[0].args.platformName, 'acme');
  assert.equal(calls[0].args.platform, platform);
  assert.equal(calls[0].args.pluginId, 'plugin-alpha');
});

test('customized page input router dispatches admin plugins section by page and section', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calls = [];
  const router = await loadBundledModule('src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js', {
    stubs: createRouterStubs(calls),
  });

  const data = {
    requestId: 'req-admin-plugins',
    body: {
      page: {
        id: 'adminPage',
      },
      formData: {
        section: 'plugins',
      },
    },
  };

  await router.onEvent({
    data,
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(widgetMessages[0].message, {
    type: 'rc-post-message-response',
    responseId: 'req-admin-plugins',
    response: {
      data: 'ok',
    },
  });
  assert.deepEqual(calls.map((call) => call.name), ['./sections/installedPlugins']);
});

test('customized page input router dispatches managed plugins section to plugins admin config', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calls = [];
  const router = await loadBundledModule('src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js', {
    stubs: createRouterStubs(calls),
  });

  await router.onEvent({
    data: {
      requestId: 'req-managed-plugins',
      body: {
        page: {
          id: 'managedSettings',
        },
        formData: {
          section: 'plugins',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(calls.map((call) => call.name), ['./sections/pluginsAdminConfig']);
  assert.equal(widgetMessages[0].message.responseId, 'req-managed-plugins');
});

test('customized page input router maps appointment create and edit pages to the shared appointment page handler', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const calls = [];
  const router = await loadBundledModule('src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js', {
    stubs: createRouterStubs(calls),
  });

  await router.onEvent({
    data: {
      requestId: 'req-appointment-create',
      body: {
        page: {
          id: 'appointmentCreatePage',
        },
        formData: {},
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });
  await router.onEvent({
    data: {
      requestId: 'req-appointment-edit',
      body: {
        page: {
          id: 'appointmentEditPage',
        },
        formData: {},
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(calls.map((call) => call.name), ['./appointmentPage', './appointmentPage']);
  assert.deepEqual(widgetMessages.map(({ message }) => message.responseId), [
    'req-appointment-create',
    'req-appointment-edit',
  ]);
});
