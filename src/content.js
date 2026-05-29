import { RangeObserver, LibPhoneNumberMatcher, defaultExclusions } from 'ringcentral-c2d';
import App from './components/embedded';
import CustomC2DWidget from './misc/CustomC2DWidget'
import React from 'react';
import ReactDOM from 'react-dom';
import { RcThemeProvider } from '@ringcentral/juno';
import axios from 'axios';
import { sendMessageToExtension } from './lib/sendMessage';
import { isObjectEmpty } from './lib/util';
import InputAwareRegExpMatcher from './lib/c2d/inputAwareRegExpMatcher';
import { initializeShadowRootSupport } from './lib/c2d/shadowRootSupport';
import { createC2DNodeIgnorePredicate } from './lib/c2d/domIgnore';
import userCore from './core/user';
console.log('import content js to web page');

// type: c2d, quickAccessButton
async function checkUrlMatch({ type = 'quickAccessButton' }) {
  try {
    const { allowEmbeddingForAllPages } = await chrome.storage.local.get({ allowEmbeddingForAllPages: false });
    if (allowEmbeddingForAllPages) {
      return true;
    }
    const platformInfo = await chrome.storage.local.get('platform-info');
    if (!isObjectEmpty(platformInfo)) {
      const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
      const embedUrls = customCrmManifest?.platforms[platformInfo['platform-info'].platformName]?.embedUrls?.length > 0 ? customCrmManifest?.platforms[platformInfo['platform-info'].platformName]?.embedUrls : ['*'];
      const { userSettings } = await chrome.storage.local.get('userSettings');
      let clickToDialEmbedMode = null;
      switch (type) {
        case 'c2d':
          clickToDialEmbedMode = userCore.getClickToDialEmbedMode(userSettings).value;
          break;
        case 'quickAccessButton':
          clickToDialEmbedMode = userCore.getQuickAccessButtonEmbedMode(userSettings).value;
          break;
      }
      let clickToDialUrls = [];
      switch (type) {
        case 'c2d':
          clickToDialUrls = userCore.getClickToDialUrls(userSettings).value ?? [];
          break;
        case 'quickAccessButton':
          clickToDialUrls = userCore.getQuickAccessButtonUrls(userSettings).value ?? [];
          break;
      }
      switch (clickToDialEmbedMode) {
        case 'whitelist':
          return clickToDialUrls.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(window.location.href);
          });
        case 'blacklist':
          return !clickToDialUrls.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(window.location.href);
          });
        case 'crmOnly':
          return embedUrls.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(window.location.href);
          });
        case 'disabled':
          return false;
      }
    }
    return true;
  }
  catch (e) {
    console.error(e);
    return true;
  }
}

// Create a C2D instance for a specific root node
// If sharedWidget is provided, it will be reused instead of creating a new one
function createC2DInstance({ rootNode, sharedWidget, matcherType, selectedRegion, c2dIgnoreSelector }) {
  let matcher;
  const isNodeIgnored = createC2DNodeIgnorePredicate(c2dIgnoreSelector);
  const validDomExclusions = [
    ...defaultExclusions,
    { matchFunc: isNodeIgnored },
  ];
  switch (matcherType) {
    case 'libPhone': {
      const textMatcher = new LibPhoneNumberMatcher({
        countryCode: selectedRegion,
        validDomExclusions,
      });
      // ServiceNow and similar CRMs often keep phone numbers in input values.
      // Wrap text matching with value-node support so detail views are clickable.
      matcher = new InputAwareRegExpMatcher({ textMatcher, isNodeIgnored });
      break;
    }
    case 'regExp':
      matcher = new InputAwareRegExpMatcher({
        validDomExclusions,
        isNodeIgnored,
      });
      break;
    default: {
      const textMatcher = new LibPhoneNumberMatcher({
        countryCode: selectedRegion,
        validDomExclusions,
      });
      matcher = new InputAwareRegExpMatcher({ textMatcher, isNodeIgnored });
      break;
    }
  }
  const observer = new RangeObserver({
    node: rootNode,
    matcher,
  });
  const options = {
    widget: new CustomC2DWidget(),
    observer,
  };

  // Pass the shared widget if provided (for shadow root instances)
  if (sharedWidget) {
    options.widget = sharedWidget;
  }

  const c2dInstance = new window.RingCentralC2D(options);

  // Only attach event listeners if this is the primary instance (no shared widget)
  // Otherwise events would be duplicated since all instances share the same widget
  if (!sharedWidget) {
    c2dInstance.widget.on('call', function (phoneNumber) {
      console.log('Click To Dial:', phoneNumber);
      sendMessageToExtension({
        type: 'c2d',
        phoneNumber,
      });
    });

    c2dInstance.widget.on('text', function (phoneNumber) {
      console.log('Click To SMS:', phoneNumber);
      sendMessageToExtension({
        type: 'c2sms',
        phoneNumber,
      });
    });

    // Schedule click handler
    c2dInstance.widget.on('schedule', function (phoneNumber) {
      console.log('Click To Schedule:', phoneNumber);
      // Single source of truth: let SW open the window and cache the request
      sendMessageToExtension({ type: 'c2schedule', phoneNumber });
    },
    );
  }

  return c2dInstance;
}

async function initializeC2D() {
  const isUrlMatched = await checkUrlMatch({ type: 'c2d' });
  if (!isUrlMatched) {
    console.log('[App Connect]URL not matched, C2D not initialized');
    return;
  }

  const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} });

  // Store all C2D instances and observers
  window.clickToDialInstances = window.clickToDialInstances || [];
  window.clickToDialObservers = window.clickToDialObservers || [];
  window.clickToDialShadowRootPollers = window.clickToDialShadowRootPollers || [];

  // Get matcher type
  const { c2dMatcherType } = await chrome.storage.local.get({ c2dMatcherType: 'libPhone' });
  const { selectedRegion } = await chrome.storage.local.get({ selectedRegion: null });


  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
  const platformInfo = await chrome.storage.local.get('platform-info');
  let c2dIgnoreSelector = '';
  if (customCrmManifest?.platforms[platformInfo['platform-info'].platformName]?.c2dIgnoreSelector) {
    c2dIgnoreSelector = customCrmManifest?.platforms[platformInfo['platform-info'].platformName]?.c2dIgnoreSelector;
  }

  // Initialize main document C2D first (this creates the widget)
  window.clickToDialInject = createC2DInstance({
    rootNode: document.body,
    matcherType: c2dMatcherType,
    selectedRegion: selectedRegion,
    c2dIgnoreSelector,
  });
  // Disable the SMS button, keep only click-to-dial
  window.clickToDialInject.widget.update({ enableC2Text: userPermissions?.c2sms ?? false });
  window.clickToDialInstances.push(window.clickToDialInject);
  console.log(`[App Connect] C2D initialized for document.body`);

  initializeShadowRootSupport({
    createC2DInstance,
    sharedWidget: window.clickToDialInject.widget,
    matcherType: c2dMatcherType,
    selectedRegion,
    c2dIgnoreSelector,
    onInstanceCreated: (instance) => window.clickToDialInstances.push(instance),
    onObserverCreated: (observer) => window.clickToDialObservers.push(observer),
    pollerStore: window.clickToDialShadowRootPollers,
  });

  console.log(`[App Connect] C2D initialization complete. Found ${window.clickToDialInstances.length} roots.`);
}

// Listen message from background.js to open app window when user click icon.
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.action === 'openAppWindow') {
      console.log('opening window');
      // set app window minimized to false
      window.postMessage({
        type: 'rc-adapter-syncMinimized',
        minimized: false,
      }, '*');
      //sync to widget
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-syncMinimized',
        minimized: false,
      }, '*');
    }
    // Unique: Pipedrive
    if (request.action === 'needCallbackUri') {
      sendMessageToExtension({
        type: 'pipedriveCallbackUri',
        callbackUri: window.location.href
      });
    }
    // Unique: Pipedrive
    if (request.action === 'pipedriveAltAuthDone') {
      console.log('pipedriveAltAuthDone')
      const rcStepper = window.document.querySelector('#rc-stepper');
      rcStepper.innerHTML = '(3/3) Setup finished. You can close this page now.';
    }
    // Unique: Bullhorn
    if (request.action === 'fetchBullhornUsername') {
      const decodedCookie = decodeURIComponent(window.document.cookie);
      const bullhornUsername = decodedCookie.split('"username":"')[1].split('","masterUserId')[0];
      sendResponse({ bullhornUsername });
      return;
    }
    sendResponse('ok');
  }
);

function Root() {
  return React.createElement(RcThemeProvider, null, React.createElement(App, null));
}

async function RenderQuickAccessButton() {
  const platformInfo = await chrome.storage.local.get('platform-info');
  const isUrlMatched = await checkUrlMatch({ type: 'quickAccessButton' });
  if (!isUrlMatched && platformInfo['platform-info']?.hostname) {
    console.log('[App Connect] URL not matched, quick access button not initialized');
    return;
  }
  let rootElement = window.document.getElementById('rc-crm-extension-quick-access-button');
  if (!rootElement) {
    rootElement = window.document.createElement('root');
    rootElement.id = 'rc-crm-extension-quick-access-button';
    window.document.documentElement.appendChild(rootElement);
  }
  ReactDOM.render(React.createElement(Root, null), rootElement);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

// Unique: Bullhorn
async function fetchBullhornUserinfo() {
  const { crm_extension_bullhornUsername } = await chrome.storage.local.get({ crm_extension_bullhornUsername: null });
  let { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
  if (!crm_extension_bullhornUsername || !crm_extension_bullhorn_user_urls) {
    const decodedCookie = decodeURIComponent(window.document.cookie);
    const bullhornUsername = decodedCookie.split('"username":"')[1].split('","masterUserId')[0];
    await chrome.storage.local.set({ crm_extension_bullhornUsername: bullhornUsername });
    const { data: crm_extension_bullhorn_user_urls } = await axios.get(`https://rest.bullhornstaffing.com/rest-services/loginInfo?username=${bullhornUsername}`);
    await chrome.storage.local.set({ crm_extension_bullhorn_user_urls });
  }
  return { crm_extension_bullhornUsername, crm_extension_bullhorn_user_urls };
}

async function Initialize() {
  // Unique: Pipedrive
  if (window.location.hostname.includes('pipedrive.com')) {
    let { c2dDelay } = await chrome.storage.local.get(
      { c2dDelay: '3' }
    );
    if (!c2dDelay) {
      c2dDelay = 3;
    }
    const delayInMilliSec = Number(c2dDelay) * 1000;
    await delay(delayInMilliSec);
  }
  // Unique: Bullhorn
  if (window.location.hostname.includes('bullhornstaffing.com')) {
    await fetchBullhornUserinfo();
  }
  const { renderQuickAccessButton } = await chrome.storage.local.get({ renderQuickAccessButton: true });
  if (!window.location.href.startsWith('https://app.bullhornstaffing.com/content/record/JobOrder')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/fast-add')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/actions/compose-message')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/tools/template')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/actions/publish-job')
    && window.self === window.top
    && renderQuickAccessButton) {
    await RenderQuickAccessButton();
  }

  if (!renderQuickAccessButton) {
    localStorage.removeItem('rcQuickAccessButtonTransform');
    localStorage.removeItem('rcQuickAccessButtonTop');
  }

  // Case: C2D renders extra elements inside Bullhorn note section
  if (!window.location.href.startsWith('https://app.bullhornstaffing.com/content/record/JobOrder')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/fast-add')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/actions/compose-message')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/tools/template')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/actions/publish-job')
  ) {
    await initializeC2D();
  }

  const { userSettings } = await chrome.storage.local.get('userSettings');
  if (userSettings?.autoOpenExtension?.value ?? false) {
    const platformInfo = await chrome.storage.local.get('platform-info');
    const registeredHostname = platformInfo['platform-info'].hostname;
    if (window === window.top && window.location.hostname === registeredHostname) {
      chrome.runtime.sendMessage({
        type: 'openPopupWindow'
      });
    }
  }
}

Initialize();
// Unique: Pipedrive
if (window.location.pathname === '/pipedrive-redirect') {
  sendMessageToExtension({ type: "openPopupWindowOnPipedriveDirectPage", platform: 'pipedrive', hostname: 'temp' });
  const rcStepper = window.document.querySelector('#rc-stepper');
  rcStepper.innerHTML = '(2/3) Please sign in on the extension with your RingCentral account. If nothing happens, please try refreshing this page and wait for a few seconds.';
}

// Unique: Insightly
if (document.readyState !== 'loading') {
  registerInsightlyApiKey();
} else {
  document.addEventListener('DOMContentLoaded', function () {
    registerInsightlyApiKey();
  });
}

// Unique: Insightly
function registerInsightlyApiKey() {
  if (window.location.pathname === '/Users/UserSettings' && window.location.hostname.includes('insightly.com')) {
    const insightlyApiKey = document.querySelector('#apikey').innerHTML;
    const insightlyApiUrl = document.querySelector('#apiUrl').firstChild.innerHTML;
    sendMessageToExtension({
      type: 'insightlyAuth',
      apiKey: insightlyApiKey,
      apiUrl: insightlyApiUrl
    });
  }
}
