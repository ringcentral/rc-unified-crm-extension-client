import LibPhoneNumberMatcher from './lib/LibPhoneNumberMatcher'
import RangeObserver from './lib/RangeObserver'
import App from './components/embedded';
import React from 'react';
import ReactDOM from 'react-dom';
import { RcThemeProvider } from '@ringcentral/juno';
import axios from 'axios';
import { sendMessageToExtension } from './lib/sendMessage';
console.log('import content js to web page');

async function initializeC2D() {
  const countryCode = await chrome.storage.local.get(
    { selectedRegion: 'US' }
  );

  window.clickToDialInject = new window.RingCentralC2D({
    observer: new RangeObserver({
      matcher: new LibPhoneNumberMatcher({
        countryCode: countryCode.selectedRegion
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
  return (
    <RcThemeProvider>
      <App />
    </RcThemeProvider>
  );
}

async function RenderQuickAccessButton() {
  if (window.location.hostname.includes('labs.ringcentral.com') || !window.location.hostname.includes('login.ringcentral')) {
    const rootElement = window.document.createElement('root');
    rootElement.id = 'rc-crm-extension-quick-access-button';
    window.document.body.appendChild(rootElement);
    ReactDOM.render(<Root />, rootElement);
  }
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
    if (!!!c2dDelay) {
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
  if (window.self === window.top && renderQuickAccessButton) {
    await RenderQuickAccessButton();
  }
  // Case: C2D renders extra elements inside Bullhorn note section
  if (!window.location.href.startsWith('https://app.bullhornstaffing.com/content/record/JobOrder')) {
    await initializeC2D();
  }

  const { extensionUserSettings } = await chrome.storage.local.get('extensionUserSettings');
  if(!!extensionUserSettings && !!extensionUserSettings.find(e => e.id === 'advancedFeatures')?.items.find(e => e.id === "toggleAutoOpenWithCRM")?.value)
  {
    chrome.runtime.sendMessage({
      type: 'openPopupWindow'
    });
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