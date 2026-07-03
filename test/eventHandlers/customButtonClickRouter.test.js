import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

const handlerModules = {
  customizedBanner: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.js',
  callLater: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLater.js',
  callLaterInMessage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInMessage.js',
  callLaterInContact: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInContact.js',
  scheduleSubmit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/scheduleSubmit.js',
  calldownActionCall: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionCall.js',
  calldownActionOpen: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionOpen.js',
  calldownActionText: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionText.js',
  calldownActionEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionEdit.js',
  calldownActionComplete: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionComplete.js',
  calldownActionRemove: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionRemove.js',
  saveTempNoteButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/saveTempNoteButton.js',
  editUserMappingPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.js',
  reinitializeUserMappingButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/reinitializeUserMappingButton.js',
  usermappingEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingEdit.js',
  usermappingRemove: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingRemove.js',
  hostnameInputPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.js',
  insightlyGetApiKey: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/insightlyGetApiKey.js',
  authPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/authPage.js',
  managedOAuthSetupPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.js',
  factoryResetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/factoryResetButton.js',
  selectPlatform: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.js',
  feedbackPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/feedbackPage.js',
  openAboutPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openAboutPage.js',
  openDeveloperSettingsPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openDeveloperSettingsPage.js',
  openImplementedInterfacesPageButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openImplementedInterfacesPageButton.js',
  documentation: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.js',
  reportIssueButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/reportIssueButton.js',
  getErrorLogRecordPageNextStepButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageNextStep.js',
  errorLogRecordPageStartButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageStart.js',
  logRecordSubmitButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.js',
  saveServerSideLoggingButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/saveServerSideLogging.js',
  doNotLogNumbersSubmitButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/doNotLogNumbersSubmit.js',
  generalSettings: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/adminSettingsFormSubmit.js',
  managedAuthOrgPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthOrgPage.js',
  managedAuthUserPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserPage.js',
  managedAuthUserEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserEdit.js',
  deleteManagedOAuthAccount: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/deleteManagedOAuthAccount.js',
  googleSheetsConfig: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/googleSheetsConfig.js',
  newSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.js',
  selectExistingSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/selectExistingSheetButton.js',
  removeSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/removeSheetButton.js',
  adminNewSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.js',
  adminSelectExistingSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminSelectExistingSheetButton.js',
  adminGoogleSheetSelected: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.js',
  userGoogleSheetSelected: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.js',
  adminRemoveSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminRemoveSheetButton.js',
  contactSearchAdapterButtonCallLog: '../../src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonCallLog.js',
  contactSearchAdapterButtonMessageLog: '../../src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonMessageLog.js',
  openInstalledPluginListPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/installedPluginListPage.js',
  selectPlugin: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.js',
  pluginConfigurePageSubmit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigurePageSubmit.js',
  pluginConfigButtons: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.js',
  pluginAdminConfigButtons: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.js',
  pluginDetailsSettingPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginDetailsSettingPage.js',
  pluginLicenseRefreshButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginLicenseRefreshButton.js',
  pluginMarketListPage: '../../src/eventHandlers/rc-post-message-request/pluginMarketListPage.js',
  appointmentRefreshList: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefreshList.js',
  appointmentRefresh: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefresh.js',
  appointmentConfirm: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentConfirm.js',
  appointmentCancel: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCancel.js',
  appointmentEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentEdit.js',
  appointmentSave: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentSave.js',
  appointmentOpenContact: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.js',
  appointmentOpenAppointment: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenAppointment.js',
  appointmentCreate: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreate.js',
  appointmentCreateSave: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreateSave.js',
};

async function loadRouter() {
  vi.resetModules();
  const handlers = {};
  for (const [name, modulePath] of Object.entries(handlerModules)) {
    vi.doMock(modulePath, () => {
      handlers[name] = {
        onEvent: vi.fn(async () => {}),
      };
      return {
        default: handlers[name],
      };
    });
  }

  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const authCore = {
    refreshLicenseStatus: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/auth.js', () => ({
    default: authCore,
  }));

  const userCore = {
    getShowAppointmentsTabSetting: vi.fn((settings) => ({
      value: settings?.showAppointmentsTab?.value ?? true,
    })),
  };
  vi.doMock('../../src/core/user.js', () => ({
    default: userCore,
  }));

  const platformService = {
    clearPlatformInfo: vi.fn(async () => {}),
  };
  vi.doMock('../../src/service/platformService.js', () => platformService);

  const router = await loadModule('../../src/eventHandlers/rc-post-message-request/custom-button-click/index.js');
  return {
    router,
    handlers,
    util,
    authCore,
    userCore,
    platformService,
  };
}

function eventFor(button, requestId = 'request-1') {
  return {
    requestId,
    body: {
      button: {
        type: 'button',
        formData: {},
        ...button,
      },
    },
  };
}

const baseContext = {
  manifest: {
    serverUrl: 'https://server.example',
  },
  platformInfo: {
    platformName: 'salesforce',
  },
  platformName: 'salesforce',
  platform: {
    useLicense: true,
    releaseNotesUrl: 'https://release.example',
    getSupportUrl: 'https://support.example',
    writeReviewUrl: 'https://review.example',
  },
};

describe('custom button click router', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('suppresses appointment actions when the appointments tab is disabled', async () => {
    seedStorage({
      userSettings: {
        showAppointmentsTab: { value: false },
      },
    });
    const { router, handlers, util } = await loadRouter();

    await router.onEvent({
      data: eventFor({
        type: 'customizedTabAction',
        tabId: 'appointmentsPage',
        id: 'appointmentsHeaderNew',
      }),
      ...baseContext,
    });

    expect(handlers.appointmentCreate.onEvent).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('routes appointment header, form-submit, and list actions', async () => {
    const { router, handlers, util } = await loadRouter();

    await router.onEvent({
      data: eventFor({
        type: 'customizedBanner',
        id: 'ignored',
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({
        type: 'customizedTabAction',
        tabId: 'appointmentsPage',
        id: 'appointmentsHeaderNew',
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({
        type: 'customizedTabAction',
        tabId: 'appointmentsPage',
        id: 'appointmentsHeaderRefresh',
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({ id: 'appointmentEditPage' }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({ id: 'appointmentCreatePage' }),
      ...baseContext,
    });

    for (const [id, name] of [
      ['appointmentCreateButton-item-1-action', 'appointmentCreate'],
      ['appointmentsRefreshButton-item-1-action', 'appointmentRefreshList'],
      ['appointmentRefresh-appt-1-action', 'appointmentRefresh'],
      ['appointmentConfirm-appt-1-action', 'appointmentConfirm'],
      ['appointmentCancel-appt-1-action', 'appointmentCancel'],
      ['appointmentEdit-appt-1-action', 'appointmentEdit'],
      ['appointmentOpenContact-appt-1-action', 'appointmentOpenContact'],
      ['appointmentSaveButton-appt-1-action', 'appointmentSave'],
      ['appointmentCreateSaveButton-appt-1-action', 'appointmentCreateSave'],
      ['appointmentOpenAppointment-appt-1-action', 'appointmentOpenAppointment'],
    ]) {
      await router.onEvent({
        data: eventFor({ id }),
        ...baseContext,
      });
      expect(handlers[name].onEvent).toHaveBeenCalled();
    }

    expect(handlers.customizedBanner.onEvent).toHaveBeenCalled();
    expect(handlers.appointmentCreate.onEvent).toHaveBeenCalledTimes(2);
    expect(handlers.appointmentRefreshList.onEvent).toHaveBeenCalledTimes(2);
    expect(handlers.appointmentSave.onEvent).toHaveBeenCalledTimes(2);
    expect(handlers.appointmentCreateSave.onEvent).toHaveBeenCalledTimes(2);
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('routes calldown, auth, navigation, error logging, admin, google sheets, contact search, plugin, and user mapping actions', async () => {
    const { router, handlers, authCore, platformService, util } = await loadRouter();

    const routes = [
      ['callLater-item-action', 'callLater'],
      ['callLaterInMessage-item-action', 'callLaterInMessage'],
      ['callLaterInContact-item-action', 'callLaterInContact'],
      ['scheduleSubmit-item-action', 'scheduleSubmit'],
      ['calldownActionCall-row-1-action', 'calldownActionCall'],
      ['calldownActionOpen-row-1-action', 'calldownActionOpen'],
      ['calldownActionText-row-1-action', 'calldownActionText'],
      ['calldownActionEdit-row-1-action', 'calldownActionEdit'],
      ['calldownActionComplete-row-1-action', 'calldownActionComplete'],
      ['calldownActionRemove-row-1-action', 'calldownActionRemove'],
      ['editUserMappingPage-row-1-action', 'editUserMappingPage'],
      ['hostnameInputPage-row-1-action', 'hostnameInputPage'],
      ['insightlyGetApiKey-row-1-action', 'insightlyGetApiKey'],
      ['authPage-row-1-action', 'authPage'],
      ['managedOAuthSetupPage-row-1-action', 'managedOAuthSetupPage'],
      ['feedbackPage-row-1-action', 'feedbackPage'],
      ['openInstalledPluginListPage-row-1-action', 'openInstalledPluginListPage'],
      ['openAboutPage-row-1-action', 'openAboutPage'],
      ['openDeveloperSettingsPage-row-1-action', 'openDeveloperSettingsPage'],
      ['reinitializeUserMappingButton-row-1-action', 'reinitializeUserMappingButton'],
      ['factoryResetButton-row-1-action', 'factoryResetButton'],
      ['reportIssueButton-row-1-action', 'reportIssueButton'],
      ['documentation-row-1-action', 'documentation'],
      ['saveServerSideLoggingButton-row-1-action', 'saveServerSideLoggingButton'],
      ['doNotLogNumbersSubmitButton-row-1-action', 'doNotLogNumbersSubmitButton'],
      ['openImplementedInterfacesPageButton-row-1-action', 'openImplementedInterfacesPageButton'],
      ['saveTempNoteButton-row-1-action', 'saveTempNoteButton'],
      ['googleSheetsConfig-row-1-action', 'googleSheetsConfig'],
      ['newSheetButton-row-1-action', 'newSheetButton'],
      ['selectExistingSheetButton-row-1-action', 'selectExistingSheetButton'],
      ['removeSheetButton-row-1-action', 'removeSheetButton'],
      ['adminNewSheetButton-row-1-action', 'adminNewSheetButton'],
      ['adminSelectExistingSheetButton-row-1-action', 'adminSelectExistingSheetButton'],
      ['adminGoogleSheetSelected-row-1-action', 'adminGoogleSheetSelected'],
      ['userGoogleSheetSelected-row-1-action', 'userGoogleSheetSelected'],
      ['adminRemoveSheetButton-row-1-action', 'adminRemoveSheetButton'],
      ['contactSearchAdapterButtonCallLog-row-1-action', 'contactSearchAdapterButtonCallLog'],
      ['contactSearchAdapterButtonMessageLog-row-1-action', 'contactSearchAdapterButtonMessageLog'],
      ['usermappingEdit-map-1-action', 'usermappingEdit'],
      ['usermappingRemove-map-1-action', 'usermappingRemove'],
      ['selectPlatform-p1=private-action', 'selectPlatform'],
      ['getErrorLogRecordPageNextStepButton-row-1-action', 'getErrorLogRecordPageNextStepButton'],
      ['errorLogRecordPageStartButton-row-1-action', 'errorLogRecordPageStartButton'],
      ['logRecordSubmitButton-row-1-action', 'logRecordSubmitButton'],
      ['selectPlugin-plugin-1-action', 'selectPlugin'],
      ['pluginLicenseRefreshButton-plugin-1-action', 'pluginLicenseRefreshButton'],
      ['managedAuthOrgPage-row-1-action', 'managedAuthOrgPage'],
      ['managedAuthUserEdit-row-1-action', 'managedAuthUserEdit'],
      ['deleteManagedOAuthAccount-row-1-action', 'deleteManagedOAuthAccount'],
      ['managedAuthUserPage-row-1-action', 'managedAuthUserPage'],
      ['managedAuthUserEditPage-row-1-action', 'managedAuthUserPage'],
    ];

    for (const [id, handlerName] of routes) {
      await router.onEvent({
        data: eventFor({ id }),
        ...baseContext,
      });
      expect(handlers[handlerName].onEvent).toHaveBeenCalled();
    }

    for (const id of [
      'callAndSMSLoggingSettingPage-row-1-action',
      'contactSettingPage-row-1-action',
      'callLogDetailsSettingPage-row-1-action',
      'autoLogPreferenceSettingPage-row-1-action',
      'advancedFeaturesSettingPage-row-1-action',
      'customSettingsPage-row-1-action',
      'customizeTabsSettingPage-row-1-action',
      'clickToDialMatcherSettingPage-row-1-action',
      'widgetSettingsPage-row-1-action',
      'notificationLevelSettingPage-row-1-action',
      'phoneNumberFormatPage-row-1-action',
      'clickToDialEmbedPage-row-1-action',
    ]) {
      await router.onEvent({
        data: eventFor({ id }),
        ...baseContext,
      });
    }
    expect(handlers.generalSettings.onEvent).toHaveBeenCalledTimes(12);

    await router.onEvent({
      data: eventFor({
        id: 'refreshLicense-row-1-action',
      }),
      ...baseContext,
    });
    expect(authCore.refreshLicenseStatus).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });

    await router.onEvent({
      data: eventFor({
        id: 'clearPlatformInfoButton-row-1-action',
      }),
      ...baseContext,
    });
    expect(platformService.clearPlatformInfo).toHaveBeenCalled();
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      level: 'success',
    }));
  });

  it('handles local browser actions, submit-only plugin routes, and plugin custom buttons', async () => {
    const { router, handlers } = await loadRouter();

    await router.onEvent({
      data: eventFor({ id: 'openSupportPage-row-1-action' }),
      ...baseContext,
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'openPopupWindow',
      navigationPath: '/support',
    });

    for (const [id, expectedUrl] of [
      ['openCommunityPageButton-row-1-action', 'https://community.ringcentral.com/groups/app-connect-22'],
      ['releaseNotes-row-1-action', 'https://release.example'],
      ['getSupport-row-1-action', 'https://support.example'],
      ['writeReview-row-1-action', 'https://review.example'],
    ]) {
      await router.onEvent({
        data: eventFor({ id }),
        ...baseContext,
      });
      if (id.startsWith('openCommunity')) {
        expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank');
      } else {
        expect(window.open).toHaveBeenCalledWith(expectedUrl);
      }
    }

    await router.onEvent({
      data: eventFor({
        id: 'sheetInfoButton-row-1-action',
        formData: { sheetUrl: 'https://sheet.example' },
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({
        id: 'adminSheetInfoButton-row-1-action',
        formData: { sheetUrl: 'https://admin-sheet.example' },
      }),
      ...baseContext,
    });
    expect(window.open).toHaveBeenCalledWith('https://sheet.example', '_blank');
    expect(window.open).toHaveBeenCalledWith('https://admin-sheet.example', '_blank');

    await router.onEvent({
      data: eventFor({
        id: 'link-button-Open docs',
        formData: { 'link-button-Open docs': 'https://docs.example' },
      }),
      ...baseContext,
    });
    expect(window.open).toHaveBeenCalledWith('https://docs.example', '_blank');

    await router.onEvent({
      data: eventFor({
        id: 'pluginConfigurePage',
        type: 'submit',
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({
        id: 'installedPluginListPage',
        type: 'submit',
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({
        id: 'pluginDetailsSettingPage',
        type: 'submit',
      }),
      ...baseContext,
    });
    expect(handlers.pluginConfigurePageSubmit.onEvent).toHaveBeenCalled();
    expect(handlers.pluginMarketListPage.onEvent).toHaveBeenCalled();
    expect(handlers.pluginDetailsSettingPage.onEvent).toHaveBeenCalled();

    await router.onEvent({
      data: eventFor({
        id: 'customPluginButton-plugin-1-action',
        formData: {
          pluginId: 'plugin-1',
          isFromAdmin: false,
        },
      }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({
        id: 'customPluginButton-plugin-1-action',
        formData: {
          pluginId: 'plugin-1',
          isFromAdmin: true,
        },
      }),
      ...baseContext,
    });
    expect(handlers.pluginConfigButtons.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      buttonId: 'customPluginButton',
    }));
    expect(handlers.pluginAdminConfigButtons.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      buttonId: 'customPluginButton',
    }));
  });
});
