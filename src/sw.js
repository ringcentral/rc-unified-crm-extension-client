import { isObjectEmpty, getManifest } from './lib/util';
import baseManifest from './manifest.json';
import packageJson from '../package.json';

let manifest;
let pipedriveInstallationTabId;
let pipedriveCallbackUri;
let cachedClickToXRequest;

async function fetchManifest() {
  let { customCrmManifestUrl } = await chrome.storage.local.get({ customCrmManifestUrl: null });
  if (!customCrmManifestUrl || customCrmManifestUrl === '') {
    customCrmManifestUrl = baseManifest.defaultCrmManifestUrl;
    await chrome.storage.local.set({ customCrmManifestUrl });
  }
  const customCrmManifestJson = await (await fetch(customCrmManifestUrl)).json();
  if (customCrmManifestJson) {
    await chrome.storage.local.set({ customCrmManifest: customCrmManifestJson });
  }
  await chrome.storage.local.set({ 'rc-crm-extension-version': baseManifest.version });
}

async function openPopupWindow() {
  console.log('open popup');
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId) {
    try {
      await chrome.windows.update(popupWindowId, { focused: true });
      return true;
    } catch (e) {
      // ignore
    }
  }
  const { extensionWindowStatus } = await chrome.storage.local.get({ extensionWindowStatus: null });
  // const redirectUri = chrome.identity.getRedirectURL('redirect.html'); //  set this when oauth with chrome.identity.launchWebAuthFlow
  const popupUri = `popup.html?multipleTabsSupport=1&disableLoginPopup=1&enableRingtoneSettings=1&appServer=https://platform.ringcentral.com&redirectUri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html&enableAnalytics=1&showSignUpButton=1&clientId=3rJq9BxcTCm-I7CFcY19ew&appVersion=${packageJson.version}&userAgent=RingCentral CRM Extension&disableNoiseReduction=false&enableSMSTemplate=1&enableLoadMoreCalls=1&disableGlip=false&enableSmartNote=1`;
  // const popupUri = `popup.html?multipleTabsSupport=1&disableLoginPopup=1&appServer=https://platform.ringcentral.com&redirectUri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html&enableAnalytics=1&showSignUpButton=1&clientId=3rJq9BxcTCm-I7CFcY19ew&appVersion=${packageJson.version}&userAgent=RingCentral CRM Extension&disableNoiseReduction=false&enableSMSTemplate=1&enableLoadMoreCalls=1&disableGlip=false&enableSmartNote=1&enableSideWidget=0`;
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
  await fetchManifest();
  return false;
}

async function registerPlatform(tabUrl) {
  const url = new URL(tabUrl);
  let hostname = url.hostname;
  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
  if (customCrmManifest) {
    manifest = customCrmManifest;
  }
  let platformName = '';
  const platforms = Object.keys(manifest.platforms);
  for (const p of platforms) {
    // identify crm website
    const urlRegex = new RegExp(manifest.platforms[p].urlIdentifier.replace('*', '.*'));
    if (urlRegex.test(url.href)) {
      platformName = p;
      break;
    }
  }
  if (platformName === '') {
    // Unique: Pipedrive
    if ((hostname.includes('ngrok') || hostname.includes('labs.ringcentral')) && url.pathname === '/pipedrive-redirect') {
      platformName = 'pipedrive';
      hostname = 'temp';
      // eslint-disable-next-line no-undef
      chrome.tabs.sendMessage(tab.id, { action: 'needCallbackUri' })
    }
    else {
      return false;
    }
  }
  await chrome.storage.local.set({
    ['platform-info']: { platformName, hostname }
  });
  return true;
}

chrome.action.onClicked.addListener(async function (tab) {
  const platformInfo = await chrome.storage.local.get('platform-info');
  if (isObjectEmpty(platformInfo)) {
    await fetchManifest();
    const registered = await registerPlatform(tab.url);
    if (registered) {
      await openPopupWindow();
    }
    else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/images/logo32.png',
        title: `Please open the extension from a CRM page`,
        message: "For first time setup, please open it from a CRM page. RingCentral App Connect requires initial setup and match to your CRM platform.",
        priority: 1
      });
    }
  }
  else {
    openPopupWindow();
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { popupWindowId } = await chrome.storage.local.get('popupWindowId');
  if (popupWindowId === windowId) {
    console.log('close popup');
    await chrome.storage.local.remove('popupWindowId');
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
  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
  manifest = customCrmManifest;
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
  if (loginWindowUrl.indexOf(manifest.redirectUri) !== 0) {
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

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");
  if (request.type === "openPopupWindow") {
    sendResponse({ result: 'ok' });
    registerPlatform(sender.tab.url);

    const platformInfo = await chrome.storage.local.get('platform-info');
    if (isObjectEmpty(platformInfo)) {
      await fetchManifest();
      const registered = await registerPlatform(sender.tab.url);
      if (registered) {
        await openPopupWindow();
      }
      else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/images/logo32.png',
          title: `Please open the extension from a CRM page`,
          message: "For first time setup, please open it from a CRM page. RingCentral App Connect requires initial setup and match to your CRM platform.",
          priority: 1
        });
      }
    }
    else {
      openPopupWindow();
    }
    if (request.navigationPath) {
      chrome.runtime.sendMessage({
        type: 'navigate',
        path: request.navigationPath
      })
    }
    return true;
  }
  // Unique: Pipedrive
  if (request.type === "openPopupWindowOnPipedriveDirectPage") {
    await openPopupWindow();
    chrome.tabs.sendMessage(sender.tab.id, { action: 'needCallbackUri' })
    pipedriveInstallationTabId = sender.tab.id;
    await chrome.storage.local.set({
      ['platform-info']: { platformName: request.platform, hostname: request.hostname }
    });
    sendResponse({ result: 'ok' });
    return;
  }
  // Unique: Pipedrive
  if (request.type === "popupWindowRequestPipedriveCallbackUri") {
    chrome.runtime.sendMessage({
      type: 'pipedriveCallbackUri',
      pipedriveCallbackUri
    });
  }
  // Unique: Pipedrive
  if (request.type === 'pipedriveAltAuthDone') {
    chrome.tabs.sendMessage(pipedriveInstallationTabId, { action: 'pipedriveAltAuthDone' });
    console.log('pipedriveAltAuthDone')
    sendResponse({ result: 'ok' });
    return;
  }
  if (request.type === 'openRCOAuthWindow' && request.oAuthUri) {
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
    sendResponse({ result: 'ok' });
    return;
  }
  if (request.type === 'openThirdPartyAuthWindow' && request.oAuthUri) {
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
    sendResponse({ result: 'ok' });
    return;
  }
  if (request.type === 'c2d' || request.type === 'c2sms') {
    const isPopupExist = await openPopupWindow();
    if (!isPopupExist) {
      cachedClickToXRequest = {
        type: request.type,
        phoneNumber: request.phoneNumber,
      }
    }
  }
  if (request.type === 'checkForClickToXCache') {
    sendResponse(cachedClickToXRequest);
    cachedClickToXRequest = null;
  }
  // Unique: Pipedrive
  if (request.type === 'pipedriveCallbackUri') {
    pipedriveCallbackUri = request.callbackUri;
    console.log('pipedrive callback uri: ', request.callbackUri);

    chrome.runtime.sendMessage({
      type: 'pipedriveCallbackUri',
      pipedriveCallbackUri
    });
  }
  if (request.type === 'sideWidgetOpen') {
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
  // if (request.type === 'notifyToReconnectCRM') {
  //   chrome.notifications.create({
  //     type: 'basic',
  //     iconUrl: '/images/logo32.png',
  //     title: `Please re-login with your CRM account`,
  //     message: "There might be a change to your CRM login, please go to setting page and Logout then Connect your CRM account again. Sorry for the inconvenience.",
  //     priority: 1
  //   });
  // }
});