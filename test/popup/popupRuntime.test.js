import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const eventHandlerModules = {
  rcTelephonySessionNotify: '../../src/eventHandlers/rc-telephony-session-notify.js',
  rcCallingSettingsNotify: '../../src/eventHandlers/rc-calling-settings-notify.js',
  rcRegionSettingsNotify: '../../src/eventHandlers/rc-region-settings-notify.js',
  rcAdapterSideDrawerOpenNotify: '../../src/eventHandlers/rc-adapter-side-drawer-open-notify.js',
  rcDialerStatusNotify: '../../src/eventHandlers/rc-dialer-status-notify.js',
  rcWebphoneConnectionStatusNotify: '../../src/eventHandlers/rc-webphone-connection-status-notify.js',
  rcAdapterPushAdapterState: '../../src/eventHandlers/rc-adapter-pushAdapterState.js',
  rcLoginStatusNotify: '../../src/eventHandlers/rc-login-status-notify.js',
  rcLoginPopupNotify: '../../src/eventHandlers/rc-login-popup-notify.js',
  rcCallInitNotify: '../../src/eventHandlers/rc-call-init-notify.js',
  rcCallStartNotify: '../../src/eventHandlers/rc-call-start-notify.js',
  rcRingoutCallNotify: '../../src/eventHandlers/rc-ringout-call-notify.js',
  rcActiveCallNotify: '../../src/eventHandlers/rc-active-call-notify.js',
  rcAnalyticsTrackNotify: '../../src/eventHandlers/rc-analytics-track.js',
  rcCallLoggerAutoLogNotify: '../../src/eventHandlers/rc-callLogger-auto-log-notify.js',
  rcMessageLoggerAutoLogNotify: '../../src/eventHandlers/rc-messageLogger-auto-log-notify.js',
  rcRouteChangedNotify: '../../src/eventHandlers/rc-route-changed-notify.js',
  rcAdapterAiAssistantSettingsNotify: '../../src/eventHandlers/rc-adapter-ai-assistant-settings-notify.js',
  rcPostMessageRequest: '../../src/eventHandlers/rc-post-message-request/index.js',
  rcAdapterPhoneNumberFormatSettingsNotify: '../../src/eventHandlers/rc-adapter-phone-number-format-settings-notify.js',
};

const messageHandlerModules = {
  oauthCallBack: '../../src/messageHandlers/oauthCallBack.js',
  pipedriveCallbackUri: '../../src/messageHandlers/pipedriveCallbackUri.js',
  c2sms: '../../src/messageHandlers/c2sms.js',
  c2d: '../../src/messageHandlers/c2d.js',
  c2schedule: '../../src/messageHandlers/c2schedule.js',
  navigate: '../../src/messageHandlers/navigate.js',
  insightlyAuth: '../../src/messageHandlers/insightlyAuth.js',
  ringsenseRefTrack: '../../src/messageHandlers/ringsenseRefTrack.js',
  controlCall: '../../src/messageHandlers/controlCall.js',
};

async function loadPopupRuntime() {
  vi.resetModules();

  const requestInterceptors = [];
  const responseInterceptors = [];
  const axiosMock = {
    defaults: {},
    get: vi.fn(async () => ({ data: { findContactWithName: true } })),
    interceptors: {
      request: {
        use: vi.fn((fulfilled, rejected) => requestInterceptors.push({ fulfilled, rejected })),
      },
      response: {
        use: vi.fn((fulfilled, rejected) => responseInterceptors.push({ fulfilled, rejected })),
      },
    },
  };
  vi.doMock('axios', () => ({ default: axiosMock }));

  const util = {
    checkC2DCollision: vi.fn(),
    showNotification: vi.fn(),
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const analytics = {
    setAuthor: vi.fn(),
  };
  vi.doMock('../../src/lib/analytics.js', () => analytics);

  const authCore = {
    syncCrmAuthedFromStorage: vi.fn(async () => {}),
    clearLocalCrmAuthState: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/auth.js', () => ({ default: authCore }));

  const apiErrorHandler = {
    handleApiError: vi.fn(async () => {}),
    registerCrmAuthCacheClearedHandler: vi.fn(),
  };
  vi.doMock('../../src/lib/apiErrorHandler.js', () => ({ default: apiErrorHandler }));

  const embeddableServices = {
    getServiceManifest: vi.fn(async () => ({ name: 'service-manifest' })),
  };
  vi.doMock('../../src/service/embeddableServices.js', () => ({ default: embeddableServices }));

  const manifestService = {
    getManifest: vi.fn(async () => ({
      serverUrl: 'https://server.example',
      author: { name: 'CRM Author' },
    })),
    saveManifestUrl: vi.fn(async () => {}),
  };
  vi.doMock('../../src/service/manifestService.js', () => manifestService);

  const platformService = {
    getPlatformInfo: vi.fn(async () => ({ platformName: 'salesforce' })),
  };
  vi.doMock('../../src/service/platformService.js', () => platformService);

  const logRecorder = {
    isRecordingLogs: vi.fn(async () => false),
    logAction: vi.fn(),
  };
  vi.doMock('../../src/lib/logRecorder.js', () => ({ default: logRecorder }));

  const i18n = {
    restoreLocale: vi.fn(),
  };
  vi.doMock('../../src/i18n/index.js', () => ({ default: i18n }));

  const eventHandlers = {};
  for (const [name, modulePath] of Object.entries(eventHandlerModules)) {
    vi.doMock(modulePath, () => {
      eventHandlers[name] = {
        onEvent: vi.fn(async () => {}),
      };
      return { default: eventHandlers[name] };
    });
  }

  const messageHandlers = {};
  for (const [name, modulePath] of Object.entries(messageHandlerModules)) {
    vi.doMock(modulePath, () => {
      messageHandlers[name] = {
        onMessage: vi.fn(async () => {}),
      };
      return { default: messageHandlers[name] };
    });
  }

  const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  await loadModule('../../src/popup.js');
  await Promise.resolve();
  await Promise.resolve();

  const messageListener = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === 'message')?.[1];
  const runtimeMessageListener = chrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
  const storageChangeListener = chrome.storage.onChanged.addListener.mock.calls[0]?.[0];
  const crmAuthCacheClearedHandler = apiErrorHandler.registerCrmAuthCacheClearedHandler.mock.calls[0]?.[0];

  return {
    axiosMock,
    requestInterceptors,
    responseInterceptors,
    util,
    analytics,
    authCore,
    apiErrorHandler,
    embeddableServices,
    manifestService,
    platformService,
    logRecorder,
    i18n,
    eventHandlers,
    messageHandlers,
    messageListener,
    runtimeMessageListener,
    storageChangeListener,
    crmAuthCacheClearedHandler,
  };
}

describe('popup runtime', () => {
  beforeEach(() => {
    seedStorage({
      customCrmManifestUrl: 'https://manifest.example/custom.json',
      rcUnifiedCrmExtJwt: 'stored-token',
    });
  });

  it('initializes manifest state, registers listeners, and refreshes service manifest on auth cache changes', async () => {
    const runtime = await loadPopupRuntime();

    expect(runtime.axiosMock.defaults.timeout).toBe(30000);
    expect(window.__ON_RC_POPUP_WINDOW).toBe(1);
    expect(runtime.authCore.syncCrmAuthedFromStorage).toHaveBeenCalled();
    expect(runtime.i18n.restoreLocale).toHaveBeenCalled();
    expect(runtime.util.checkC2DCollision).toHaveBeenCalled();
    expect(runtime.manifestService.saveManifestUrl).toHaveBeenCalledWith({
      manifestUrl: 'https://manifest.example/custom.json',
    });
    expect(runtime.analytics.setAuthor).toHaveBeenCalledWith('CRM Author');
    expect(runtime.axiosMock.get).toHaveBeenCalledWith('https://server.example/implementedInterfaces?platform=salesforce');
    expect(readStorage().implementedInterfaces).toEqual({ findContactWithName: true });

    await runtime.crmAuthCacheClearedHandler();
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: { name: 'service-manifest' },
      },
      targetOrigin: '*',
    });

    await runtime.storageChangeListener({
      rcUnifiedCrmExtJwt: { newValue: 'new-token' },
    }, 'local');
    expect(runtime.authCore.syncCrmAuthedFromStorage).toHaveBeenCalledTimes(2);
    expect(runtime.embeddableServices.getServiceManifest).toHaveBeenCalledTimes(2);

    await runtime.storageChangeListener({
      crmAuthed: { newValue: true },
    }, 'sync');
    expect(runtime.embeddableServices.getServiceManifest).toHaveBeenCalledTimes(2);
  });

  it('adds authorization, strips jwtToken query params, logs axios traffic, and handles refreshed tokens', async () => {
    const runtime = await loadPopupRuntime();
    runtime.logRecorder.isRecordingLogs.mockResolvedValue(true);

    const request = await runtime.requestInterceptors[0].fulfilled({
      url: '/records?jwtToken=url-token&search=Jane',
      baseURL: 'https://api.example',
      method: 'get',
      params: { page: 1 },
      data: { sample: true },
    });
    expect(request.url).toBe('https://api.example/records?search=Jane');
    expect(request.headers.Authorization).toBe('Bearer url-token');
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'API_REQUEST',
    }));

    const skipped = await runtime.requestInterceptors[0].fulfilled({
      url: '/public',
      skipAuthorization: true,
    });
    expect(skipped.headers).toBeUndefined();

    await expect(runtime.requestInterceptors[0].rejected(new Error('request failed'))).rejects.toThrow('request failed');
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'API_REQUEST_ERROR',
    }));

    await expect(runtime.responseInterceptors[0].fulfilled({
      headers: {
        'x-refreshed-jwt-token': 'fresh-token',
      },
      config: {
        url: '/records',
      },
      status: 200,
      statusText: 'OK',
      data: { ok: true },
    })).resolves.toMatchObject({
      status: 200,
    });
    expect(readStorage().rcUnifiedCrmExtJwt).toBe('fresh-token');
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'API_RESPONSE',
    }));

    const authError = new Error('unauthorized');
    authError.config = {
      url: '/records?jwtToken=expired',
      headers: { Authorization: 'Bearer expired' },
    };
    authError.response = {
      status: 401,
      statusText: 'Unauthorized',
      data: { error: 'invalid' },
      headers: {
        'X-Refreshed-Jwt-Token': 'error-fresh-token',
      },
    };
    await expect(runtime.responseInterceptors[0].rejected(authError)).rejects.toThrow('unauthorized');
    expect(runtime.apiErrorHandler.handleApiError).toHaveBeenCalledWith(authError);
    expect(runtime.authCore.clearLocalCrmAuthState).toHaveBeenCalled();
    expect(readStorage().rcUnifiedCrmExtJwt).toBe('error-fresh-token');
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'API_RESPONSE_ERROR',
    }));
  });

  it('routes embeddable window messages and records selected message events', async () => {
    const runtime = await loadPopupRuntime();
    runtime.logRecorder.isRecordingLogs.mockResolvedValue(true);

    const messageRoutes = [
      ['rc-telephony-session-notify', 'rcTelephonySessionNotify'],
      ['rc-calling-settings-notify', 'rcCallingSettingsNotify'],
      ['rc-region-settings-notify', 'rcRegionSettingsNotify'],
      ['rc-adapter-side-drawer-open-notify', 'rcAdapterSideDrawerOpenNotify'],
      ['rc-dialer-status-notify', 'rcDialerStatusNotify'],
      ['rc-webphone-connection-status-notify', 'rcWebphoneConnectionStatusNotify'],
      ['rc-adapter-pushAdapterState', 'rcAdapterPushAdapterState'],
      ['rc-login-status-notify', 'rcLoginStatusNotify'],
      ['rc-login-popup-notify', 'rcLoginPopupNotify'],
      ['rc-call-init-notify', 'rcCallInitNotify'],
      ['rc-call-start-notify', 'rcCallStartNotify'],
      ['rc-ringout-call-notify', 'rcRingoutCallNotify'],
      ['rc-active-call-notify', 'rcActiveCallNotify'],
      ['rc-analytics-track', 'rcAnalyticsTrackNotify'],
      ['rc-callLogger-auto-log-notify', 'rcCallLoggerAutoLogNotify'],
      ['rc-messageLogger-auto-log-notify', 'rcMessageLoggerAutoLogNotify'],
      ['rc-route-changed-notify', 'rcRouteChangedNotify'],
      ['rc-adapter-ai-assistant-settings-notify', 'rcAdapterAiAssistantSettingsNotify'],
      ['rc-post-message-request', 'rcPostMessageRequest'],
      ['rc-adapter-phone-number-format-settings-notify', 'rcAdapterPhoneNumberFormatSettingsNotify'],
    ];

    for (const [type, handlerName] of messageRoutes) {
      await runtime.messageListener({ data: { type, path: '/settings' } });
      expect(runtime.eventHandlers[handlerName].onEvent).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type }),
      }));
    }

    await runtime.messageListener({ data: { type: 'rc-post-message-request', path: '/callLogger/inputChanged' } });
    await runtime.messageListener({ data: { type: 'unknown-message' } });

    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'rc-login-status-notify',
    }));
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'rc-post-message-request',
    }));
  });

  it('handles window message errors with notifications, timeout warnings, generic logging, and auth navigation', async () => {
    const runtime = await loadPopupRuntime();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const returnMessageError = new Error('server failed');
    returnMessageError.response = {
      status: 500,
      data: {
        returnMessage: {
          level: 'warning',
          message: 'Server failed',
          ttl: 5000,
        },
      },
    };
    runtime.eventHandlers.rcLoginPopupNotify.onEvent.mockRejectedValueOnce(returnMessageError);
    await runtime.messageListener({ data: { type: 'rc-login-popup-notify' } });
    expect(runtime.util.showNotification).toHaveBeenCalledWith(returnMessageError.response.data.returnMessage);

    runtime.eventHandlers.rcCallInitNotify.onEvent.mockRejectedValueOnce(new Error('request timeout'));
    await runtime.messageListener({ data: { type: 'rc-call-init-notify' } });
    expect(runtime.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Timeout',
      ttl: 5000,
    });

    runtime.eventHandlers.rcCallStartNotify.onEvent.mockRejectedValueOnce(new Error('plain failure'));
    await runtime.messageListener({ data: { type: 'rc-call-start-notify' } });
    expect(console.error).toHaveBeenCalledWith(expect.any(Error));

    const unauthorized = new Error('unauthorized');
    unauthorized.response = {
      status: 401,
      data: {},
    };
    runtime.eventHandlers.rcRingoutCallNotify.onEvent.mockRejectedValueOnce(unauthorized);
    await runtime.messageListener({ data: { type: 'rc-ringout-call-notify' } });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/settings',
      },
      targetOrigin: '*',
    });
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
  });

  it('routes extension runtime messages and logs supported request types', async () => {
    const runtime = await loadPopupRuntime();
    runtime.logRecorder.isRecordingLogs.mockResolvedValue(true);

    const sendResponse = vi.fn();
    for (const [type, handlerName] of [
      ['oauthCallBack', 'oauthCallBack'],
      ['pipedriveCallbackUri', 'pipedriveCallbackUri'],
      ['c2sms', 'c2sms'],
      ['c2d', 'c2d'],
      ['c2schedule', 'c2schedule'],
      ['navigate', 'navigate'],
      ['insightlyAuth', 'insightlyAuth'],
      ['ringsenseRefTrack', 'ringsenseRefTrack'],
      ['controlCall', 'controlCall'],
    ]) {
      await runtime.runtimeMessageListener({ type }, {}, sendResponse);
      expect(runtime.messageHandlers[handlerName].onMessage).toHaveBeenCalledWith({
        request: { type },
        sendResponse,
      });
    }
    await runtime.runtimeMessageListener({ type: 'unknown' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'oauthCallBack',
    }));
    expect(runtime.logRecorder.logAction).not.toHaveBeenCalledWith(expect.objectContaining({
      name: 'ringsenseRefTrack',
    }));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    runtime.messageHandlers.navigate.onMessage.mockRejectedValueOnce(new Error('navigation failed'));
    await runtime.runtimeMessageListener({ type: 'navigate' }, {}, sendResponse);
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
  });
});
