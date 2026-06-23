import { isObjectEmpty } from './lib/util';
import packageJson from '../package.json';
import baseManifest from './manifest.json';

let manifest;
let redirectUri;
let pipedriveInstallationTabId;
let pipedriveCallbackUri;
let cachedClickToXRequest;

const INCOMING_CALL_NOTIFICATION_PREFIX = 'incoming-call-';
const RECENT_INCOMING_CALL_NOTIFICATIONS_KEY = 'recentIncomingCallNotificationIds';
const INCOMING_CALL_NOTIFICATION_TTL = 5 * 60 * 1000;

async function focusExistingPopupWindow() {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId) {
    try {
      const popupWindow = await chrome.windows.get(popupWindowId);
      const wasMinimized = popupWindow.state === 'minimized';
      const wasFocused = popupWindow.focused;
      const updateInfo = { focused: true };
      if (wasMinimized) {
        updateInfo.state = 'normal';
      }
      await chrome.windows.update(popupWindowId, updateInfo);
      return { exists: true, popupWindowId, wasMinimized, wasFocused };
    } catch (e) {
      // ignore
    }
  }
  return { exists: false, popupWindowId: null, wasMinimized: false, wasFocused: false };
}

async function openPopupWindow() {
  console.log('open popup');
  const popupFocusResult = await focusExistingPopupWindow();
  if (popupFocusResult.exists) {
    return true;
  }
  const { extensionWindowStatus } = await chrome.storage.local.get({ extensionWindowStatus: null });
  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
  const platformInfo = await chrome.storage.local.get('platform-info');
  redirectUri = customCrmManifest?.platforms[platformInfo?.['platform-info']?.platformName ?? '']?.auth?.oauth?.redirectUri ?? 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html';
  // const redirectUri = chrome.identity.getRedirectURL('redirect.html'); //  set this when oauth with chrome.identity.launchWebAuthFlow
  const popupUri = `popup.html?multipleTabsSupport=1&disableLoginPopup=1&enableRingtoneSettings=1&appServer=https://platform.ringcentral.com&redirectUri=${redirectUri ?? 'https://ringcentral.github.io/ringcentral-embeddable/redirect.html'}&enableAnalytics=1&showSignUpButton=1&clientId=3rJq9BxcTCm-I7CFcY19ew&appVersion=${packageJson.version}&userAgent=RingCentral CRM Extension&disableNoiseReduction=false&enableSMSTemplate=1&enableLoadMoreCalls=1&disableGlip=false&enableSmartNote=1&enableVoicemailDrop=1&enableSideWidget=1`;
  let popup;
  if (!!extensionWindowStatus?.state && (extensionWindowStatus.state === 'maximized' || extensionWindowStatus.state === 'fullscreen')) {
    popup = await chrome.windows.create({
      url: popupUri,
      type: 'popup',
      focused: true,
      state: extensionWindowStatus.state
    });
  }
  else {
    try {
      popup = await chrome.windows.create({
        url: popupUri,
        type: 'popup',
        focused: true,
        width: extensionWindowStatus?.width ?? 450,
        height: extensionWindowStatus?.height ?? 848,
        left: extensionWindowStatus?.left ?? 50,
        top: extensionWindowStatus?.top ?? 50
      });
    }
    // Case: position not reachable
    catch (e) {
      popup = await chrome.windows.create({
        url: popupUri,
        type: 'popup',
        focused: true,
        width: 450,
        height: 848,
        left: 50,
        top: 50
      });
    }
  }
  await chrome.storage.local.set({
    popupWindowId: popup.id,
  });
  return false;
}

function getIncomingCallNotificationId(callId) {
  return `${INCOMING_CALL_NOTIFICATION_PREFIX}${String(callId ?? Date.now()).slice(0, 450)}`;
}

function createNotification(notificationId, options) {
  return new Promise((resolve) => {
    chrome.notifications.create(notificationId, options, resolve);
  });
}

function clearNotification(notificationId) {
  return new Promise((resolve) => {
    chrome.notifications.clear(notificationId, resolve);
  });
}

function getAllNotifications() {
  return new Promise((resolve) => {
    chrome.notifications.getAll(resolve);
  });
}

async function shouldSkipIncomingCallNotification(callId) {
  const now = Date.now();
  const storage = await chrome.storage.local.get({ [RECENT_INCOMING_CALL_NOTIFICATIONS_KEY]: {} });
  const recentNotifications = storage[RECENT_INCOMING_CALL_NOTIFICATIONS_KEY] ?? {};
  const activeNotifications = Object.keys(recentNotifications).reduce((result, id) => {
    if (recentNotifications[id] > now) {
      result[id] = recentNotifications[id];
    }
    return result;
  }, {});
  const shouldSkip = !!activeNotifications[callId];
  activeNotifications[callId] = now + INCOMING_CALL_NOTIFICATION_TTL;
  await chrome.storage.local.set({ [RECENT_INCOMING_CALL_NOTIFICATIONS_KEY]: activeNotifications });
  return shouldSkip;
}

async function clearIncomingCallNotifications(notificationId) {
  if (notificationId) {
    await clearNotification(notificationId);
    return;
  }
  const notifications = await getAllNotifications();
  await Promise.all(Object.keys(notifications)
    .filter((id) => id.startsWith(INCOMING_CALL_NOTIFICATION_PREFIX))
    .map((id) => clearNotification(id)));
}

async function showIncomingCallNotification({ callId, callerName, phoneNumber }) {
  if (await shouldSkipIncomingCallNotification(callId)) {
    return;
  }
  const caller = callerName || phoneNumber || 'Unknown caller';
  await createNotification(getIncomingCallNotificationId(callId), {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('images/logo128.png'),
    title: 'Incoming call',
    message: `Call from ${caller}`,
    isClickable: true,
    priority: 2,
    requireInteraction: true,
  });
}

async function incomingCallRingingHandler(request) {
  const callId = request.callId ?? request.telephonySessionId ?? request.sessionId ?? request.phoneNumber ?? Date.now();
  const popupFocusResult = await focusExistingPopupWindow();
  if (!popupFocusResult.exists) {
    await openPopupWindow();
    return;
  }
  if (popupFocusResult.wasMinimized || !popupFocusResult.wasFocused) {
    await showIncomingCallNotification({
      callId,
      callerName: request.callerName,
      phoneNumber: request.phoneNumber,
    });
    try {
      await chrome.windows.update(popupFocusResult.popupWindowId, { drawAttention: true });
    } catch (e) {
      // ignore
    }
  }
}

async function incomingCallResolvedHandler(request) {
  const callId = request.callId ?? request.telephonySessionId ?? request.sessionId;
  if (!callId) {
    await clearIncomingCallNotifications();
    return;
  }
  await clearIncomingCallNotifications(getIncomingCallNotificationId(callId));
}

chrome.action.onClicked.addListener(async function (tab) {
  openPopupWindow();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId === windowId) {
    try {
      await chrome.windows.update(popupWindowId, { drawAttention: false });
    } catch (e) {
      // ignore
    }
  }
});

function openPopupWindowFromNotification(notificationId) {
  if (!notificationId.startsWith(INCOMING_CALL_NOTIFICATION_PREFIX)) {
    return;
  }
  openPopupWindow()
    .catch((e) => {
      console.error('Failed to open popup from notification', e);
    })
    .finally(() => {
      clearIncomingCallNotifications(notificationId).catch((e) => {
        console.error('Failed to clear incoming call notification', e);
      });
    });
}

chrome.notifications.onClicked.addListener(openPopupWindowFromNotification);

chrome.notifications.onButtonClicked.addListener((notificationId) => {
  openPopupWindowFromNotification(notificationId);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId === windowId) {
    console.log('close popup');
    await chrome.storage.local.remove('popupWindowId');
    await chrome.storage.local.remove('errorLogRecordingStatus');
  }
});

chrome.windows.onBoundsChanged.addListener(async (window) => {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId === window.id) {
    const extensionWindowStatus = window;
    await chrome.storage.local.set({ extensionWindowStatus });
  }
});

chrome.alarms.onAlarm.addListener(async () => {
  const { loginWindowInfo } = await chrome.storage.local.get('loginWindowInfo');
  if (!loginWindowInfo) {
    return;
  }
  const tabs = await chrome.tabs.query({ windowId: loginWindowInfo.id });
  if (tabs.length === 0) {
    return;
  }
  const loginWindowUrl = tabs[0].url
  console.log('loginWindowUrl', loginWindowUrl);
  if (loginWindowUrl.indexOf(redirectUri ?? baseManifest.redirectUri) !== 0) {
    chrome.alarms.create('oauthCheck', { when: Date.now() + 3000 });
    return;
  }

  console.log('login success', loginWindowUrl);
  chrome.runtime.sendMessage({
    type: 'oauthCallBack',
    platform: loginWindowInfo.platform,
    callbackUri: loginWindowUrl
  });
  await chrome.windows.remove(loginWindowInfo.id);
  await chrome.storage.local.remove('loginWindowInfo');
});

async function pipedriveCallbackHandler(request, sender) {
  await openPopupWindow();
  chrome.tabs.sendMessage(sender.tab.id, { action: 'needCallbackUri' })
  pipedriveInstallationTabId = sender.tab.id;
  await chrome.storage.local.set({
    ['platform-info']: { platformName: request.platform, hostname: request.hostname }
  });
}

async function rcOAuthWindowHandler(request) {
  const loginWindow = await chrome.windows.create({
    url: request.oAuthUri,
    type: 'popup',
    width: 600,
    height: 600,
  });
  await chrome.storage.local.set({
    loginWindowInfo: {
      platform: 'rc',
      id: loginWindow.id
    }
  });
  chrome.alarms.create('oauthCheck', { when: Date.now() + 3000 });
}

async function thirdPartyOAuthWindowHandler(request) {
  const loginWindow = await chrome.windows.create({
    url: request.oAuthUri,
    type: 'popup',
    width: 600,
    height: 600,
  });
  await chrome.storage.local.set({
    loginWindowInfo: {
      platform: 'thirdParty',
      id: loginWindow.id
    }
  });
  chrome.alarms.create('oauthCheck', { when: Date.now() + 3000 });
}

async function c2xWindowHandler(request) {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId) {
    // Bring the existing popup to front
    try {
      const win = await chrome.windows.get(popupWindowId);
      if (win.state === 'minimized') {
        await chrome.windows.update(popupWindowId, { state: 'normal' });
      }
      await chrome.windows.update(popupWindowId, { focused: true });
    } catch (e) { /* ignore */ }
    // Popup already open: forward directly to ensure latest intent wins
    chrome.runtime.sendMessage({ type: request.type, phoneNumber: request.phoneNumber });
  } else {
    // Cold start: cache latest intent (overwrite any previous) and open
    cachedClickToXRequest = { type: request.type, phoneNumber: request.phoneNumber, at: Date.now() };
    await openPopupWindow();
  }
}

async function sideWidgetOpenHandler(request) {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (!popupWindowId) {
    return;
  }
  const popupWindow = await chrome.windows.get(popupWindowId);
  if (request.opened) {
    if (popupWindow.width < 600) {
      await chrome.windows.update(popupWindowId, { width: popupWindow.width + 300 });
    }
  } else {
    if (popupWindow.width >= 600) {
      await chrome.windows.update(popupWindowId, { width: popupWindow.width - 300 });
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");
  switch (request.type) {
    case "openPopupWindow":
      openPopupWindow();
      sendResponse({ result: 'ok' });
      if (request.navigationPath) {
        chrome.runtime.sendMessage({
          type: 'navigate',
          path: request.navigationPath
        })
      }
      break;
    case "incomingCallRinging":
      incomingCallRingingHandler(request)
        .then(() => sendResponse({ result: 'ok' }))
        .catch((e) => {
          console.error('Failed to handle incoming call ringing', e);
          sendResponse({ result: 'error', message: e.message });
        });
      return true;
    case "incomingCallResolved":
      incomingCallResolvedHandler(request)
        .then(() => sendResponse({ result: 'ok' }))
        .catch((e) => {
          console.error('Failed to handle incoming call resolved', e);
          sendResponse({ result: 'error', message: e.message });
        });
      return true;
    // Unique: Pipedrive
    case "openPopupWindowOnPipedriveDirectPage":
      pipedriveCallbackHandler(request, sender);
      sendResponse({ result: 'ok' });
      break;
    // Unique: Pipedrive
    case "popupWindowRequestPipedriveCallbackUri":
      chrome.runtime.sendMessage({
        type: 'pipedriveCallbackUri',
        pipedriveCallbackUri
      });
      sendResponse({ result: 'ok' });
      break;
    // Unique: Pipedrive
    case "pipedriveAltAuthDone":
      chrome.tabs.sendMessage(pipedriveInstallationTabId, { action: 'pipedriveAltAuthDone' });
      console.log('pipedriveAltAuthDone')
      sendResponse({ result: 'ok' });
      break;
    case "openRCOAuthWindow":
      if (request.oAuthUri) {
        rcOAuthWindowHandler(request);
      }
      sendResponse({ result: 'ok' });
      break;
    case "openThirdPartyAuthWindow":
      if (request.oAuthUri) {
        thirdPartyOAuthWindowHandler(request);
      }
      sendResponse({ result: 'ok' });
      break;
    case "c2d":
    case "c2sms":
    case "c2schedule":
      c2xWindowHandler(request);
      sendResponse({ result: 'ok' });
      break;
    case "checkForClickToXCache":
      sendResponse(cachedClickToXRequest);
      cachedClickToXRequest = null;
      break;
    // Unique: Pipedrive
    case "pipedriveCallbackUri":
      pipedriveCallbackUri = request.callbackUri;
      console.log('pipedrive callback uri: ', request.callbackUri);
      chrome.runtime.sendMessage({
        type: 'pipedriveCallbackUri',
        pipedriveCallbackUri
      });
      sendResponse({ result: 'ok' });
      break;
    case "sideWidgetOpen":
      sideWidgetOpenHandler(request);
      sendResponse({ result: 'ok' });
      break;
  }
});

chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === "isInstalled") {
      sendResponse({ isInstalled: true });
    }
  }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes('ringcentral.com/ringsense.html') && changeInfo.url.includes('ref=AppConnect')) {
    chrome.runtime.sendMessage({
      type: 'ringsenseRefTrack'
    }).catch(e => {
      // popup might be closed, ignore error
      console.log('Could not send trackRingSensePage message', e);
    });
  }
});
