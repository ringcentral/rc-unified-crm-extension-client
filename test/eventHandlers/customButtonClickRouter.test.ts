import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

const handlerModules = {
  customizedBanner: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.ts',
  callLater: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLater.ts',
  callLaterInMessage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInMessage.ts',
  callLaterInContact: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInContact.ts',
  scheduleSubmit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/scheduleSubmit.ts',
  calldownActionCall: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionCall.ts',
  calldownActionOpen: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionOpen.ts',
  calldownActionText: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionText.ts',
  calldownActionEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionEdit.ts',
  calldownActionComplete: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionComplete.ts',
  calldownActionRemove: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionRemove.ts',
  saveTempNoteButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/saveTempNoteButton.ts',
  editUserMappingPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/editUserMappingPage.ts',
  reinitializeUserMappingButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/reinitializeUserMappingButton.ts',
  usermappingEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingEdit.ts',
  usermappingRemove: '../../src/eventHandlers/rc-post-message-request/custom-button-click/userMapping/usermappingRemove.ts',
  hostnameInputPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/hostnameInputPage.ts',
  insightlyGetApiKey: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/insightlyGetApiKey.ts',
  authPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/authPage.ts',
  managedOAuthSetupPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/managedOAuthSetupPage.ts',
  factoryResetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/factoryResetButton.ts',
  selectPlatform: '../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/selectPlatform.ts',
  feedbackPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/feedbackPage.ts',
  openAboutPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openAboutPage.ts',
  openDeveloperSettingsPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openDeveloperSettingsPage.ts',
  openImplementedInterfacesPageButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openImplementedInterfacesPageButton.ts',
  documentation: '../../src/eventHandlers/rc-post-message-request/custom-button-click/navigation/documentation.ts',
  reportIssueButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/reportIssueButton.ts',
  getErrorLogRecordPageNextStepButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageNextStep.ts',
  errorLogRecordPageStartButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageStart.ts',
  logRecordSubmitButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.ts',
  saveServerSideLoggingButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/saveServerSideLogging.ts',
  doNotLogNumbersSubmitButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/doNotLogNumbersSubmit.ts',
  generalSettings: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/adminSettingsFormSubmit.ts',
  managedAuthOrgPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthOrgPage.ts',
  managedAuthUserPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserPage.ts',
  managedAuthUserEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthUserEdit.ts',
  deleteManagedOAuthAccount: '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/deleteManagedOAuthAccount.ts',
  googleSheetsConfig: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/googleSheetsConfig.ts',
  newSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/newSheetButton.ts',
  selectExistingSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/selectExistingSheetButton.ts',
  removeSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/removeSheetButton.ts',
  adminNewSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminNewSheetButton.ts',
  adminSelectExistingSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminSelectExistingSheetButton.ts',
  adminGoogleSheetSelected: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminGoogleSheetSelected.ts',
  userGoogleSheetSelected: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/userGoogleSheetSelected.ts',
  adminRemoveSheetButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/googleSheets/adminRemoveSheetButton.ts',
  contactSearchAdapterButtonCallLog: '../../src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonCallLog.ts',
  contactSearchAdapterButtonMessageLog: '../../src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonMessageLog.ts',
  openInstalledPluginListPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/installedPluginListPage.ts',
  selectPlugin: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/selectPlugin.ts',
  pluginConfigurePageSubmit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigurePageSubmit.ts',
  pluginConfigButtons: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginConfigButtons.ts',
  pluginAdminConfigButtons: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginAdminConfigButtons.ts',
  pluginDetailsSettingPage: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginDetailsSettingPage.ts',
  pluginLicenseRefreshButton: '../../src/eventHandlers/rc-post-message-request/custom-button-click/plugins/pluginLicenseRefreshButton.ts',
  pluginMarketListPage: '../../src/eventHandlers/rc-post-message-request/pluginMarketListPage.ts',
  appointmentRefreshList: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefreshList.ts',
  appointmentRefresh: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefresh.ts',
  appointmentConfirm: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentConfirm.ts',
  appointmentCancel: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCancel.ts',
  appointmentEdit: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentEdit.ts',
  appointmentSave: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentSave.ts',
  appointmentOpenContact: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.ts',
  appointmentOpenAppointment: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenAppointment.ts',
  appointmentCreate: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreate.ts',
  appointmentCreateSave: '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreateSave.ts',
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
  vi.doMock('../../src/lib/util.ts', () => util);

  const authCore = {
    refreshLicenseStatus: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/auth.ts', () => ({
    default: authCore,
  }));

  const userCore = {
    getShowAppointmentsTabSetting: vi.fn((settings) => ({
      value: settings?.showAppointmentsTab?.value ?? true,
    })),
  };
  vi.doMock('../../src/core/user.ts', () => ({
    default: userCore,
  }));

  const platformService = {
    clearPlatformInfo: vi.fn(async () => {}),
  };
  vi.doMock('../../src/service/platformService.ts', () => platformService);

  const router = await loadModule('../../src/eventHandlers/rc-post-message-request/custom-button-click/index.ts');
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

async function expectActionRoutesTo(router, handlers, routes) {
  for (const [id, handlerName] of routes) {
    await router.onEvent({
      data: eventFor({ id }),
      ...baseContext,
    });
    expect(handlers[handlerName].onEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: eventFor({ id }),
      ...baseContext,
    }));
  }
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

  it('routes appointment header actions', async () => {
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

    expect(handlers.customizedBanner.onEvent).toHaveBeenCalled();
    expect(handlers.appointmentCreate.onEvent).toHaveBeenCalledTimes(1);
    expect(handlers.appointmentRefreshList.onEvent).toHaveBeenCalledTimes(1);
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('routes appointment form-submit pages', async () => {
    const { router, handlers } = await loadRouter();

    await router.onEvent({
      data: eventFor({ id: 'appointmentEditPage' }),
      ...baseContext,
    });
    await router.onEvent({
      data: eventFor({ id: 'appointmentCreatePage' }),
      ...baseContext,
    });

    expect(handlers.appointmentSave.onEvent).toHaveBeenCalledTimes(1);
    expect(handlers.appointmentCreateSave.onEvent).toHaveBeenCalledTimes(1);
  });

  it('routes appointment row and list actions', async () => {
    const { router, handlers } = await loadRouter();

    await expectActionRoutesTo(router, handlers, [
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
    ]);
  });

  it('routes calldown, auth, navigation, and error-log actions to their handlers', async () => {
    const { router, handlers } = await loadRouter();

    await expectActionRoutesTo(router, handlers, [
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
      ['hostnameInputPage-row-1-action', 'hostnameInputPage'],
      ['insightlyGetApiKey-row-1-action', 'insightlyGetApiKey'],
      ['authPage-row-1-action', 'authPage'],
      ['managedOAuthSetupPage-row-1-action', 'managedOAuthSetupPage'],
      ['selectPlatform-p1=private-action', 'selectPlatform'],
      ['factoryResetButton-row-1-action', 'factoryResetButton'],
      ['feedbackPage-row-1-action', 'feedbackPage'],
      ['openAboutPage-row-1-action', 'openAboutPage'],
      ['openDeveloperSettingsPage-row-1-action', 'openDeveloperSettingsPage'],
      ['reportIssueButton-row-1-action', 'reportIssueButton'],
      ['documentation-row-1-action', 'documentation'],
      ['getErrorLogRecordPageNextStepButton-row-1-action', 'getErrorLogRecordPageNextStepButton'],
      ['errorLogRecordPageStartButton-row-1-action', 'errorLogRecordPageStartButton'],
      ['logRecordSubmitButton-row-1-action', 'logRecordSubmitButton'],
    ]);
  });

  it('routes admin setting actions', async () => {
    const { router, handlers } = await loadRouter();

    await expectActionRoutesTo(router, handlers, [
      ['saveServerSideLoggingButton-row-1-action', 'saveServerSideLoggingButton'],
      ['doNotLogNumbersSubmitButton-row-1-action', 'doNotLogNumbersSubmitButton'],
      ['openImplementedInterfacesPageButton-row-1-action', 'openImplementedInterfacesPageButton'],
      ['managedAuthOrgPage-row-1-action', 'managedAuthOrgPage'],
      ['managedAuthUserEdit-row-1-action', 'managedAuthUserEdit'],
      ['deleteManagedOAuthAccount-row-1-action', 'deleteManagedOAuthAccount'],
      ['managedAuthUserPage-row-1-action', 'managedAuthUserPage'],
      ['managedAuthUserEditPage-row-1-action', 'managedAuthUserPage'],
    ]);
  });

  it('routes direct settings pages to the general settings handler', async () => {
    const { router, handlers } = await loadRouter();

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
  });

  it('refreshes license status from the router refresh action', async () => {
    const { router, authCore } = await loadRouter();

    await router.onEvent({
      data: eventFor({
        id: 'refreshLicense-row-1-action',
      }),
      ...baseContext,
    });
    expect(authCore.refreshLicenseStatus).toHaveBeenCalledWith({ serverUrl: 'https://server.example' });
  });

  it('clears platform info from the router clear action', async () => {
    const { router, platformService, util } = await loadRouter();

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

  it('routes google sheets, contact search, plugin, and user mapping actions', async () => {
    const { router, handlers } = await loadRouter();

    await expectActionRoutesTo(router, handlers, [
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
      ['openInstalledPluginListPage-row-1-action', 'openInstalledPluginListPage'],
      ['selectPlugin-plugin-1-action', 'selectPlugin'],
      ['pluginLicenseRefreshButton-plugin-1-action', 'pluginLicenseRefreshButton'],
      ['editUserMappingPage-row-1-action', 'editUserMappingPage'],
      ['reinitializeUserMappingButton-row-1-action', 'reinitializeUserMappingButton'],
      ['usermappingEdit-map-1-action', 'usermappingEdit'],
      ['usermappingRemove-map-1-action', 'usermappingRemove'],
    ]);
  });

  it('opens the local support popup through the extension runtime', async () => {
    const { router, handlers } = await loadRouter();

    await router.onEvent({
      data: eventFor({ id: 'openSupportPage-row-1-action' }),
      ...baseContext,
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'openPopupWindow',
      navigationPath: '/support',
    });
    expect(handlers.pluginConfigurePageSubmit.onEvent).not.toHaveBeenCalled();
  });

  it('opens community, release notes, support, and review URLs', async () => {
    const { router } = await loadRouter();

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
  });

  it('opens user and admin Google Sheet info URLs from form data', async () => {
    const { router } = await loadRouter();

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
  });

  it('opens plugin link-button URLs from form data', async () => {
    const { router } = await loadRouter();

    await router.onEvent({
      data: eventFor({
        id: 'link-button-Open docs',
        formData: { 'link-button-Open docs': 'https://docs.example' },
      }),
      ...baseContext,
    });
    expect(window.open).toHaveBeenCalledWith('https://docs.example', '_blank');
  });

  it('routes submit-only plugin pages to their handlers', async () => {
    const { router, handlers } = await loadRouter();

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
  });

  it('routes user and admin plugin custom buttons to the correct handlers', async () => {
    const { router, handlers } = await loadRouter();

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
