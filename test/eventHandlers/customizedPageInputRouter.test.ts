import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

const handlerModules = {
  c2dSchedulePage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/c2dSchedulePage.ts',
  editUserMappingPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/editUserMappingPage.ts',
  userMappingPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/userMappingPage.ts',
  hostnameInputPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/hostnameInputPage.ts',
  platformSelectionPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/platformSelectionPage.ts',
  getMultiContactPopPromptPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getMultiContactPopPromptPage.ts',
  calldownPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.ts',
  googleSheetsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/googleSheetsPage.ts',
  contactSearchResultCallLog: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultCallLog.ts',
  contactSearchResultMessageLog: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultMessageLog.ts',
  reportPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
  unloggedCallPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/unloggedCallPage.ts',
  developerSettingsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/developerSettingsPage.ts',
  errorLogRecordPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getErrorLogRecordPage.ts',
  logRecordSubmissionPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/logRecordSubmissionPage.ts',
  adminGoogleSheetsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/adminGoogleSheetsPage.ts',
  pluginAdminSettingsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/pluginAdminSettingsPage.ts',
  managedAuthUserPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserPage.ts',
  managedAuthUserEditPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/managedAuthUserEditPage.ts',
  selectPlugin: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.ts',
  appointmentsPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.ts',
  appointmentPage: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
  generalSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/generalSettings.ts',
  managedSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedSettings.ts',
  appearance: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/appearance.ts',
  clickToDialMatcher: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialMatcher.ts',
  customizeTabs: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customizeTabs.ts',
  widgetSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/widgetSettings.ts',
  notificationLevel: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/notificationLevel.ts',
  language: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/language.ts',
  phoneNumberFormat: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/phoneNumberFormat.ts',
  clickToDialEmbed: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/clickToDialEmbed.ts',
  callAndSMSLogging: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callAndSMSLogging.ts',
  serverSideLoggingSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/serverSideLoggingSetting.ts',
  contactSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/contactSetting.ts',
  advancedFeaturesSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/advancedFeaturesSetting.ts',
  customSettings: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/customSettings.ts',
  callLogDetailsSetting: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/callLogDetailsSetting.ts',
  autoLogPreferences: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/autoLogPreferences.ts',
  userMapping: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/userMapping.ts',
  googleSheetsAdminConfig: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/googleSheetsAdminConfig.ts',
  pluginsAdminConfig: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/pluginsAdminConfig.ts',
  installedPlugins: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/installedPlugins.ts',
  managedAuthentication: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthentication.ts',
  managedOAuth: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedOAuth.ts',
  managedAuthOrg: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthOrg.ts',
  managedAuthUser: '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/sections/managedAuthUser.ts',
  pluginMarketListPage: '../../src/eventHandlers/rc-post-message-request/pluginMarketListPage.ts',
};

async function loadRouter() {
  vi.resetModules();
  const handlers: Record<string, any> = {};
  for (const [name, modulePath] of Object.entries(handlerModules)) {
    vi.doMock(modulePath, () => {
      handlers[name] = {
        onEvent: vi.fn(async () => {}),
      };
      return { default: handlers[name] };
    });
  }
  const router = await loadModule('../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.ts');
  return { router, handlers };
}

function eventFor({
  pageId,
  section,
  requestId = 'request-1',
}: {
  pageId: string;
  section?: string;
  requestId?: string;
}) {
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
      ['language', 'language'],
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
