import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const eventHandlerModules = {
  rcTelephonySessionNotify: '../../src/eventHandlers/rc-telephony-session-notify.ts',
  rcCallingSettingsNotify: '../../src/eventHandlers/rc-calling-settings-notify.ts',
  rcRegionSettingsNotify: '../../src/eventHandlers/rc-region-settings-notify.ts',
  rcAdapterSideDrawerOpenNotify: '../../src/eventHandlers/rc-adapter-side-drawer-open-notify.ts',
  rcDialerStatusNotify: '../../src/eventHandlers/rc-dialer-status-notify.ts',
  rcWebphoneConnectionStatusNotify: '../../src/eventHandlers/rc-webphone-connection-status-notify.ts',
  rcAdapterPushAdapterState: '../../src/eventHandlers/rc-adapter-pushAdapterState.ts',
  rcLoginStatusNotify: '../../src/eventHandlers/rc-login-status-notify.ts',
  rcLoginPopupNotify: '../../src/eventHandlers/rc-login-popup-notify.ts',
  rcCallInitNotify: '../../src/eventHandlers/rc-call-init-notify.ts',
  rcCallStartNotify: '../../src/eventHandlers/rc-call-start-notify.ts',
  rcRingoutCallNotify: '../../src/eventHandlers/rc-ringout-call-notify.ts',
  rcActiveCallNotify: '../../src/eventHandlers/rc-active-call-notify.ts',
  rcAnalyticsTrackNotify: '../../src/eventHandlers/rc-analytics-track.ts',
  rcCallLoggerAutoLogNotify: '../../src/eventHandlers/rc-callLogger-auto-log-notify.ts',
  rcMessageLoggerAutoLogNotify: '../../src/eventHandlers/rc-messageLogger-auto-log-notify.ts',
  rcRouteChangedNotify: '../../src/eventHandlers/rc-route-changed-notify.ts',
  rcAdapterAiAssistantSettingsNotify: '../../src/eventHandlers/rc-adapter-ai-assistant-settings-notify.ts',
  rcPostMessageRequest: '../../src/eventHandlers/rc-post-message-request/index.ts',
  rcAdapterPhoneNumberFormatSettingsNotify: '../../src/eventHandlers/rc-adapter-phone-number-format-settings-notify.ts',
};

const messageHandlerModules = {
  oauthCallBack: '../../src/messageHandlers/oauthCallBack.ts',
  pipedriveCallbackUri: '../../src/messageHandlers/pipedriveCallbackUri.ts',
  c2sms: '../../src/messageHandlers/c2sms.ts',
  c2d: '../../src/messageHandlers/c2d.ts',
  c2schedule: '../../src/messageHandlers/c2schedule.ts',
  navigate: '../../src/messageHandlers/navigate.ts',
  insightlyAuth: '../../src/messageHandlers/insightlyAuth.ts',
  ringsenseRefTrack: '../../src/messageHandlers/ringsenseRefTrack.ts',
  controlCall: '../../src/messageHandlers/controlCall.ts',
};

type EventHandlerName = keyof typeof eventHandlerModules;
type MessageHandlerName = keyof typeof messageHandlerModules;

type PopupRuntimeOptions = {
  implementedInterfaces?: Record<string, unknown> | null;
  manifest?: {
    serverUrl?: string;
    author?: { name: string };
  } | null;
  platformInfo?: { platformName: string } | null;
  serviceManifest?: unknown;
};

function createEventHandlerMock() {
  return {
    onEvent: vi.fn(async (_event?: unknown) => {}),
  };
}

function createMessageHandlerMock() {
  return {
    onMessage: vi.fn(async (_message?: unknown) => {}),
  };
}

type EventHandlerMock = ReturnType<typeof createEventHandlerMock>;
type MessageHandlerMock = ReturnType<typeof createMessageHandlerMock>;
type PopupMessageListener = (event: { data: unknown }) => Promise<void>;

type MockHttpError = Error & {
  config?: {
    url?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    skipAuthorization?: boolean;
  };
  response?: {
    status: number;
    statusText?: string;
    data: Record<string, any>;
    headers?: Record<string, string>;
  };
};

function mockHttpError(message: string): MockHttpError {
  return new Error(message) as MockHttpError;
}

function getPopupMessageListener(
  listener: EventListenerOrEventListenerObject | undefined,
): PopupMessageListener {
  if (typeof listener !== 'function') {
    throw new Error('Popup message listener was not registered');
  }
  return ({ data }) => Promise.resolve(listener(new MessageEvent('message', { data })));
}

async function loadPopupRuntime(options: PopupRuntimeOptions = {}) {
  vi.resetModules();
  const {
    implementedInterfaces = { findContactWithName: true },
    manifest = {
      serverUrl: 'https://server.example',
      author: { name: 'CRM Author' },
    },
    platformInfo = { platformName: 'salesforce' },
    serviceManifest = { name: 'service-manifest' },
  } = options;

  const requestInterceptors = [];
  const responseInterceptors = [];
  const axiosDefaults: { timeout?: number } = {};
  const axiosMock = {
    defaults: axiosDefaults,
    get: vi.fn(async () => ({ data: implementedInterfaces })),
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
  vi.doMock('../../src/lib/util.ts', () => util);

  const analytics = {
    setAuthor: vi.fn(),
  };
  vi.doMock('../../src/lib/analytics.ts', () => analytics);

  const authCore = {
    syncCrmAuthedFromStorage: vi.fn(async () => {}),
    clearLocalCrmAuthState: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/auth.ts', () => ({ default: authCore }));

  const apiErrorHandler = {
    handleApiError: vi.fn(async () => {}),
    registerCrmAuthCacheClearedHandler: vi.fn(),
  };
  vi.doMock('../../src/lib/apiErrorHandler.ts', () => ({ default: apiErrorHandler }));

  const embeddableServices = {
    getServiceManifest: vi.fn(async () => serviceManifest),
  };
  vi.doMock('../../src/service/embeddableServices.ts', () => ({ default: embeddableServices }));

  const manifestService = {
    getManifest: vi.fn(async () => manifest),
    saveManifestUrl: vi.fn(async () => {}),
  };
  vi.doMock('../../src/service/manifestService.ts', () => manifestService);

  const platformService = {
    getPlatformInfo: vi.fn(async () => platformInfo),
  };
  vi.doMock('../../src/service/platformService.ts', () => platformService);

  const logRecorder = {
    isRecordingLogs: vi.fn(async () => false),
    logAction: vi.fn(),
  };
  vi.doMock('../../src/lib/logRecorder.ts', () => ({ default: logRecorder }));

  const i18n = {
    restoreLocale: vi.fn(),
  };
  vi.doMock('../../src/i18n/index.ts', () => ({ default: i18n }));

  const eventHandlers: Partial<Record<EventHandlerName, EventHandlerMock>> = {};
  for (const name of Object.keys(eventHandlerModules) as EventHandlerName[]) {
    const modulePath = eventHandlerModules[name];
    vi.doMock(modulePath, () => {
      const handler = createEventHandlerMock();
      eventHandlers[name] = handler;
      return { default: handler };
    });
  }

  const messageHandlers: Partial<Record<MessageHandlerName, MessageHandlerMock>> = {};
  for (const name of Object.keys(messageHandlerModules) as MessageHandlerName[]) {
    const modulePath = messageHandlerModules[name];
    vi.doMock(modulePath, () => {
      const handler = createMessageHandlerMock();
      messageHandlers[name] = handler;
      return { default: handler };
    });
  }

  const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  await loadModule('../../src/popup.ts');
  await Promise.resolve();
  await Promise.resolve();

  const messageListener = getPopupMessageListener(
    addEventListenerSpy.mock.calls.find(([eventName]) => eventName === 'message')?.[1],
  );
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

  it('initializes without custom manifest URL, author, platform info, or implemented interfaces', async () => {
    await chrome.storage.local.clear();
    seedStorage({ rcUnifiedCrmExtJwt: 'stored-token' });

    const runtime = await loadPopupRuntime({
      manifest: { serverUrl: 'https://server.example' },
      platformInfo: null,
    });

    expect(runtime.manifestService.saveManifestUrl).not.toHaveBeenCalled();
    expect(runtime.analytics.setAuthor).toHaveBeenCalledWith('');
    expect(runtime.axiosMock.get).not.toHaveBeenCalled();
    expect(readStorage().implementedInterfaces).toBeUndefined();
  });

  it('initializes when manifest lookup returns nothing', async () => {
    await chrome.storage.local.clear();
    const runtime = await loadPopupRuntime({
      manifest: null,
      platformInfo: null,
    });

    expect(runtime.manifestService.saveManifestUrl).not.toHaveBeenCalled();
    expect(runtime.analytics.setAuthor).not.toHaveBeenCalled();
    expect(runtime.axiosMock.get).not.toHaveBeenCalled();
  });

  it('skips implemented interface storage when the server returns no data', async () => {
    const runtime = await loadPopupRuntime({
      implementedInterfaces: null,
    });

    expect(runtime.axiosMock.get).toHaveBeenCalledWith('https://server.example/implementedInterfaces?platform=salesforce');
    expect(readStorage().implementedInterfaces).toBeUndefined();
  });

  it('adds authorization from jwtToken query params and logs API requests', async () => {
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
    expect(request.params).toEqual({ page: 1 });
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'API_REQUEST',
    }));
  });

  it('moves jwtToken axios params into authorization before the request is sent', async () => {
    const runtime = await loadPopupRuntime();

    const request = await runtime.requestInterceptors[0].fulfilled({
      url: '/records',
      baseURL: 'https://api.example',
      method: 'get',
      params: {
        jwtToken: 'params-token',
        search: 'Jane',
      },
    });

    expect(request.url).toBe('/records');
    expect(request.params).toEqual({ search: 'Jane' });
    expect(request.headers.Authorization).toBe('Bearer params-token');
  });

  it('handles URLSearchParams tokens, malformed URLs, and existing auth headers', async () => {
    const runtime = await loadPopupRuntime();

    const relativeUrlRequest = await runtime.requestInterceptors[0].fulfilled({
      url: '/records?jwtToken=relative-token&search=Jane',
      params: new URLSearchParams('search=Jane'),
      headers: {},
    });
    expect(relativeUrlRequest.url).toBe('/records?search=Jane');
    expect(relativeUrlRequest.params.get('search')).toBe('Jane');
    expect(relativeUrlRequest.headers.Authorization).toBe('Bearer relative-token');

    const searchParamsRequest = await runtime.requestInterceptors[0].fulfilled({
      url: '/records',
      baseURL: 'https://api.example',
      params: new URLSearchParams('jwtToken=params-token&search=Jane'),
      headers: {},
    });
    expect(searchParamsRequest.params.get('jwtToken')).toBeNull();
    expect(searchParamsRequest.params.get('search')).toBe('Jane');
    expect(searchParamsRequest.headers.Authorization).toBe('Bearer params-token');

    const existingHeaderRequest = await runtime.requestInterceptors[0].fulfilled({
      url: '/records',
      params: { search: 'Jane' },
      headers: {
        authorization: 'Bearer existing-token',
      },
    });
    expect(existingHeaderRequest.headers.authorization).toBe('Bearer existing-token');
    expect(existingHeaderRequest.headers.Authorization).toBeUndefined();

    const malformedUrlRequest = await runtime.requestInterceptors[0].fulfilled({
      url: 'http://[bad',
      params: ['not', 'an', 'object'],
      headers: {},
    });
    expect(malformedUrlRequest.url).toBe('http://[bad');
    expect(malformedUrlRequest.params).toEqual(['not', 'an', 'object']);
    expect(malformedUrlRequest.headers.Authorization).toBe('Bearer stored-token');
  });

  it('keeps request inputs unchanged when no JWT is available', async () => {
    const runtime = await loadPopupRuntime();
    await chrome.storage.local.set({ rcUnifiedCrmExtJwt: null });

    const request = await runtime.requestInterceptors[0].fulfilled({
      url: '/records',
      params: new URLSearchParams('search=Jane'),
      headers: {},
    });

    expect(request.url).toBe('/records');
    expect(request.params.get('search')).toBe('Jane');
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('skips authorization when a request opts out', async () => {
    const runtime = await loadPopupRuntime();
    const skipped = await runtime.requestInterceptors[0].fulfilled({
      url: '/public',
      skipAuthorization: true,
    });
    expect(skipped.headers).toBeUndefined();
  });

  it('uses stored JWT authorization when request token inputs are absent', async () => {
    const runtime = await loadPopupRuntime();

    const request = await runtime.requestInterceptors[0].fulfilled({
      url: undefined,
      params: null,
      headers: {},
    });

    expect(request.url).toBeUndefined();
    expect(request.params).toBeNull();
    expect(request.headers.Authorization).toBe('Bearer stored-token');
  });

  it('logs request interceptor errors before rethrowing', async () => {
    const runtime = await loadPopupRuntime();
    runtime.logRecorder.isRecordingLogs.mockResolvedValue(true);

    await expect(runtime.requestInterceptors[0].rejected(new Error('request failed'))).rejects.toThrow('request failed');
    expect(runtime.logRecorder.logAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'API_REQUEST_ERROR',
    }));
  });

  it('rethrows request interceptor errors without logging when recording is disabled', async () => {
    const runtime = await loadPopupRuntime();

    await expect(runtime.requestInterceptors[0].rejected(new Error('request failed'))).rejects.toThrow('request failed');
    expect(runtime.logRecorder.logAction).not.toHaveBeenCalled();
  });

  it('stores refreshed JWT tokens from successful responses and logs API responses', async () => {
    const runtime = await loadPopupRuntime();
    runtime.logRecorder.isRecordingLogs.mockResolvedValue(true);

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
  });

  it('leaves JWT storage unchanged when responses have no refreshed token', async () => {
    const runtime = await loadPopupRuntime();

    await expect(runtime.responseInterceptors[0].fulfilled({
      headers: {},
      config: {
        url: '/records',
      },
      status: 204,
      statusText: 'No Content',
      data: null,
    })).resolves.toMatchObject({
      status: 204,
    });

    expect(readStorage().rcUnifiedCrmExtJwt).toBe('stored-token');
  });

  it('handles response errors, clears CRM auth on 401, and stores refreshed error tokens', async () => {
    const runtime = await loadPopupRuntime();
    runtime.logRecorder.isRecordingLogs.mockResolvedValue(true);
    const authError = mockHttpError('unauthorized');

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

  it('does not clear CRM auth for guarded 401 response errors', async () => {
    const runtime = await loadPopupRuntime();

    for (const config of [
      {
        url: '/unAuthorize?jwtToken=expired',
        headers: { Authorization: 'Bearer expired' },
      },
      {
        url: '/records?jwtToken=expired',
        headers: { Authorization: 'Bearer expired' },
        skipAuthorization: true,
      },
      {
        url: '/records',
        headers: {},
      },
      {
        url: '/records',
        baseURL: 'https://api.example',
        headers: {},
      },
    ]) {
      const error = mockHttpError('unauthorized');
      error.config = config;
      error.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'invalid' },
      };
      await expect(runtime.responseInterceptors[0].rejected(error)).rejects.toThrow('unauthorized');
    }

    expect(runtime.authCore.clearLocalCrmAuthState).not.toHaveBeenCalled();
  });

  it('does not clear CRM auth for non-401 response errors', async () => {
    const runtime = await loadPopupRuntime();
    const error = mockHttpError('server failed');
    error.config = {
      url: '/records?jwtToken=expired',
      headers: { Authorization: 'Bearer expired' },
    };
    error.response = {
      status: 500,
      statusText: 'Server Error',
      data: { error: 'failed' },
    };

    await expect(runtime.responseInterceptors[0].rejected(error)).rejects.toThrow('server failed');

    expect(runtime.authCore.clearLocalCrmAuthState).not.toHaveBeenCalled();
  });

  it('refreshes service manifest on local CRM auth changes without forcing JWT sync', async () => {
    const runtime = await loadPopupRuntime();
    runtime.authCore.syncCrmAuthedFromStorage.mockClear();
    runtime.embeddableServices.getServiceManifest.mockClear();

    await runtime.storageChangeListener({
      crmAuthed: { newValue: false },
    }, 'local');

    expect(runtime.authCore.syncCrmAuthedFromStorage).not.toHaveBeenCalled();
    expect(runtime.embeddableServices.getServiceManifest).toHaveBeenCalledTimes(1);
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-register-third-party-service',
        service: { name: 'service-manifest' },
      },
      targetOrigin: '*',
    });
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
    ] as const;

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

    const returnMessageError = mockHttpError('server failed');
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

    const unauthorized = mockHttpError('unauthorized');
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
    ] as const) {
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

  it('skips message recording when log recording is disabled', async () => {
    const runtime = await loadPopupRuntime();
    const sendResponse = vi.fn();

    await runtime.messageListener({ data: { type: 'rc-login-status-notify' } });
    for (const type of [
      'rc-active-call-notify',
      'rc-analytics-track',
      'rc-callLogger-auto-log-notify',
      'rc-messageLogger-auto-log-notify',
      'rc-route-changed-notify',
      'rc-adapter-phone-number-format-settings-notify',
    ]) {
      await runtime.messageListener({ data: { type } });
    }
    await runtime.messageListener({ data: null });

    await runtime.runtimeMessageListener({ type: 'oauthCallBack' }, {}, sendResponse);
    for (const type of [
      'pipedriveCallbackUri',
      'c2sms',
      'c2d',
      'c2schedule',
      'navigate',
      'insightlyAuth',
    ]) {
      await runtime.runtimeMessageListener({ type }, {}, sendResponse);
    }

    expect(runtime.eventHandlers.rcLoginStatusNotify.onEvent).toHaveBeenCalled();
    expect(runtime.messageHandlers.oauthCallBack.onMessage).toHaveBeenCalled();
    expect(runtime.messageHandlers.insightlyAuth.onMessage).toHaveBeenCalled();
    expect(runtime.logRecorder.logAction).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('treats 404 return-message event errors as generic errors', async () => {
    const runtime = await loadPopupRuntime();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const notFound = mockHttpError('not found');
    notFound.response = {
      status: 404,
      data: {
        returnMessage: {
          level: 'warning',
          message: 'Not found',
        },
      },
    };

    runtime.eventHandlers.rcLoginPopupNotify.onEvent.mockRejectedValueOnce(notFound);
    await runtime.messageListener({ data: { type: 'rc-login-popup-notify' } });

    expect(runtime.util.showNotification).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(notFound);
  });
});
