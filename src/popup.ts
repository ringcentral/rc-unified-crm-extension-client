import { checkC2DCollision, showNotification } from './lib/util';
import { setAuthor } from './lib/analytics';
import axios from 'axios';
import authCore from './core/auth';
import apiErrorHandler from './lib/apiErrorHandler';
import embeddableServices from './service/embeddableServices';
import { getManifest as getManifestBase } from './service/manifestService';
import { saveManifestUrl } from './service/manifestService';
import { getPlatformInfo } from './service/platformService';
import logRecorder from './lib/logRecorder';
import i18n from './i18n';

// event handlers
import rcTelephonySessionNotifyHandler from './eventHandlers/rc-telephony-session-notify';
import rcCallingSettingsNotifyHandler from './eventHandlers/rc-calling-settings-notify';
import rcRegionSettingsNotifyHandler from './eventHandlers/rc-region-settings-notify';
import rcAdapterSideDrawerOpenNotifyHandler from './eventHandlers/rc-adapter-side-drawer-open-notify';
import rcDialerStatusNotifyHandler from './eventHandlers/rc-dialer-status-notify';
import rcWebphoneConnectionStatusNotifyHandler from './eventHandlers/rc-webphone-connection-status-notify';
import rcAdapterPushAdapterStateHandler from './eventHandlers/rc-adapter-pushAdapterState';
import rcLoginStatusNotifyHandler from './eventHandlers/rc-login-status-notify';
import rcLoginPopupNotifyHandler from './eventHandlers/rc-login-popup-notify';
import rcCallInitNotifyHandler from './eventHandlers/rc-call-init-notify';
import rcCallStartNotifyHandler from './eventHandlers/rc-call-start-notify';
import rcRingoutCallNotifyHandler from './eventHandlers/rc-ringout-call-notify';
import rcActiveCallNotifyHandler from './eventHandlers/rc-active-call-notify';
import rcAnalyticsTrackNotifyHandler from './eventHandlers/rc-analytics-track';
import rcCallLoggerAutoLogNotifyHandler from './eventHandlers/rc-callLogger-auto-log-notify';
import rcMessageLoggerAutoLogNotifyHandler from './eventHandlers/rc-messageLogger-auto-log-notify';
import rcRouteChangedNotifyHandler from './eventHandlers/rc-route-changed-notify';
import rcAdapterAiAssistantSettingsNotifyHandler from './eventHandlers/rc-adapter-ai-assistant-settings-notify';
import rcPostMessageRequestHandler from './eventHandlers/rc-post-message-request';
import rcAdapterPhoneNumberFormatSettingsNotifyHandler from './eventHandlers/rc-adapter-phone-number-format-settings-notify';
import { syncLocaleToEmbeddableWhenReady } from './lib/embeddableLocale';

// message handlers
import oauthCallBackHandler from './messageHandlers/oauthCallBack';
import pipedriveCallbackUriHandler from './messageHandlers/pipedriveCallbackUri';
import c2smsHandler from './messageHandlers/c2sms';
import c2dHandler from './messageHandlers/c2d';
import c2scheduleHandler from './messageHandlers/c2schedule';
import navigateHandler from './messageHandlers/navigate';
import insightlyAuthHandler from './messageHandlers/insightlyAuth';
import ringsenseRefTrackHandler from './messageHandlers/ringsenseRefTrack';
import controlCallHandler from './messageHandlers/controlCall';

type UnknownRecord = Record<string, any>;

const chromeStorageLocal = chrome.storage.local as any;

async function getManifest(): Promise<UnknownRecord> {
  return (await getManifestBase()) as UnknownRecord;
}

function getWidgetFrame(): UnknownRecord {
  return document.querySelector('#rc-widget-adapter-frame') as UnknownRecord;
}

const popupContext = {
  transferOnHold: ''
};

let isLoggingOut = false;

function extractJwtTokenFromUrl(url, baseURL) {
  if (!url || typeof url !== 'string') {
    return { sanitizedUrl: url, jwtToken: null };
  }
  try {
    const isAbsoluteUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url);
    const base = baseURL || window.location.origin;
    const parsed = new URL(url, base);
    const jwtToken = parsed.searchParams.get('jwtToken');
    if (!jwtToken) {
      return { sanitizedUrl: url, jwtToken: null };
    }
    parsed.searchParams.delete('jwtToken');
    const sanitizedUrl = (isAbsoluteUrl || baseURL) ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return { sanitizedUrl, jwtToken };
  } catch {
    return { sanitizedUrl: url, jwtToken: null };
  }
}

function extractJwtTokenFromParams(params) {
  if (!params) {
    return { sanitizedParams: params, jwtToken: null };
  }
  if (params instanceof URLSearchParams) {
    const jwtToken = params.get('jwtToken');
    if (!params.has('jwtToken')) {
      return { sanitizedParams: params, jwtToken: null };
    }
    const sanitizedParams = new URLSearchParams(params);
    sanitizedParams.delete('jwtToken');
    return { sanitizedParams, jwtToken };
  }
  if (typeof params === 'object' && !Array.isArray(params)) {
    if (!Object.prototype.hasOwnProperty.call(params, 'jwtToken')) {
      return { sanitizedParams: params, jwtToken: null };
    }
    const { jwtToken, ...sanitizedParams } = params;
    return { sanitizedParams, jwtToken };
  }
  return { sanitizedParams: params, jwtToken: null };
}

async function persistRefreshedJwtToken(headers) {
  const refreshedToken = headers?.['x-refreshed-jwt-token'] || headers?.['X-Refreshed-Jwt-Token'];
  if (refreshedToken) {
    await chrome.storage.local.set({ rcUnifiedCrmExtJwt: refreshedToken });
  }
}

axios.defaults.timeout = 30000; // Set default timeout to 30 seconds, can be overriden with server manifest
// Add request interceptor
axios.interceptors.request.use(
  async (config) => {
    const requestConfig = config as UnknownRecord;
    const { sanitizedUrl, jwtToken: tokenFromUrl } = extractJwtTokenFromUrl(requestConfig.url, requestConfig.baseURL);
    const { sanitizedParams, jwtToken: tokenFromParams } = extractJwtTokenFromParams(requestConfig.params);
    if (tokenFromUrl) {
      requestConfig.url = sanitizedUrl;
    }
    if (tokenFromParams !== null) {
      requestConfig.params = sanitizedParams;
    }
    if (!requestConfig.skipAuthorization) {
      const { rcUnifiedCrmExtJwt } = await chromeStorageLocal.get({ rcUnifiedCrmExtJwt: null });
      const tokenToUse = tokenFromUrl || tokenFromParams || rcUnifiedCrmExtJwt;
      if (tokenToUse) {
        requestConfig.headers = requestConfig.headers || {};
        if (!requestConfig.headers.Authorization && !requestConfig.headers.authorization) {
          requestConfig.headers.Authorization = `Bearer ${tokenToUse}`;
        }
      }
    }
    if (await logRecorder.isRecordingLogs()) {
      logRecorder.logAction({
        name: 'API_REQUEST',
        data: {
          method: requestConfig.method,
          url: requestConfig.url,
          params: requestConfig.params,
          data: requestConfig.data,
          headers: requestConfig.headers
        }
      });
    }
    return requestConfig as any;
  },
  async (error) => {
    if (await logRecorder.isRecordingLogs()) {
      logRecorder.logAction({
        name: 'API_REQUEST_ERROR',
        data: { error: error.message }
      });
    }
    return Promise.reject(error);
  }
);

// Add response interceptor
axios.interceptors.response.use(
  async (response) => {
    await persistRefreshedJwtToken(response.headers);
    if (await logRecorder.isRecordingLogs()) {
      logRecorder.logAction({
        name: 'API_RESPONSE',
        data: {
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          data: response.data
        }
      });
    }
    return response;
  },
  async (error) => {
    await persistRefreshedJwtToken(error.response?.headers);
    if (await logRecorder.isRecordingLogs()) {
      logRecorder.logAction({
        name: 'API_RESPONSE_ERROR',
        data: {
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        }
      });
    }
    await apiErrorHandler.handleApiError(error);
    if (error.response?.status === 401 && !isLoggingOut) {
      const url = error.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config?.url || '';
      const hasBearerHeader = !!(error.config?.headers?.Authorization || error.config?.headers?.authorization);
      if ((url.includes('jwtToken=') || hasBearerHeader) && !url.includes('/unAuthorize') && !(error.config as UnknownRecord)?.skipAuthorization) {
        isLoggingOut = true;
        try {
          await authCore.clearLocalCrmAuthState();
        } finally {
          isLoggingOut = false;
        }
      }
    }
    return Promise.reject(error);
  }
);

window.__ON_RC_POPUP_WINDOW = 1;

apiErrorHandler.registerCrmAuthCacheClearedHandler(async () => {
  const adapterFrame = getWidgetFrame();
  if (adapterFrame?.contentWindow) {
    const serviceManifest = await embeddableServices.getServiceManifest();
    adapterFrame.contentWindow.postMessage({
      type: 'rc-adapter-register-third-party-service',
      service: serviceManifest
    }, '*');
  }
});

authCore.syncCrmAuthedFromStorage();

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') {
    return;
  }
  if (changes.rcUnifiedCrmExtJwt?.newValue) {
    await authCore.syncCrmAuthedFromStorage();
  }
  if (changes.rcUnifiedCrmExtJwt || changes.crmAuthed) {
    const adapterFrame = getWidgetFrame();
    if (adapterFrame?.contentWindow) {
      const serviceManifest = await embeddableServices.getServiceManifest();
      adapterFrame.contentWindow.postMessage({
        type: 'rc-adapter-register-third-party-service',
        service: serviceManifest
      }, '*');
    }
  }
});

initializePopup();

async function initializePopup() {
  // Initialize i18n with stored locale before early API calls so Accept-Language is applied.
  const locale = await i18n.restoreLocale();
  if (locale) {
    syncLocaleToEmbeddableWhenReady(locale).catch((e) => {
      console.warn('[i18n] Failed to sync locale to embeddable:', e);
    });
  }
  checkC2DCollision();
  getCustomManifest();
  getImplementedInterfaces();
}

async function getCustomManifest() {
  const customCrmManifest = await getManifest();
  if (customCrmManifest) {
    const { customCrmManifestUrl } = await chromeStorageLocal.get({ customCrmManifestUrl: null });
    if (customCrmManifestUrl) {
      await saveManifestUrl({ manifestUrl: customCrmManifestUrl });
    }
    setAuthor(customCrmManifest?.author?.name ?? "");
  }
}

async function getImplementedInterfaces() {
  const platformInfo = await getPlatformInfo();
  if (platformInfo) {
    const manifest = await getManifest();
    const response = await axios.get(`${manifest.serverUrl}/implementedInterfaces?platform=${platformInfo.platformName}`);
    if (response.data) {
      await chrome.storage.local.set({ implementedInterfaces: response.data });
    }
  }
}

// TODO: re-do errors
// let errorLogs = [];
// window.onerror = (event, source, lineno, colno, error) => {
//   errorLogs.push({ event, source, lineno, colno, error })
// };

// Interact with RingCentral Embeddable Voice:
window.addEventListener('message', async (e) => {
  const data = e.data;
  const eventPayload = { data, popupContext } as any;
  let noShowNotification = false;
  try {
    if (data) {
      switch (data.type) {
        case 'rc-telephony-session-notify':
          await rcTelephonySessionNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-calling-settings-notify':
          await rcCallingSettingsNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-region-settings-notify':
          await rcRegionSettingsNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-adapter-side-drawer-open-notify':
          await rcAdapterSideDrawerOpenNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-dialer-status-notify':
          await rcDialerStatusNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-webphone-connection-status-notify':
          await rcWebphoneConnectionStatusNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-adapter-pushAdapterState':
          await rcAdapterPushAdapterStateHandler.onEvent(eventPayload);
          break;
        case 'rc-login-status-notify':
          await rcLoginStatusNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case 'rc-login-popup-notify':
          await rcLoginPopupNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-call-init-notify':
          await rcCallInitNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-call-start-notify':
          await rcCallStartNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-ringout-call-notify':
          await rcRingoutCallNotifyHandler.onEvent(eventPayload);
          break;
        case "rc-active-call-notify":
          await rcActiveCallNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case 'rc-analytics-track':
          await rcAnalyticsTrackNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case 'rc-callLogger-auto-log-notify':
          await rcCallLoggerAutoLogNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case 'rc-messageLogger-auto-log-notify':
          await rcMessageLoggerAutoLogNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case 'rc-route-changed-notify':
          await rcRouteChangedNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case 'rc-adapter-ai-assistant-settings-notify':
          await rcAdapterAiAssistantSettingsNotifyHandler.onEvent(eventPayload);
          break;
        case 'rc-post-message-request':
          await rcPostMessageRequestHandler.onEvent(eventPayload);
          if (data.path != '/callLogger/inputChanged' && await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        case "rc-adapter-phone-number-format-settings-notify":
          await rcAdapterPhoneNumberFormatSettingsNotifyHandler.onEvent(eventPayload);
          if (await logRecorder.isRecordingLogs()) {
            logRecorder.logAction({ name: data.type, data });
          }
          break;
        default:
          break;
      }
    }
  }
  catch (e) {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    console.log(e);
    if (e.response && e.response.data?.returnMessage && e.response?.status !== 404 && !noShowNotification) {
      showNotification(e.response.data.returnMessage);
    }
    else if (e.message.includes('timeout')) {
      showNotification({ level: 'warning', message: 'Timeout', ttl: 5000 });
    }
    else {
      console.error(e);
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    if (e?.response?.status === 401) {
      getWidgetFrame().contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: '/settings',
      }, '*');
    }
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  try {
    switch (request.type) {
      case 'oauthCallBack':
        await oauthCallBackHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'pipedriveCallbackUri':
        await pipedriveCallbackUriHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'c2sms':
        await c2smsHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'c2d':
        await c2dHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'c2schedule':
        await c2scheduleHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'navigate':
        await navigateHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'insightlyAuth':
        await insightlyAuthHandler.onMessage({ request, sendResponse });
        if (await logRecorder.isRecordingLogs()) {
          logRecorder.logAction({ name: request.type, data: request });
        }
        break;
      case 'ringsenseRefTrack':
        await ringsenseRefTrackHandler.onMessage({ request, sendResponse });
        break;
      case 'controlCall':
        await controlCallHandler.onMessage({ request, sendResponse });
        break;
      default:
        break;
    }
    sendResponse({ result: 'ok' });
  }
  catch (e) {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    console.log(e);
  }
});
