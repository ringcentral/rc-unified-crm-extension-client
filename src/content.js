import LibPhoneNumberMatcher from './lib/LibPhoneNumberMatcher'
import RangeObserver from './lib/RangeObserver'
import App from './components/embedded';
import CustomC2DWidget from './misc/CustomC2DWidget'
import React from 'react';
import ReactDOM from 'react-dom';
import { RcThemeProvider } from '@ringcentral/juno';
import axios from 'axios';
import { sendMessageToExtension } from './lib/sendMessage';
import { isObjectEmpty } from './lib/util';
import { getManifest } from './service/manifestService';
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
      const embedUrls = customCrmManifest?.platforms[platformInfo['platform-info'].platformName]?.embedUrls;
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
    else {
      return false;
    }
  }
  catch (e) {
    console.error(e);
    return false;
  }
}

async function initializeC2D() {
  const isUrlMatched = await checkUrlMatch({ type: 'c2d' });
  if (!isUrlMatched) {
    console.log('[App Connect]URL not matched, C2D not initialized');
    return;
  }
  const countryCode = await chrome.storage.local.get({ selectedRegion: 'US' });
  const { matchAllNumbers } = await chrome.storage.local.get({ matchAllNumbers: false });

  window.clickToDialInject = new window.RingCentralC2D({
    widget: new CustomC2DWidget(),
    observer: new RangeObserver({
      matcher: new LibPhoneNumberMatcher({
        countryCode: countryCode.selectedRegion,
        matchAllNumbers,
      })
    })
  });

  window.clickToDialInject.widget.on(
    'call',
    function (phoneNumber) {
      console.log('Click To Dial:', phoneNumber);
      // alert('Click To Dial:' + phoneNumber);
      sendMessageToExtension({
        type: 'c2d',
        phoneNumber,
      });
    },
  );
  window.clickToDialInject.widget.on(
    'text',
    function (phoneNumber) {
      console.log('Click To SMS:', phoneNumber);
      // alert('Click To SMS:' + phoneNumber);
      sendMessageToExtension({
        type: 'c2sms',
        phoneNumber,
      });
    },
  );

  // Schedule click handler
  window.clickToDialInject.widget.on(
    'schedule',
    function (phoneNumber) {
      console.log('Click To Schedule:', phoneNumber);
      // Single source of truth: let SW open the window and cache the request
      sendMessageToExtension({ type: 'c2schedule', phoneNumber });
    },
  );
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
  const rootElement = window.document.createElement('root');
  rootElement.id = 'rc-crm-extension-quick-access-button';
  window.document.body.appendChild(rootElement);
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
    && window.self === window.top
    && renderQuickAccessButton) {
    await RenderQuickAccessButton();
  }

  if (!renderQuickAccessButton) {
    localStorage.removeItem('rcQuickAccessButtonTransform');
  }

  // Case: C2D renders extra elements inside Bullhorn note section
  if (!window.location.href.startsWith('https://app.bullhornstaffing.com/content/record/JobOrder')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/fast-add')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/actions/compose-message')
    && !window.location.href.startsWith('https://app.bullhornstaffing.com/content/tools/template')
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