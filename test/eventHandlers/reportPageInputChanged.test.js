const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
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

test('report page ignores invalid admin RingCentral extension selection before fetching stats', async () => {
  const storage = createChromeStorage({
    isAdmin: true,
    userSettings: {
      showUserReportTab: true,
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const rcExtensionCalls = [];

  const reportPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          getRcAccessToken() {
            return 'rc-access-token';
          },
          async getRcInfo() {
            throw new Error('invalid admin extension selection should stop before report fetch');
          },
        },
        '../../../../../lib/rcAPI': {
          RcAPI: class RcAPI {
            async getRcExtensionList(args) {
              rcExtensionCalls.push(args);
              return [
                {
                  id: 'rc-ext-valid',
                  type: 'User',
                },
              ];
            }
          },
        },
        '../../../../../core/contact': {},
        '../../../../../components/logPage': {},
        '../../../../../core/user': {
          getShowUserReportTabSetting() {
            return {
              value: true,
            };
          },
          async getUserReportStats() {
            throw new Error('invalid admin extension selection should not fetch user report stats');
          },
        },
        '../../../../../core/admin': {
          async getUserExtensionReportStats() {
            throw new Error('invalid admin extension selection should not fetch admin user stats');
          },
          async getAdminReportStats() {
            throw new Error('invalid admin extension selection should not fetch company stats');
          },
        },
        '../../../../../components/reportPage/reportPage': {
          getReportsPageRender() {
            throw new Error('invalid admin extension selection should not render reports page');
          },
        },
      },
    }
  );

  await reportPage.onEvent({
    data: {
      body: {
        keys: ['rcExtensionList'],
        formData: {
          tab: 'userReportTab',
          rcExtensionList: 'rc-ext-invalid',
          dateRangeEnums: 'Last 24 hours',
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(rcExtensionCalls, [
    {
      rcAccessToken: 'rc-access-token',
    },
  ]);
  assert.deepEqual(windowMessages, []);
  assert.deepEqual(widgetMessages, []);
});

test('report page refreshes the current user report and renders the report tab', async () => {
  const storage = createChromeStorage({
    isAdmin: false,
    userSettings: {
      showUserReportTab: true,
      timezone: 'UTC',
    },
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const userReportCalls = [];
  const renderCalls = [];

  const reportPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.js',
    {
      stubs: {
        '../../../../../lib/util': {
          getRcAccessToken() {
            throw new Error('non-admin user report should not list admin extensions');
          },
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    regionalSettings: {
                      timezone: {
                        name: 'UTC',
                      },
                    },
                  },
                },
              },
            };
          },
        },
        '../../../../../lib/rcAPI': {
          RcAPI: class RcAPI {},
        },
        '../../../../../core/contact': {},
        '../../../../../components/logPage': {},
        '../../../../../core/user': {
          getShowUserReportTabSetting(userSettings) {
            assert.equal(userSettings.showUserReportTab, true);
            return {
              value: true,
            };
          },
          async getUserReportStats(args) {
            userReportCalls.push(args);
            return {
              totalCalls: 3,
            };
          },
        },
        '../../../../../core/admin': {
          async getUserExtensionReportStats() {
            throw new Error('current user report should not fetch another extension stats');
          },
          async getAdminReportStats() {
            throw new Error('user report tab should not fetch company stats');
          },
        },
        '../../../../../components/reportPage/reportPage': {
          getReportsPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'reportPage',
              selectedTab: args.selectedTab,
              totalCalls: args.userStats.totalCalls,
            };
          },
        },
      },
    }
  );

  await reportPage.onEvent({
    data: {
      body: {
        keys: ['dateRangeEnums'],
        formData: {
          tab: 'userReportTab',
          rcExtensionList: 'me',
          dateRangeEnums: 'Last 24 hours',
          startDate: '2026-06-01',
          endDate: '2026-06-02',
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.equal(userReportCalls.length, 1);
  assert.equal(userReportCalls[0].dateRange, 'Last 24 hours');
  assert.match(userReportCalls[0].customStartDate, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(userReportCalls[0].customEndDate, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(renderCalls, [
    {
      selectedTab: 'userReportTab',
      selectedRcExtension: 'me',
      isAdmin: false,
      userStats: {
        totalCalls: 3,
        dateRange: 'Last 24 hours',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
      companyStats: undefined,
      selectedGroupKey: undefined,
      groupKeys: undefined,
      selectedItemKey: undefined,
      itemKeys: undefined,
      userSettings: {
        showUserReportTab: true,
        timezone: 'UTC',
      },
      rcExtensions: undefined,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'reportPage',
          selectedTab: 'userReportTab',
          totalCalls: 3,
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customizedTabs/reportPage',
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
