import axios from 'axios';
import { checkC2DCollision } from './lib/util';
import { getManifest } from './service/manifestService';
import { saveManifestUrl } from './service/manifestService';
import { getPlatformInfo } from './service/platformService';
import { setAuthor } from './lib/analytics';
import { showNotification } from './lib/util';

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

// message handlers
import oauthCallBackHandler from './messageHandlers/oauthCallBack';
import pipedriveCallbackUriHandler from './messageHandlers/pipedriveCallbackUri';
import c2smsHandler from './messageHandlers/c2sms';
import c2dHandler from './messageHandlers/c2d';
import c2scheduleHandler from './messageHandlers/c2schedule';
import navigateHandler from './messageHandlers/navigate';
import insightlyAuthHandler from './messageHandlers/insightlyAuth';
import ringsenseRefTrackHandler from './messageHandlers/ringsenseRefTrack';


axios.defaults.timeout = 30000; // Set default timeout to 30 seconds, can be overriden with server manifest

window.__ON_RC_POPUP_WINDOW = 1;

checkC2DCollision();
getCustomManifest();
getImplementedInterfaces();

async function getCustomManifest() {
  const customCrmManifest = await getManifest();
  if (customCrmManifest) {
    const { customCrmManifestUrl } = await chrome.storage.local.get({ customCrmManifestUrl: null });
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
    if(response.data) {
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
  let noShowNotification = false;
  try {
    if (data) {
      switch (data.type) {
        case 'rc-telephony-session-notify':
          await rcTelephonySessionNotifyHandler.onEvent({ data });
          break;
        case 'rc-calling-settings-notify':
          await rcCallingSettingsNotifyHandler.onEvent({ data });
          break;
        case 'rc-region-settings-notify':
          await rcRegionSettingsNotifyHandler.onEvent({ data });
          break;
        case 'rc-adapter-side-drawer-open-notify':
          await rcAdapterSideDrawerOpenNotifyHandler.onEvent({ data });
          break;
        case 'rc-dialer-status-notify':
          await rcDialerStatusNotifyHandler.onEvent({ data });
          break;
        case 'rc-webphone-connection-status-notify':
          await rcWebphoneConnectionStatusNotifyHandler.onEvent({ data });
          break;
        case 'rc-adapter-pushAdapterState':
          await rcAdapterPushAdapterStateHandler.onEvent({ data });
          break;
        case 'rc-login-status-notify':
          await rcLoginStatusNotifyHandler.onEvent({ data });
          break;
        case 'rc-login-popup-notify':
          await rcLoginPopupNotifyHandler.onEvent({ data });
          break;
        case 'rc-call-init-notify':
          await rcCallInitNotifyHandler.onEvent({ data });
          break;
        case 'rc-call-start-notify':
          await rcCallStartNotifyHandler.onEvent({ data });
          break;
        case 'rc-ringout-call-notify':
          await rcRingoutCallNotifyHandler.onEvent({ data });
          break;
        case "rc-active-call-notify":
          await rcActiveCallNotifyHandler.onEvent({ data });
          break;
        case 'rc-analytics-track':
          await rcAnalyticsTrackNotifyHandler.onEvent({ data });
          break;
        case 'rc-callLogger-auto-log-notify':
          await rcCallLoggerAutoLogNotifyHandler.onEvent({ data });
          break;
        case 'rc-messageLogger-auto-log-notify':
          await rcMessageLoggerAutoLogNotifyHandler.onEvent({ data });
          break;
        case 'rc-route-changed-notify':
          await rcRouteChangedNotifyHandler.onEvent({ data });
          break;
        case 'rc-adapter-ai-assistant-settings-notify':
          await rcAdapterAiAssistantSettingsNotifyHandler.onEvent({ data });
          break;
        case 'rc-post-message-request':
          await rcPostMessageRequestHandler.onEvent({ data });
          break;
        case "rc-adapter-phone-number-format-settings-notify":
          await rcAdapterPhoneNumberFormatSettingsNotifyHandler.onEvent({ data });
          break;
        default:
          break;
      }
    }
  }
  catch (e) {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    console.log(e);
    if (e.response && e.response.data && e.response?.status !== 404 && !noShowNotification && typeof e.response.data === 'string') {
      showNotification({ level: 'warning', message: e.response.data, ttl: 5000 });
    }
    else if (e.message.includes('timeout')) {
      showNotification({ level: 'warning', message: 'Timeout', ttl: 5000 });
    }
    else {
      console.error(e);
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  try {
    switch (request.type) {
      case 'oauthCallBack':
        await oauthCallBackHandler.onMessage({ request, sendResponse });
        break;
      case 'pipedriveCallbackUri':
        await pipedriveCallbackUriHandler.onMessage({ request, sendResponse });
        break;
      case 'c2sms':
        await c2smsHandler.onMessage({ request, sendResponse });
        break;
      case 'c2d':
        await c2dHandler.onMessage({ request, sendResponse });
        break;
      case 'c2schedule':
        await c2scheduleHandler.onMessage({ request, sendResponse });
        break;
      case 'navigate':
        await navigateHandler.onMessage({ request, sendResponse });
        break;
      case 'insightlyAuth':
        await insightlyAuthHandler.onMessage({ request, sendResponse });
        break;
      case 'ringsenseRefTrack':
        await ringsenseRefTrackHandler.onMessage({ request, sendResponse });
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