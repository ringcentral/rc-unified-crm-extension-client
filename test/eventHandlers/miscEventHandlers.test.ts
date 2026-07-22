import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const axiosMock = vi.hoisted(() => ({
  defaults: {},
}));

vi.mock('axios', () => ({
  default: axiosMock,
}));

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
        canOpenLogPage: true,
        useLicense: true,
        requestConfig: {
          timeout: 7,
        },
        page: {
          appointment: {
            supported: true,
            title: 'Visits',
            showConfirm: false,
          },
        },
      },
    },
  };
}

function baseContext() {
  return {
    manifest: manifest(),
    platformInfo: {
      platformName: 'salesforce',
      hostname: 'crm.example',
    },
    platformName: 'salesforce',
    platform: manifest().platforms.salesforce,
  };
}

function mockThinNotificationDeps() {
  vi.resetModules();
  const analytics = {
    trackPlacedCall: vi.fn(),
    trackAnsweredCall: vi.fn(),
    trackEditSettings: vi.fn(),
    trackConnectedCall: vi.fn(),
  };
  vi.doMock('../../src/lib/analytics.ts', () => analytics);
  const userCore = {
    refreshUserSettings: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  return { analytics, userCore, consoleLog };
}

describe('miscellaneous top-level widget event handlers', () => {
  it('tracks placed-call notifications', async () => {
    const { analytics } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-call-init-notify.ts');

    await handler.onEvent({ data: {} });

    expect(analytics.trackPlacedCall).toHaveBeenCalled();
  });

  it('tracks answered inbound-call notifications', async () => {
    const { analytics } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-call-start-notify.ts');

    await handler.onEvent({
      data: {
        call: {
          direction: 'Inbound',
        },
      },
    });
    expect(analytics.trackAnsweredCall).toHaveBeenCalled();
  });

  it('tracks message auto-log setting notifications', async () => {
    const { analytics } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-messageLogger-auto-log-notify.ts');

    await handler.onEvent({
      data: {
        autoLog: true,
      },
    });
    expect(analytics.trackEditSettings).toHaveBeenCalledWith({
      changedItem: 'auto-message-log',
      status: true,
    });
  });

  it('tracks connected ringout-call notifications', async () => {
    const { analytics } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-ringout-call-notify.ts');

    await handler.onEvent({
      data: {
        call: {
          telephonyStatus: 'CallConnected',
        },
      },
    });
    expect(analytics.trackConnectedCall).toHaveBeenCalled();
  });

  it('forwards login-popup notifications to the extension runtime', async () => {
    mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-login-popup-notify.ts');

    await handler.onEvent({
      data: {
        oAuthUri: 'https://login.example/oauth',
      },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'openRCOAuthWindow',
      oAuthUri: 'https://login.example/oauth',
    });
  });

  it('forwards side-drawer open state to the extension runtime', async () => {
    mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-adapter-side-drawer-open-notify.ts');

    await handler.onEvent({
      data: {
        open: true,
      },
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'sideWidgetOpen',
      opened: true,
    });
  });

  it('logs calling-setting notifications', async () => {
    const { consoleLog } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-calling-settings-notify.ts');

    await handler.onEvent({
      data: {
        outboundCallControl: true,
      },
    });
    expect(consoleLog).toHaveBeenCalledWith('rc-calling-settings-notify:', {
      outboundCallControl: true,
    });
  });

  it('refreshes AI assistant user settings from adapter notifications', async () => {
    const { userCore } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-adapter-ai-assistant-settings-notify.ts');

    await handler.onEvent({
      data: {
        showAiAssistantWidget: true,
        autoStartAiAssistant: false,
      },
    });
    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        showAiAssistantWidget: {
          value: true,
        },
        autoStartAiAssistant: {
          value: false,
        },
      },
      isAvoidForceChange: true,
    });
  });

  it('refreshes phone number format user settings from adapter notifications', async () => {
    const { userCore } = mockThinNotificationDeps();
    const handler = await loadModule('../../src/eventHandlers/rc-adapter-phone-number-format-settings-notify.ts');

    await handler.onEvent({
      data: {
        formatType: 'National',
        readOnly: true,
        template: '(###) ###-####',
      },
    });
    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        phoneNumberDisplayFormatType: {
          value: 'National',
          customizable: false,
        },
        phoneNumberDisplayFormatTemplate: {
          value: '(###) ###-####',
          customizable: false,
        },
      },
    });
  });

  it('checks CRM auth and posts support-page request after webphone connection feedback', async () => {
    vi.resetModules();
    const authCore = {
      checkAuth: vi.fn(async () => true),
    };
    vi.doMock('../../src/core/auth.ts', () => ({ default: authCore }));
    const showFeedback = vi.fn((
      options: Parameters<NonNullable<typeof RCAdapter.showFeedback>>[0],
    ) => options.onFeedback?.());
    RCAdapter.showFeedback = showFeedback;
    const handler = await loadModule('../../src/eventHandlers/rc-webphone-connection-status-notify.ts');

    await handler.onEvent({
      data: {
        connectionStatus: 'connectionStatus-connected',
      },
    });

    expect(authCore.checkAuth).toHaveBeenCalled();
    expect(showFeedback).toHaveBeenCalled();
    expect(window.postMessage).toHaveBeenCalledWith({
      path: '/custom-button-click',
      type: 'rc-post-message-request',
      body: {
        button: {
          id: 'openSupportPage',
        },
      },
    });
  });

  it('persists region settings and refreshes localized service manifest', async () => {
    vi.resetModules();
    const i18n = {
      getLocale: vi.fn(() => 'en-US'),
      restoreLocale: vi.fn(async () => 'en-CA'),
    };
    const syncLocaleToEmbeddableWhenReady = vi.fn(async () => {});
    vi.doMock('../../src/i18n/index.ts', () => ({ default: i18n }));
    vi.doMock('../../src/lib/embeddableLocale.ts', () => ({
      syncLocaleToEmbeddable: vi.fn(async () => {}),
      syncLocaleToEmbeddableWhenReady,
    }));
    vi.doMock('../../src/service/customizedPageLocaleService.ts', () => ({ refreshLocalizedCustomizedPageTitles: vi.fn(async () => {}) }));
    const embeddableServices = {
      getServiceManifest: vi.fn(async () => ({ id: 'localized-service' })),
    };
    vi.doMock('../../src/service/embeddableServices.ts', () => ({ default: embeddableServices }));

    const handler = await loadModule('../../src/eventHandlers/rc-region-settings-notify.ts');

    await handler.onEvent({
      data: {
        countryCode: 'CA',
      },
    });

    expect(readStorage().selectedRegion).toBe('CA');
    expect(i18n.restoreLocale).toHaveBeenCalled();
    expect(syncLocaleToEmbeddableWhenReady).toHaveBeenCalledWith('en-CA');
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: { id: 'localized-service' },
      },
      targetOrigin: '*',
    });
  });

  it('starts retro auto-call-log polling only when CRM is authorized', async () => {
    vi.resetModules();
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(
      123 as unknown as ReturnType<typeof setInterval>,
    );
    const analytics = {
      trackEditSettings: vi.fn(),
    };
    vi.doMock('../../src/lib/analytics.ts', () => analytics);
    const logService = {
      retroAutoCallLog: vi.fn(),
    };
    vi.doMock('../../src/service/logService.ts', () => ({ default: logService }));
    vi.doMock('../../src/service/manifestService.ts', () => ({
      getManifest: vi.fn(async () => manifest()),
    }));
    vi.doMock('../../src/service/platformService.ts', () => ({
      getPlatformInfo: vi.fn(async () => ({ platformName: 'salesforce' })),
    }));
    seedStorage({
      crmAuthed: true,
    });

    const handler = await loadModule('../../src/eventHandlers/rc-callLogger-auto-log-notify.ts');

    await handler.onEvent({
      data: {
        autoLog: true,
      },
    });

    expect(analytics.trackEditSettings).toHaveBeenCalledWith({
      changedItem: 'auto-call-log',
      status: true,
    });
    expect(readStorage().retroAutoCallLogMaxAttempt).toBe(10);
    expect(readStorage().retroAutoCallLogIntervalId).toBe(123);
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
    intervalSpy.mock.calls[0][0]();
    expect(logService.retroAutoCallLog).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      platform: manifest().platforms.salesforce,
    });
  });

  it('refreshes pushed adapter state and reapplies platform request timeout', async () => {
    vi.resetModules();
    axios.defaults.timeout = undefined;
    const refreshManifest = vi.fn(async () => manifest());
    vi.doMock('../../src/service/platformService.ts', () => ({
      getPlatformInfo: vi.fn(async () => ({ platformName: 'salesforce' })),
    }));
    vi.doMock('../../src/service/manifestService.ts', () => ({
      getManifest: vi.fn(async () => manifest()),
      refreshManifest,
    }));
    vi.doMock('../../src/i18n/index.js', () => ({ default: { restoreLocale: vi.fn(async () => 'en-US') } }));
    vi.doMock('../../src/lib/embeddableLocale.js', () => ({
      syncLocaleToEmbeddable: vi.fn(async () => {}),
      syncLocaleToEmbeddableWhenReady: vi.fn(async () => {}),
    }));
    vi.doMock('../../src/service/customizedPageLocaleService.js', () => ({ refreshLocalizedCustomizedPageTitles: vi.fn(async () => {}) }));
    const embeddableServices = {
      getServiceManifest: vi.fn(async () => ({ id: 'updated-service' })),
    };
    vi.doMock('../../src/service/embeddableServices.ts', () => ({ default: embeddableServices }));

    const handler = await loadModule('../../src/eventHandlers/rc-adapter-pushAdapterState.ts');

    await handler.onEvent({ data: {} });

    expect(refreshManifest).toHaveBeenCalled();
    expect(axios.defaults.timeout).toBe(7000);
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: { id: 'updated-service' },
      },
      targetOrigin: '*',
    });
  });

  it('tracks widget analytics events and resets ongoing-call state on call end', async () => {
    vi.resetModules();
    const analytics = {
      trackSentSMS: vi.fn(),
      trackCreateMeeting: vi.fn(),
      trackCallEnd: vi.fn(),
    };
    vi.doMock('../../src/lib/analytics.ts', () => analytics);
    seedStorage({
      callWith: 'softphone',
      callingMode: 'web',
      hasOngoingCall: true,
    });
    const handler = await loadModule('../../src/eventHandlers/rc-analytics-track.ts');

    await handler.onEvent({ data: { event: 'SMS: SMS sent successfully' } });
    await handler.onEvent({ data: { event: 'Meeting Scheduled' } });
    await handler.onEvent({
      data: {
        event: 'WebRTC Call Ended',
        properties: {
          direction: 'Outbound',
          duration: 42,
          result: 'Completed',
        },
      },
    });

    expect(analytics.trackSentSMS).toHaveBeenCalled();
    expect(analytics.trackCreateMeeting).toHaveBeenCalled();
    expect(readStorage().hasOngoingCall).toBe(false);
    expect(analytics.trackCallEnd).toHaveBeenCalledWith({
      direction: 'Outbound',
      durationInSeconds: 42,
      result: 'Completed',
      callWith: 'softphone',
      callingMode: 'web',
    });
  });

  it('records pending recordings, transfer state, and warm-transfer contact pop', async () => {
    vi.resetModules();
    const addPendingRecordingSessionId = vi.fn(async () => {});
    vi.doMock('../../src/lib/logUtil.ts', () => ({
      addPendingRecordingSessionId,
    }));
    const openContactPage = vi.fn(async () => {});
    vi.doMock('../../src/core/contact.ts', () => ({
      openContactPage,
    }));
    vi.doMock('../../src/core/user.ts', () => ({
      default: {
        getCallPopMultiMatchBehavior: vi.fn(() => ({ value: 'prompt' })),
      },
    }));
    vi.doMock('../../src/service/manifestService.ts', () => ({
      getManifest: vi.fn(async () => manifest()),
    }));
    seedStorage({
      'platform-info': {
        platformName: 'salesforce',
      },
      userSettings: {},
    });
    const popupContext: Record<string, any> = {};
    const handler = await loadModule('../../src/eventHandlers/rc-telephony-session-notify.ts');

    await handler.onEvent({
      popupContext,
      data: {
        telephonySession: {
          sessionId: 'telephony-1',
          parties: [
            {
              recordings: [{ id: 'recording-1' }],
              status: {
                reason: 'AttendedTransfer',
                code: 'Gone',
                peerId: {
                  telephonySessionId: 'transfer-session',
                },
              },
              direction: 'Outbound',
            },
            {
              status: {
                reason: 'AttendedTransfer',
                code: 'Answered',
              },
              direction: 'Inbound',
              from: {
                phoneNumber: '+16505550100',
              },
              to: {
                phoneNumber: '+18005550100',
              },
            },
          ],
        },
      },
    });

    expect(readStorage()['rec-link-telephony-1'].link).toBe('(pending...)');
    expect(addPendingRecordingSessionId).toHaveBeenCalledWith({
      sessionId: 'telephony-1',
    });
    expect(popupContext.transferOnHold).toBe('transfer-session');
    expect(openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550100',
      multiContactMatchBehavior: 'prompt',
      fromCallPop: true,
    });
  });
});

describe('thin message handlers and content helpers', () => {
  it('forwards extension control-call messages to the widget frame', async () => {
    vi.resetModules();
    const handler = await loadModule('../../src/messageHandlers/controlCall.ts');
    const sendResponse = vi.fn();

    await handler.onMessage({
      request: {
        callAction: 'mute',
        callId: 'call-1',
        options: {
          muted: true,
        },
      },
      sendResponse,
    });

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-control-call',
        callAction: 'mute',
        callId: 'call-1',
        options: {
          muted: true,
        },
      },
      targetOrigin: '*',
    });
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('tracks ringsense reference messages and acknowledges them', async () => {
    vi.resetModules();
    const trackRingSensePage = vi.fn();
    vi.doMock('../../src/lib/analytics.ts', () => ({
      trackRingSensePage,
    }));
    const handler = await loadModule('../../src/messageHandlers/ringsenseRefTrack.ts');
    const sendResponse = vi.fn();

    await handler.onMessage({
      request: {},
      sendResponse,
    });

    expect(trackRingSensePage).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('wraps chrome runtime sendMessage and reports invalid extension contexts', async () => {
    vi.resetModules();
    const trackChromeAPIError = vi.fn();
    vi.doMock('../../src/lib/analytics.ts', () => ({
      trackChromeAPIError,
    }));
    const { sendMessageToExtension } = await import('../../src/lib/sendMessage.ts');
    const callback = vi.fn();
    chrome.runtime.sendMessage.mockReturnValueOnce(Promise.resolve({ ok: true }));

    const result = sendMessageToExtension({ type: 'ping' }, callback);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'ping' }, callback);
    await expect(result).resolves.toEqual({ ok: true });

    const error = new Error('Extension context invalidated.');
    chrome.runtime.sendMessage.mockImplementationOnce(() => {
      throw error;
    });
    vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    sendMessageToExtension({ type: 'ping' });

    expect(trackChromeAPIError).toHaveBeenCalledWith('Extension context invalidated.');
    expect(globalThis.alert).toHaveBeenCalledWith(
      'RingCentral App Connect has been upgraded. Please refresh current page to continue.',
    );
  });
});

async function loadSettingsRequestHandler() {
  vi.resetModules();
  const userCore = {
    refreshUserSettings: vi.fn(async ({ changedSettings }) => changedSettings),
    getShowUserReportTabSetting: vi.fn(() => ({ value: true })),
    getShowCalldownTabSetting: vi.fn(() => ({ value: true })),
    getUserReportStats: vi.fn(async () => ({ totalCalls: 0 })),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));
  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
  };
  vi.doMock('../../src/lib/util.ts', () => util);
  const embeddableServices = {
    getServiceManifest: vi.fn(async () => ({ id: 'developer-service' })),
  };
  vi.doMock('../../src/service/embeddableServices.ts', () => ({ default: embeddableServices }));
  const appointmentsPage = {
    getAppointmentsPageRender: vi.fn(() => ({ id: 'appointmentsPage' })),
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentsPage.ts', () => ({ default: appointmentsPage }));
  const reportPage = {
    getReportsPageRender: vi.fn(() => ({ id: 'reportPage' })),
  };
  vi.doMock('../../src/components/reportPage/reportPage.ts', () => ({ default: reportPage }));
  const calldownPage = {
    getCalldownPageWithRecords: vi.fn(async () => ({ id: 'calldownPage' })),
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));
  const adminPage = {
    getAdminPageRender: vi.fn(() => ({ id: 'adminPage' })),
  };
  vi.doMock('../../src/components/admin/adminPage.ts', () => ({ default: adminPage }));
  const i18n = {
    AUTO_LOCALE: 'auto',
    normalizeLocaleCode: vi.fn((code) => code),
    getBrowserLocale: vi.fn(() => 'en-US'),
    applyLocaleCode: vi.fn(async (code) => code),
  };
  vi.doMock('../../src/i18n/index.ts', () => ({ default: i18n }));
  const embeddableLocale = {
    syncLocaleToEmbeddable: vi.fn(async () => {}),
    syncLocaleToEmbeddableWhenReady: vi.fn(async () => {}),
  };
  vi.doMock('../../src/lib/embeddableLocale.ts', () => embeddableLocale);

  const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/settings.ts');

  return {
    handler,
    userCore,
    util,
    appointmentsPage,
    reportPage,
    calldownPage,
    adminPage,
    i18n,
    embeddableLocale,
  };
}

async function loadAuthorizeHandler() {
  vi.resetModules();
  const userCore = {
    updateSSCLToken: vi.fn(async () => {}),
    getShowCalldownTabSetting: vi.fn(() => ({ value: true })),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));
  const authCore = {
    onUserClickConnectButton: vi.fn(async () => {}),
    unAuthorize: vi.fn(async () => {}),
    refreshLicenseStatus: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/auth.ts', () => ({ default: authCore }));
  const calldownPage = {
    getCalldownPageRender: vi.fn(() => ({ id: 'calldownPage' })),
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));
  const responseMessage = vi.fn();
  vi.doMock('../../src/lib/util.ts', () => ({ responseMessage }));

  const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/authorize.ts');

  return {
    handler,
    userCore,
    authCore,
    responseMessage,
  };
}

async function loadContactViewHandler() {
  vi.resetModules();
  const contactCore = {
    openContactPage: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));
  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
  };
  vi.doMock('../../src/lib/util.ts', () => util);
  vi.doMock('../../src/core/user.ts', () => ({
    default: {
      getCallPopMultiMatchBehavior: vi.fn(() => ({ value: 'prompt' })),
    },
  }));

  const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/contacts/view.ts');

  return {
    handler,
    contactCore,
    util,
  };
}

describe('miscellaneous rc-post-message-request handlers', () => {
  it('saves nested settings and reloads developer-mode service manifest', async () => {
    const {
      handler,
      userCore,
      util,
      appointmentsPage,
    } = await loadSettingsRequestHandler();

    await handler.onEvent({
      data: {
        requestId: 'settings-1',
        body: {
          setting: {
            id: 'developerMode',
            value: true,
          },
          settings: [
            {
              items: [
                {
                  id: 'autoLogCall',
                  value: true,
                },
                {
                  items: [
                    {
                      id: 'showAppointmentsTab',
                      value: false,
                    },
                  ],
                },
              ],
            },
            {
              id: 'directSetting',
              value: 'enabled',
            },
          ],
        },
      },
      ...baseContext(),
    });

    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: {
        autoLogCall: { value: true },
        showAppointmentsTab: { value: false },
        directSetting: { value: 'enabled' },
      },
    });
    expect(appointmentsPage.getAppointmentsPageRender).toHaveBeenCalledWith(expect.objectContaining({
      appointmentTitle: 'Visits',
      showConfirm: false,
      userSettings: {
        autoLogCall: { value: true },
        showAppointmentsTab: { value: false },
        directSetting: { value: 'enabled' },
      },
    }));
    expect(readStorage().developerMode).toBe(true);
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Developer mode is turned ON.',
      ttl: 5000,
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'appointmentsPage' },
        },
        targetOrigin: '*',
      },
      {
        message: {
          type: 'rc-adapter-register-third-party-service',
          service: { id: 'developer-service' },
        },
        targetOrigin: '*',
      },
    ]));
    expect(util.responseMessage).toHaveBeenCalledWith('settings-1', { data: 'ok' });
  });

  it('shows the auto-open notification when auto-open setting is disabled', async () => {
    const { handler, util } = await loadSettingsRequestHandler();

    await handler.onEvent({
      data: {
        requestId: 'settings-2',
        body: {
          setting: {
            id: 'autoOpenWithCRM',
            value: false,
          },
          settings: [],
        },
      },
      ...baseContext(),
    });
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Auto open is turned OFF.',
      ttl: 5000,
    });
  });

  it('shows the generic saved notification for other settings', async () => {
    const { handler, util } = await loadSettingsRequestHandler();

    await handler.onEvent({
      data: {
        requestId: 'settings-3',
        body: {
          setting: {
            id: 'otherSetting',
            value: true,
          },
          settings: [],
        },
      },
      ...baseContext(),
    });
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Settings saved.',
      ttl: 3000,
    });
  });

  it('applies the selected UI language, persists the override, and re-registers the service', async () => {
    const { handler, util, i18n, embeddableLocale } = await loadSettingsRequestHandler();

    await handler.onEvent({
      data: {
        requestId: 'settings-lang',
        body: {
          setting: { id: 'language', value: 'de-DE' },
          settings: [
            { items: [{ id: 'language', value: 'de-DE' }] },
          ],
        },
      },
      ...baseContext(),
    });

    expect(i18n.applyLocaleCode).toHaveBeenCalledWith('de-DE');
    expect(embeddableLocale.syncLocaleToEmbeddableWhenReady).toHaveBeenCalledWith('de-DE');
    expect(readStorage().languageOverride).toBe('de-DE');
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-third-party-service',
          service: { id: 'developer-service' },
        },
        targetOrigin: '*',
      },
      // Custom tabs are re-registered so their titles localize immediately.
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'reportPage' },
        },
        targetOrigin: '*',
      },
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'calldownPage' },
        },
        targetOrigin: '*',
      },
    ]));
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Language updated.',
      ttl: 3000,
    });
  });

  it('re-registers the Admin tab on a language change for admins', async () => {
    const { handler, adminPage } = await loadSettingsRequestHandler();
    await chrome.storage.local.set({ isAdmin: true, adminSettings: { userSettings: {} } });

    await handler.onEvent({
      data: {
        requestId: 'settings-lang-admin',
        body: {
          setting: { id: 'language', value: 'de-DE' },
          settings: [
            { items: [{ id: 'language', value: 'de-DE' }] },
          ],
        },
      },
      ...baseContext(),
    });

    expect(adminPage.getAdminPageRender).toHaveBeenCalledTimes(1);
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'adminPage' },
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('does not re-register the Admin tab for non-admins on a language change', async () => {
    const { handler, adminPage } = await loadSettingsRequestHandler();

    await handler.onEvent({
      data: {
        requestId: 'settings-lang-nonadmin',
        body: {
          setting: { id: 'language', value: 'de-DE' },
          settings: [
            { items: [{ id: 'language', value: 'de-DE' }] },
          ],
        },
      },
      ...baseContext(),
    });

    expect(adminPage.getAdminPageRender).not.toHaveBeenCalled();
  });

  it('does not re-apply the language when the submitted value is unchanged', async () => {
    const { handler, util, i18n } = await loadSettingsRequestHandler();
    await chrome.storage.local.set({ languageOverride: 'de-DE' });

    await handler.onEvent({
      data: {
        requestId: 'settings-lang-unchanged',
        body: {
          setting: { id: 'someOtherSetting', value: true },
          settings: [
            { items: [{ id: 'language', value: 'de-DE' }] },
          ],
        },
      },
      ...baseContext(),
    });

    expect(i18n.applyLocaleCode).not.toHaveBeenCalled();
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Settings saved.',
      ttl: 3000,
    });
  });

  it('follows the browser locale when the language is switched to "auto"', async () => {
    const { handler, i18n } = await loadSettingsRequestHandler();
    await chrome.storage.local.set({ languageOverride: 'de-DE' });

    await handler.onEvent({
      data: {
        requestId: 'settings-lang-auto',
        body: {
          setting: { id: 'language', value: 'auto' },
          settings: [
            { items: [{ id: 'language', value: 'auto' }] },
          ],
        },
      },
      ...baseContext(),
    });

    expect(i18n.getBrowserLocale).toHaveBeenCalled();
    expect(i18n.applyLocaleCode).toHaveBeenCalledWith('en-US');
    expect(readStorage().languageOverride).toBe('auto');
  });

  it('isolates a failing Reports tab re-registration and still localizes the other tabs', async () => {
    const { handler, util, reportPage, calldownPage, adminPage } = await loadSettingsRequestHandler();
    await chrome.storage.local.set({ isAdmin: true, adminSettings: { userSettings: {} } });
    // Reports re-registration throws; the Call Back and Admin tabs must still register.
    reportPage.getReportsPageRender.mockImplementationOnce(() => {
      throw new Error('report render boom');
    });

    await expect(handler.onEvent({
      data: {
        requestId: 'settings-lang-report-fail',
        body: {
          setting: { id: 'language', value: 'de-DE' },
          settings: [
            { items: [{ id: 'language', value: 'de-DE' }] },
          ],
        },
      },
      ...baseContext(),
    })).resolves.toBeUndefined();

    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledTimes(1);
    expect(adminPage.getAdminPageRender).toHaveBeenCalledTimes(1);
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      { message: { type: 'rc-adapter-register-customized-page', page: { id: 'calldownPage' } }, targetOrigin: '*' },
      { message: { type: 'rc-adapter-register-customized-page', page: { id: 'adminPage' } }, targetOrigin: '*' },
    ]));
    expect(getWidgetPostMessages()).not.toEqual(expect.arrayContaining([
      { message: { type: 'rc-adapter-register-customized-page', page: { id: 'reportPage' } }, targetOrigin: '*' },
    ]));
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Language updated.',
      ttl: 3000,
    });
  });

  it('does not throw when Call Back and Admin tab re-registration fail during a language change', async () => {
    const { handler, util, calldownPage, adminPage } = await loadSettingsRequestHandler();
    await chrome.storage.local.set({ isAdmin: true, adminSettings: { userSettings: {} } });
    calldownPage.getCalldownPageWithRecords.mockRejectedValueOnce(new Error('calldown boom'));
    adminPage.getAdminPageRender.mockImplementationOnce(() => {
      throw new Error('admin render boom');
    });

    await expect(handler.onEvent({
      data: {
        requestId: 'settings-lang-tabs-fail',
        body: {
          setting: { id: 'language', value: 'de-DE' },
          settings: [
            { items: [{ id: 'language', value: 'de-DE' }] },
          ],
        },
      },
      ...baseContext(),
    })).resolves.toBeUndefined();

    // Both re-registration paths were attempted (and their errors swallowed).
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledTimes(1);
    expect(adminPage.getAdminPageRender).toHaveBeenCalledTimes(1);
    expect(util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Language updated.',
      ttl: 3000,
    });
  });

  it('connects CRM when authorize is requested while unauthorized', async () => {
    const { handler, authCore } = await loadAuthorizeHandler();

    await handler.onEvent({
      data: {
        requestId: 'authorize-1',
      },
      ...baseContext(),
    });

    expect(readStorage().crmAuthed).toBe(false);
    expect(authCore.onUserClickConnectButton).toHaveBeenCalledWith({
      platform: manifest().platforms.salesforce,
      platformName: 'salesforce',
      manifest: manifest(),
    });
  });

  it('disconnects CRM and hides calldown page when authorize is requested while authorized', async () => {
    const {
      handler,
      userCore,
      authCore,
      responseMessage,
    } = await loadAuthorizeHandler();

    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-token',
      userSettings: {},
    });
    await handler.onEvent({
      data: {
        requestId: 'authorize-2',
      },
      ...baseContext(),
    });

    expect(readStorage().crmAuthed).toBe(true);
    expect(userCore.updateSSCLToken).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: manifest().platforms.salesforce,
      token: '',
    });
    expect(authCore.unAuthorize).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      rcUnifiedCrmExtJwt: 'jwt-token',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'calldownPage',
          hidden: true,
          unreadCount: 0,
        },
      },
      targetOrigin: '*',
    });
    expect(authCore.refreshLicenseStatus).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
    });
    expect(responseMessage).toHaveBeenCalledWith('authorize-2', { data: 'ok' });
  });

  it('renders plugin market results excluding installed plugins', async () => {
    vi.resetModules();
    const pluginList = [
      { id: 'plugin-1', name: 'Installed' },
      { id: 'plugin-2', name: 'Available' },
    ];
    const getPluginMarketListPageRender = vi.fn(() => ({ id: 'pluginMarketListPage' }));
    vi.doMock('../../src/components/pluginMarketListPage.ts', () => ({
      getPluginMarketListPageRender,
    }));
    vi.doMock('../../src/service/manifestService.ts', () => ({
      getPluginList: vi.fn(async () => pluginList),
    }));
    vi.doMock('../../src/core/user.ts', () => ({
      getUserSettingsOnline: vi.fn(async () => ({
        'plugin_plugin-1': {
          value: {},
        },
      })),
      getAllPluginSettings: vi.fn(() => ({
        'plugin-1': {},
      })),
    }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/pluginMarketListPage.ts');

    await handler.onEvent({
      data: {
        body: {
          formData: {
            pluginSearch: {
              search: 'available',
              filter: 'licensed',
            },
          },
        },
      },
      ...baseContext(),
    });

    expect(getPluginMarketListPageRender).toHaveBeenCalledWith({
      pluginList: [{ id: 'plugin-2', name: 'Available' }],
      searchWord: 'available',
      filter: 'licensed',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'pluginMarketListPage' },
        },
        targetOrigin: undefined,
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/pluginMarketListPage',
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('opens contact pages using active-call context during ongoing calls', async () => {
    const { handler, contactCore } = await loadContactViewHandler();
    const data = {
      requestId: 'contact-view-1',
      body: {
        id: 'contact-1',
        contactType: 'Lead',
        phoneNumbers: [
          {
            phoneNumber: '+16505550100',
          },
        ],
      },
    };

    seedStorage({
      hasOngoingCall: true,
      userSettings: {},
    });
    await handler.onEvent({
      data,
      ...baseContext(),
    });
    expect(contactCore.openContactPage).toHaveBeenCalledWith(expect.not.objectContaining({
      contactId: 'contact-1',
    }));
  });

  it('opens requested contact pages when there is no active call', async () => {
    const {
      handler,
      contactCore,
      util,
    } = await loadContactViewHandler();
    const data = {
      requestId: 'contact-view-1',
      body: {
        id: 'contact-1',
        contactType: 'Lead',
        phoneNumbers: [
          {
            phoneNumber: '+16505550100',
          },
        ],
      },
    };

    seedStorage({
      hasOngoingCall: false,
      userSettings: {},
    });
    await handler.onEvent({
      data,
      ...baseContext(),
    });
    expect(contactCore.openContactPage).toHaveBeenLastCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      phoneNumber: '+16505550100',
      contactType: 'Lead',
      multiContactMatchBehavior: 'prompt',
    }));
    expect(util.responseMessage).toHaveBeenCalledWith('contact-view-1', { data: 'ok' });
  });

  it('updates call-log draft pages and opens contact search from input changes', async () => {
    vi.resetModules();
    const logCore = {
      cacheCallNote: vi.fn(async () => {}),
    };
    vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));
    const logPage = {
      getUpdatedLogPageRender: vi.fn(() => ({ id: 'callLogPage' })),
    };
    vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));
    const contactSearch = {
      getCustomContactSearch: vi.fn(() => ({ id: 'contactSearchPage' })),
    };
    vi.doMock('../../src/core/customContactSearch.ts', () => ({ default: contactSearch }));
    const responseMessage = vi.fn();
    vi.doMock('../../src/lib/util.ts', () => ({ responseMessage }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/inputChanged/index.ts');

    await handler.onEvent({
      data: {
        requestId: 'input-1',
        body: {
          call: {
            sessionId: 'session-1',
          },
          formData: {
            note: 'draft note',
            contact: 'searchContact',
            contactPhoneNumber: '+16505550100',
          },
        },
      },
      ...baseContext(),
    });

    expect(logCore.cacheCallNote).toHaveBeenCalledWith({
      sessionId: 'session-1',
      note: 'draft note',
    });
    expect(logPage.getUpdatedLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      manifest: manifest(),
      platformName: 'salesforce',
      logType: 'Call',
    }));
    expect(contactSearch.getCustomContactSearch).toHaveBeenCalledWith({
      contactSearchAdapterButton: 'contactSearchAdapterButtonCallLog',
      contactPhoneNumber: '+16505550100',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-update-call-log-page',
          page: { id: 'callLogPage' },
        },
        targetOrigin: '*',
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/contactSearchPage',
        },
        targetOrigin: '*',
      },
    ]));
    expect(responseMessage).toHaveBeenCalledWith('input-1', { data: 'ok' });
  });

  it('updates message-log draft pages and opens contact search from input changes', async () => {
    vi.resetModules();
    const logPage = {
      getUpdatedLogPageRender: vi.fn(() => ({ id: 'messageLogPage' })),
    };
    vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));
    const contactSearch = {
      getCustomContactSearch: vi.fn(() => ({ id: 'messageContactSearchPage' })),
    };
    vi.doMock('../../src/core/customContactSearch.ts', () => ({ default: contactSearch }));
    const responseMessage = vi.fn();
    vi.doMock('../../src/lib/util.ts', () => ({ responseMessage }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/messageLogger/inputChanged/index.ts');

    await handler.onEvent({
      data: {
        requestId: 'message-input-1',
        body: {
          keys: ['contact'],
          page: {
            id: 'messageLogPage',
          },
          formData: {
            contact: 'searchContact',
            contactPhoneNumber: '+16505550100',
          },
        },
      },
      ...baseContext(),
    });

    expect(logPage.getUpdatedLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      manifest: manifest(),
      logType: 'Message',
      platformName: 'salesforce',
    }));
    expect(contactSearch.getCustomContactSearch).toHaveBeenCalledWith({
      contactSearchAdapterButton: 'contactSearchAdapterButtonMessageLog',
      contactPhoneNumber: '+16505550100',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-update-messages-log-page',
          page: { id: 'messageLogPage' },
        },
        targetOrigin: '*',
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/messageContactSearchPage',
        },
        targetOrigin: '*',
      },
    ]));
    expect(responseMessage).toHaveBeenCalledWith('message-input-1', { data: 'ok' });
  });

  it('matches locally saved message logs by conversation log id', async () => {
    vi.resetModules();
    const util = {
      responseMessage: vi.fn(),
      isObjectEmpty: vi.fn((obj) => Object.keys(obj || {}).length === 0),
    };
    vi.doMock('../../src/lib/util.ts', () => util);
    seedStorage({
      'rc-crm-conversation-log-log-1': {
        contact: {
          id: 'contact-1',
        },
      },
      'rc-crm-conversation-log-log-2': {},
    });
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/messageLogger/match/index.ts');

    await handler.onEvent({
      data: {
        requestId: 'message-match-1',
        body: {
          conversationLogIds: ['log-1', 'log-2', 'log-3'],
        },
      },
      ...baseContext(),
    });

    expect(util.responseMessage).toHaveBeenCalledWith('message-match-1', {
      data: {
        'log-1': [{ id: 'dummyId' }],
      },
    });
  });

  it('syncs matched call data and removes pending recording markers', async () => {
    vi.resetModules();
    const logService = {
      syncCallData: vi.fn(async () => {}),
    };
    vi.doMock('../../src/service/logService.ts', () => ({ default: logService }));
    const trackUpdateCallRecordingLink = vi.fn();
    vi.doMock('../../src/lib/analytics.ts', () => ({
      trackUpdateCallRecordingLink,
    }));
    const removePendingRecordingSessionId = vi.fn(async () => {});
    vi.doMock('../../src/lib/logUtil.ts', () => ({
      removePendingRecordingSessionId,
    }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/callLogSync.ts');

    await handler.onEvent({
      data: {
        body: {
          call: {
            sessionId: 'session-1',
            recording: {
              link: 'https://recording.example/1',
            },
          },
        },
      },
      existingCalls: [
        {
          matched: true,
        },
      ],
      ...baseContext(),
    });

    expect(trackUpdateCallRecordingLink).toHaveBeenCalledWith({
      processState: 'start',
    });
    expect(logService.syncCallData).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      dataBody: {
        call: {
          sessionId: 'session-1',
          recording: {
            link: 'https://recording.example/1',
          },
        },
      },
    });
    expect(trackUpdateCallRecordingLink).toHaveBeenCalledWith({
      processState: 'finish',
    });
    expect(removePendingRecordingSessionId).toHaveBeenCalledWith({
      sessionId: 'session-1',
    });
  });

  it('opens matched call logs directly', async () => {
    vi.resetModules();
    const logCore = {
      openLog: vi.fn(),
    };
    vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));
    const contactCore = {
      openContactPage: vi.fn(async () => {}),
    };
    vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));
    vi.doMock('../../src/core/user.ts', () => ({
      default: {
        getCallPopMultiMatchBehavior: vi.fn(() => ({ value: 'prompt' })),
      },
    }));
    vi.doMock('../../src/lib/util.ts', () => ({ responseMessage: vi.fn() }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/viewLog.ts');

    await handler.onEvent({
      data: {
        body: {
          call: {
            sessionId: 'session-1',
            direction: 'Inbound',
          },
          fromEntity: {
            id: 'contact-1',
            contactType: 'Lead',
          },
          toEntity: {
            id: 'contact-2',
            contactType: 'Contact',
          },
        },
      },
      existingCalls: [
        {
          sessionId: 'session-1',
          logId: 'log-1',
        },
      ],
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      ...baseContext(),
    });
    expect(logCore.openLog).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      hostname: 'crm.example',
      logId: 'log-1',
      contactType: 'Lead',
      contactId: 'contact-1',
      userSettings: {},
    });
    expect(contactCore.openContactPage).not.toHaveBeenCalled();
  });

  it('falls back to opening the matched contact when no call log can be opened', async () => {
    vi.resetModules();
    const logCore = {
      openLog: vi.fn(),
    };
    vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));
    const contactCore = {
      openContactPage: vi.fn(async () => {}),
    };
    vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));
    vi.doMock('../../src/core/user.ts', () => ({
      default: {
        getCallPopMultiMatchBehavior: vi.fn(() => ({ value: 'prompt' })),
      },
    }));
    vi.doMock('../../src/lib/util.ts', () => ({ responseMessage: vi.fn() }));
    const handler = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/viewLog.ts');

    await handler.onEvent({
      data: {
        body: {
          call: {
            sessionId: 'session-2',
            direction: 'Outbound',
          },
          fromEntity: {
            id: 'contact-1',
            contactType: 'Lead',
          },
          toEntity: {
            id: 'contact-2',
            contactType: 'Contact',
          },
        },
      },
      manifest: {
        ...manifest(),
        platforms: {
          salesforce: {
            canOpenLogPage: false,
          },
        },
      },
      platformInfo: {
        platformName: 'salesforce',
        hostname: 'crm.example',
      },
      platformName: 'salesforce',
      platform: {
        canOpenLogPage: false,
      },
      existingCalls: [],
      contactPhoneNumber: '+16505550200',
      userSettings: {},
    });

    expect(logCore.openLog).not.toHaveBeenCalled();
    expect(contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: expect.objectContaining({
        serverUrl: 'https://server.example',
      }),
      platformName: 'salesforce',
      phoneNumber: '+16505550200',
      contactId: 'contact-2',
      contactType: 'Contact',
      multiContactMatchBehavior: 'prompt',
    });
  });
});
