import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

const handlerModules = {
  c2dSchedulePage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/c2dSchedulePage.js',
  editUserMappingPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/editUserMappingPage.js',
  userMappingPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/userMappingPage.js',
  hostnameInputPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/hostnameInputPage.js',
  platformSelectionPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/platformSelectionPage.js',
  getMultiContactPopPromptPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getMultiContactPopPromptPage.js',
  calldownPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.js',
  googleSheetsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/googleSheetsPage.js',
  contactSearchResultCallLog: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultCallLog.js',
  contactSearchResultMessageLog: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultMessageLog.js',
  reportPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.js',
  unloggedCallPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/unloggedCallPage.js',
  developerSettingsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/developerSettingsPage.js',
  errorLogRecordPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getErrorLogRecordPage.js',
  logRecordSubmissionPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/logRecordSubmissionPage.js',
  adminGoogleSheetsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/adminGoogleSheetsPage.js',
  pluginAdminSettingsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/pluginAdminSettingsPage.js',
  managedAuthUserPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserPage.js',
  managedAuthUserEditPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserEditPage.js',
  selectPlugin: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.js',
  appointmentsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.js',
  appointmentPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.js',
  generalSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/generalSettings.js',
  managedSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedSettings.js',
  appearance: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/appearance.js',
  clickToDialMatcher: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialMatcher.js',
  customizeTabs: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customizeTabs.js',
  widgetSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/widgetSettings.js',
  notificationLevel: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/notificationLevel.js',
  phoneNumberFormat: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/phoneNumberFormat.js',
  clickToDialEmbed: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialEmbed.js',
  callAndSMSLogging: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callAndSMSLogging.js',
  serverSideLoggingSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/serverSideLoggingSetting.js',
  contactSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/contactSetting.js',
  advancedFeaturesSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/advancedFeaturesSetting.js',
  customSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customSettings.js',
  callLogDetailsSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.js',
  autoLogPreferences: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/autoLogPreferences.js',
  userMapping: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/userMapping.js',
  googleSheetsAdminConfig: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/googleSheetsAdminConfig.js',
  pluginsAdminConfig: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/pluginsAdminConfig.js',
  installedPlugins: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/installedPlugins.js',
  managedAuthentication: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthentication.js',
  managedOAuth: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedOAuth.js',
  managedAuthOrg: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthOrg.js',
  managedAuthUser: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthUser.js',
  pluginMarketListPage: '../../src/eventHandlers/rc-post-message-request/pluginMarketListPage.js',
};

async function loadRouter() {
  vi.resetModules();
  const handlers = {};
  for (const [name, modulePath] of Object.entries(handlerModules)) {
    vi.doMock(modulePath, () => {
      handlers[name] = {
        onEvent: vi.fn(async () => {}),
      };
      return { default: handlers[name] };
    });
  }
  const router = await loadModule('../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js');
  return { router, handlers };
}

function eventFor({ pageId, section, requestId = 'request-1' }) {
  return {
    requestId,
    body: {
      page: {
        id: pageId,
      },
      formData: {
        section,
      },
    },
  };
}

const context = {
  manifest: { serverUrl: 'https://server.example' },
  platformInfo: { platformName: 'salesforce' },
  platformName: 'salesforce',
  platform: {},
};

describe('customized page input changed router', () => {
  it('responds immediately and routes page id changes', async () => {
    const { router, handlers } = await loadRouter();

    const pageRoutes = [
      ['c2dSchedulePage', 'c2dSchedulePage'],
      ['editUserMappingPage', 'editUserMappingPage'],
      ['userMappingPage', 'userMappingPage'],
      ['hostnameInputPage', 'hostnameInputPage'],
      ['platformSelectionPage', 'platformSelectionPage'],
      ['getMultiContactPopPromptPage', 'getMultiContactPopPromptPage'],
      ['calldownPage', 'calldownPage'],
      ['googleSheetsPage', 'googleSheetsPage'],
      ['contactSearchResultCallLog', 'contactSearchResultCallLog'],
      ['contactSearchResultMessageLog', 'contactSearchResultMessageLog'],
      ['reportPage', 'reportPage'],
      ['unloggedCallPage', 'unloggedCallPage'],
      ['developerSettingsPage', 'developerSettingsPage'],
      ['errorLogRecordPage', 'errorLogRecordPage'],
      ['logRecordSubmissionPage', 'logRecordSubmissionPage'],
      ['adminGoogleSheetsPage', 'adminGoogleSheetsPage'],
      ['managedAuthUserPage', 'managedAuthUserPage'],
      ['managedAuthUserEditPage', 'managedAuthUserEditPage'],
      ['installedPluginListPage', 'selectPlugin'],
      ['appointmentsPage', 'appointmentsPage'],
      ['appointmentCreatePage', 'appointmentPage'],
      ['appointmentEditPage', 'appointmentPage'],
    ];

    for (const [pageId, handlerName] of pageRoutes) {
      await router.onEvent({
        data: eventFor({ pageId }),
        ...context,
      });
      expect(handlers[handlerName].onEvent).toHaveBeenCalled();
    }

    await router.onEvent({
      data: eventFor({ pageId: 'pluginAdminSettingsPage', section: 'plugin-1' }),
      ...context,
    });
    expect(handlers.pluginAdminSettingsPage.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin-1',
    }));

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-post-message-response',
        responseId: 'request-1',
        response: { data: 'ok' },
      },
      targetOrigin: '*',
    });
  });

  it('routes section changes including nested plugin cases', async () => {
    const { router, handlers } = await loadRouter();

    for (const [section, handlerName] of [
      ['generalSettings', 'generalSettings'],
      ['managedSettings', 'managedSettings'],
      ['managedAuthentication', 'managedAuthentication'],
      ['managedOAuth', 'managedOAuth'],
      ['managedAuthOrg', 'managedAuthOrg'],
      ['managedAuthUser', 'managedAuthUser'],
      ['pluginMarket', 'pluginMarketListPage'],
      ['appearance', 'appearance'],
      ['clickToDialMatcher', 'clickToDialMatcher'],
      ['customizeTabs', 'customizeTabs'],
      ['widgetSettings', 'widgetSettings'],
      ['notificationLevel', 'notificationLevel'],
      ['phoneNumberFormat', 'phoneNumberFormat'],
      ['clickToDialEmbed', 'clickToDialEmbed'],
      ['callAndSMSLogging', 'callAndSMSLogging'],
      ['serverSideLoggingSetting', 'serverSideLoggingSetting'],
      ['contactSetting', 'contactSetting'],
      ['advancedFeaturesSetting', 'advancedFeaturesSetting'],
      ['customSettings', 'customSettings'],
      ['callLogDetailsSetting', 'callLogDetailsSetting'],
      ['autoLogPreferences', 'autoLogPreferences'],
      ['userMapping', 'userMapping'],
      ['googleSheetsAdminConfig', 'googleSheetsAdminConfig'],
    ]) {
      await router.onEvent({
        data: eventFor({ pageId: 'anyPage', section }),
        ...context,
      });
      expect(handlers[handlerName].onEvent).toHaveBeenCalled();
    }

    await router.onEvent({
      data: eventFor({ pageId: 'adminPage', section: 'plugins' }),
      ...context,
    });
    await router.onEvent({
      data: eventFor({ pageId: 'managedSettings', section: 'plugins' }),
      ...context,
    });
    await router.onEvent({
      data: eventFor({ pageId: 'unknownPage', section: 'unknownSection' }),
      ...context,
    });

    expect(handlers.installedPlugins.onEvent).toHaveBeenCalled();
    expect(handlers.pluginsAdminConfig.onEvent).toHaveBeenCalled();
  });
});
