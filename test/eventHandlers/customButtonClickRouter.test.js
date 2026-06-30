const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function createHandlerStub(calls, name) {
  return {
    async onEvent(args) {
      calls.push({ name, args });
    },
  };
}

function createRouterStubs({
  handlerCalls,
  responses,
  notifications,
  clearPlatformCalls,
  refreshLicenseCalls,
  appointmentsEnabled = true,
}) {
  const stubs = {
    '../../../lib/util': {
      showNotification(notification) {
        notifications.push(notification);
      },
      responseMessage(requestId, payload) {
        responses.push({ requestId, payload });
      },
    },
    '../../../core/auth': {
      async refreshLicenseStatus(args) {
        refreshLicenseCalls.push(args);
      },
    },
    '../../../core/user': {
      getShowAppointmentsTabSetting() {
        return {
          value: appointmentsEnabled,
        };
      },
    },
    '../../../service/platformService': {
      async clearPlatformInfo() {
        clearPlatformCalls.push({});
      },
    },
  };

  const handlerPaths = [
    './navigation/customizedBanner',
    './calldown/callLater',
    './calldown/callLaterInMessage',
    './calldown/callLaterInContact',
    './calldown/scheduleSubmit',
    './calldown/calldownActionCall',
    './calldown/calldownActionOpen',
    './calldown/calldownActionText',
    './calldown/calldownActionEdit',
    './calldown/calldownActionComplete',
    './calldown/calldownActionRemove',
    './calldown/saveTempNoteButton',
    './userMapping/editUserMappingPage',
    './userMapping/reinitializeUserMappingButton',
    './userMapping/usermappingEdit',
    './userMapping/usermappingRemove',
    './auth/hostnameInputPage',
    './auth/insightlyGetApiKey',
    './auth/authPage',
    './auth/managedOAuthSetupPage',
    './auth/factoryResetButton',
    './auth/selectPlatform',
    './navigation/feedbackPage',
    './navigation/openAboutPage',
    './navigation/openDeveloperSettingsPage',
    './navigation/openImplementedInterfacesPageButton',
    './navigation/documentation',
    './errorLogging/reportIssueButton',
    './errorLogging/errorLogRecordPageNextStep',
    './errorLogging/errorLogRecordPageStart',
    './errorLogging/logRecordSubmit',
    './adminSettings/saveServerSideLogging',
    './adminSettings/doNotLogNumbersSubmit',
    './adminSettings/adminSettingsFormSubmit',
    './adminSettings/managedAuthOrgPage',
    './adminSettings/managedAuthUserPage',
    './adminSettings/managedAuthUserEdit',
    './adminSettings/deleteManagedOAuthAccount',
    './googleSheets/googleSheetsConfig',
    './googleSheets/newSheetButton',
    './googleSheets/selectExistingSheetButton',
    './googleSheets/removeSheetButton',
    './googleSheets/adminNewSheetButton',
    './googleSheets/adminSelectExistingSheetButton',
    './googleSheets/adminGoogleSheetSelected',
    './googleSheets/userGoogleSheetSelected',
    './googleSheets/adminRemoveSheetButton',
    './contactSearch/contactSearchAdapterButtonCallLog',
    './contactSearch/contactSearchAdapterButtonMessageLog',
    './plugins/installedPluginListPage',
    './plugins/selectPlugin',
    './plugins/pluginConfigurePageSubmit',
    './plugins/pluginConfigButtons',
    './plugins/pluginAdminConfigButtons',
    './plugins/pluginDetailsSettingPage',
    './plugins/pluginLicenseRefreshButton',
    '../pluginMarketListPage',
    './appointmentRefreshList',
    './appointmentRefresh',
    './appointmentConfirm',
    './appointmentCancel',
    './appointmentEdit',
    './appointmentSave',
    './appointmentOpenContact',
    './appointmentOpenAppointment',
    './appointmentCreate',
    './appointmentCreateSave',
  ];

  for (const handlerPath of handlerPaths) {
    stubs[handlerPath] = createHandlerStub(handlerCalls, handlerPath);
  }
  return stubs;
}

async function loadRouter(options = {}) {
  const handlerCalls = [];
  const responses = [];
  const notifications = [];
  const clearPlatformCalls = [];
  const refreshLicenseCalls = [];
  const router = await loadBundledModule('src/eventHandlers/rc-post-message-request/custom-button-click/index.js', {
    stubs: createRouterStubs({
      handlerCalls,
      responses,
      notifications,
      clearPlatformCalls,
      refreshLicenseCalls,
      ...options,
    }),
  });
  return {
    router,
    handlerCalls,
    responses,
    notifications,
    clearPlatformCalls,
    refreshLicenseCalls,
  };
}

test('custom button router blocks appointment tab actions when appointments are hidden', async () => {
  const storage = createChromeStorage({
    userSettings: {
      showAppointmentsTab: false,
    },
  });
  global.chrome = storage.chrome;

  const { router, handlerCalls, responses } = await loadRouter({
    appointmentsEnabled: false,
  });

  await router.onEvent({
    data: {
      requestId: 'req-appointments-disabled',
      body: {
        button: {
          type: 'customizedTabAction',
          tabId: 'appointmentsPage',
          id: 'appointmentsHeaderNew',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(handlerCalls, []);
  assert.deepEqual(responses, [
    {
      requestId: 'req-appointments-disabled',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('custom button router opens support through the service worker and responds to the widget', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  const runtimeMessages = [];
  global.chrome = {
    ...storage.chrome,
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  };

  const { router, responses } = await loadRouter();

  await router.onEvent({
    data: {
      requestId: 'req-support',
      body: {
        button: {
          type: 'button',
          id: 'openSupportPage',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(runtimeMessages, [
    {
      type: 'openPopupWindow',
      navigationPath: '/support',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-support',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('custom button router clears platform info and notifies the user', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const { router, clearPlatformCalls, notifications, responses } = await loadRouter();

  await router.onEvent({
    data: {
      requestId: 'req-clear-platform',
      body: {
        button: {
          type: 'button',
          id: 'clearPlatformInfoButton',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(clearPlatformCalls, [{}]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Platform info cleared. Please close the extension and open from CRM page.',
      ttl: 5000,
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-clear-platform',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('custom button router refreshes license status only for license-enabled platforms', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const { router, refreshLicenseCalls, responses } = await loadRouter();

  await router.onEvent({
    data: {
      requestId: 'req-refresh-license',
      body: {
        button: {
          type: 'button',
          id: 'refreshLicense',
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {
      useLicense: true,
    },
  });

  assert.deepEqual(refreshLicenseCalls, [
    {
      serverUrl: 'https://server.example.com',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-refresh-license',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('custom button router opens dynamic link buttons and sheet info links in a new tab', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const openedWindows = [];
  global.window = {
    open(url, target) {
      openedWindows.push({ url, target });
    },
  };

  const { router, responses } = await loadRouter();

  await router.onEvent({
    data: {
      requestId: 'req-link-button',
      body: {
        button: {
          type: 'button',
          id: 'link-button-doc',
          formData: {
            'link-button-doc': 'https://docs.example.com/acme',
          },
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });
  await router.onEvent({
    data: {
      requestId: 'req-sheet-info',
      body: {
        button: {
          type: 'button',
          id: 'sheetInfoButton',
          formData: {
            sheetUrl: 'https://sheets.example.com/sheet-1',
          },
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
      url: 'https://docs.example.com/acme',
      target: '_blank',
    },
    {
      url: 'https://sheets.example.com/sheet-1',
      target: '_blank',
    },
  ]);
  assert.deepEqual(responses.map(({ requestId }) => requestId), ['req-link-button', 'req-sheet-info']);
});

test('custom button router opens community and platform help links', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  const openedWindows = [];
  global.window = {
    open(url, target) {
      openedWindows.push({ url, target });
    },
  };

  const { router, responses } = await loadRouter();

  const requests = [
    {
      requestId: 'req-community',
      buttonId: 'openCommunityPageButton',
      platform: {},
    },
    {
      requestId: 'req-release-notes',
      buttonId: 'releaseNotes',
      platform: {
        releaseNotesUrl: 'https://release.example.com/acme',
      },
    },
    {
      requestId: 'req-get-support',
      buttonId: 'getSupport',
      platform: {
        getSupportUrl: 'https://support.example.com/acme',
      },
    },
    {
      requestId: 'req-write-review',
      buttonId: 'writeReview',
      platform: {
        writeReviewUrl: 'https://reviews.example.com/acme',
      },
    },
  ];

  for (const request of requests) {
    await router.onEvent({
      data: {
        requestId: request.requestId,
        body: {
          button: {
            type: 'button',
            id: request.buttonId,
          },
        },
      },
      manifest: {},
      platformInfo: {},
      platformName: 'acme',
      platform: request.platform,
    });
  }

  assert.deepEqual(openedWindows, [
    {
      url: 'https://community.ringcentral.com/groups/app-connect-22',
      target: '_blank',
    },
    {
      url: 'https://release.example.com/acme',
      target: undefined,
    },
    {
      url: 'https://support.example.com/acme',
      target: undefined,
    },
    {
      url: 'https://reviews.example.com/acme',
      target: undefined,
    },
  ]);
  assert.deepEqual(
    responses.map(({ requestId, payload }) => ({ requestId, payload })),
    requests.map(({ requestId }) => ({
      requestId,
      payload: {
        data: 'ok',
      },
    })),
  );
});

test('custom button router skips optional platform help links when URLs are missing', async () => {
  const storage = createChromeStorage({
    userSettings: {},
  });
  global.chrome = storage.chrome;

  let openCount = 0;
  global.window = {
    open() {
      openCount += 1;
    },
  };

  const { router, responses } = await loadRouter();

  for (const buttonId of ['releaseNotes', 'getSupport', 'writeReview']) {
    await router.onEvent({
      data: {
        requestId: `req-${buttonId}`,
        body: {
          button: {
            type: 'button',
            id: buttonId,
          },
        },
      },
      manifest: {},
      platformInfo: {},
      platformName: 'acme',
      platform: {},
    });
  }

  assert.equal(openCount, 0);
  assert.deepEqual(
    responses.map(({ requestId, payload }) => ({ requestId, payload })),
    ['releaseNotes', 'getSupport', 'writeReview'].map((buttonId) => ({
      requestId: `req-${buttonId}`,
      payload: {
        data: 'ok',
      },
    })),
  );
});
