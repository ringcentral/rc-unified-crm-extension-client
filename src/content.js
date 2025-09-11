import LibPhoneNumberMatcher from './lib/LibPhoneNumberMatcher'
import RangeObserver from './lib/RangeObserver'
import App from './components/embedded';
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

  class CustomC2DWidget {
    constructor() {
      this._root = null;
      this._callBtn = null;
      this._smsBtn = null;
      this._scheduleBtn = null;
      this._events = new Map();
      this._widgetHovering = false;
      this._currentTarget = undefined;
      this._lastContext = undefined;
      this._hideTimer = null;
      this._injectDOM();
    }

    on(eventName, handler) {
      if (!this._events.has(eventName)) this._events.set(eventName, []);
      this._events.get(eventName).push(handler);
    }

    emit(eventName, ...args) {
      const handlers = this._events.get(eventName) || [];
      handlers.forEach(h => {
        try { h(...args); } catch (e) { /* ignore */ }
      });
    }

    _getFullNumber(context) {
      const ctx = context || this._lastContext;
      if (!ctx) return '';
      return ctx.ext ? `${ctx.phoneNumber}*${ctx.ext}` : ctx.phoneNumber;
    }

    setTarget(item) {
      // Cancel any previous pending hide
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
      this._currentTarget = item;
      if (!item) {
        // If user is currently hovering the widget, do not arm a hide timer
        if (this._widgetHovering) {
          return;
        }
        // Delay hiding to allow mouse to travel from number to widget
        this._hideTimer = setTimeout(() => {
          if (!this._widgetHovering) {
            this._root.style.display = 'none';
          }
        }, 800);
        return;
      }
      this._lastContext = item.context || this._lastContext;
      this._root.style.display = 'flex';
      const rect = item.rect;
      // place to the right, vertically centered
      const left = Math.floor(rect.right - 10); // overlap more to ensure pointer enters widget
      const top = Math.floor(rect.top + (rect.startLineHeight || rect.height) / 2 - this._root.offsetHeight / 2);
      this._root.style.transform = `translate(${left}px, ${top}px)`;
    }

    _injectDOM() {
      if (this._root) return;
      const root = document.createElement('div');
      root.style.cssText = 'position:fixed;left:0;top:0;display:none;z-index:2147483646;background:#fff;border:1px solid rgba(0,0,0,0.12);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.16);padding:4px 5px;gap:4px;align-items:center;';
      root.style.position = 'fixed';
      root.style.pointerEvents = 'auto';
      // Helper: attempt multiple icon locations (public/c2d and public/images/c2d)
      const getIconUrl = (name) => chrome.runtime.getURL(`c2d/${name}.svg`);
      const BRAND_BLUE = '#0A77C4';
      const LIGHT_BLUE = '#3BA2E8';

      const mkBtn = (title, iconKey) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = title;
        b.textContent = '';
        b.style.cssText = 'cursor:pointer;border:none;background:#fff;padding:0;border-radius:8px;font-size:12px;line-height:12px;display:flex;align-items:center;justify-content:center;width:36px;height:36px;color:#0A77C4;transition:background .12s, box-shadow .12s, color .12s;';
        b.addEventListener('mouseenter', () => { this._widgetHovering = true; if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; } b.style.background = '#F7FBFF'; b.style.boxShadow = '0 2px 6px rgba(10,119,196,0.15)'; b.style.color = LIGHT_BLUE; });
        b.addEventListener('mouseleave', () => { /* keep hovering true while inside widget; root will manage hide */ b.style.background = '#fff'; b.style.boxShadow = 'none'; b.style.color = BRAND_BLUE; });
        // Load SVG inline and force brand blue color
        const url = getIconUrl(iconKey);
        const applyBlue = (el) => {
          const svgEl = el;
          try {
            svgEl.setAttribute('width', '20');
            svgEl.setAttribute('height', '20');
            svgEl.style.display = 'block';
            // Make icon inherit button color so hover can tint
            svgEl.setAttribute('fill', 'currentColor');
            const toBlue = svgEl.querySelectorAll('[fill]');
            toBlue.forEach(n => { if (n.getAttribute('fill') !== 'none') { n.setAttribute('fill', 'currentColor'); } });
            const stroked = svgEl.querySelectorAll('[stroke]');
            stroked.forEach(n => { if (n.getAttribute('stroke') !== 'none') { n.setAttribute('stroke', 'currentColor'); } });
          } catch (e) { /* ignore */ }
          return svgEl;
        };
        const insertSvg = (text) => {
          const span = document.createElement('span');
          span.innerHTML = text;
          const svg = span.querySelector('svg');
          if (svg) {
            b.appendChild(applyBlue(svg));
          }
        };
        fetch(url).then(r => r.text()).then(insertSvg).catch(() => { /* ignore if icon missing */ });
        return b;
      };
      // RC logo badge (visual only)
      const logo = document.createElement('div');
      logo.setAttribute('aria-label', 'RingCentral');
      // Remove outer border; show the image on a subtle white tile
      logo.style.cssText = 'width:36px;height:36px;border:0;border-radius:10px;display:flex;align-items:center;justify-content:center;background:transparent;';
      // Inner white tile to create inset look
      const logoTile = document.createElement('div');
      logoTile.style.cssText = 'width:32px;height:32px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;';
      // Use RC.png image (from public/c2d or public/images/c2d)
      (() => {
        const img = document.createElement('img');
        img.alt = 'RingCentral';
        img.style.cssText = 'width:22px;height:22px;display:block;';
        img.src = chrome.runtime.getURL('c2d/RC.png');
        logoTile.appendChild(img);
        logo.appendChild(logoTile);
      })();

      // Left arrow pointer to anchor on number
      const arrow = document.createElement('div');
      arrow.style.cssText = 'position:absolute;left:-6px;top:50%;transform:translateY(-50%) rotate(45deg);width:12px;height:12px;background:#fff;border-left:1px solid rgba(0,0,0,0.12);border-top:1px solid rgba(0,0,0,0.12);box-shadow:-3px -3px 6px rgba(0,0,0,0.04)';

      this._callBtn = mkBtn('Call with RingCentral', 'call');
      this._smsBtn = mkBtn('SMS with RingCentral', 'sms');
      this._scheduleBtn = mkBtn('Add to call-down list', 'calendar');
      const onPress = (handler) => (e) => {
        // Fire immediately before any hover-out occurs
        this._widgetHovering = true;
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        e.stopPropagation();
        e.preventDefault();
        handler();
      };
      this._scheduleBtn.addEventListener('pointerdown', onPress(() => this.emit('schedule', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
      this._callBtn.addEventListener('pointerdown', onPress(() => this.emit('call', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
      this._smsBtn.addEventListener('pointerdown', onPress(() => this.emit('text', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
      // Keep click as a fallback for browsers that might not deliver pointerdown
      this._scheduleBtn.addEventListener('click', onPress(() => this.emit('schedule', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
      this._callBtn.addEventListener('click', onPress(() => this.emit('call', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
      this._smsBtn.addEventListener('click', onPress(() => this.emit('text', this._getFullNumber(this._currentTarget?.context), this._currentTarget?.context || this._lastContext)));
      root.appendChild(logo);
      // Vertical divider like reference
      const divider = document.createElement('div');
      divider.style.cssText = 'width:1px;height:24px;background:#E3E7EB;border-radius:1px;';
      root.appendChild(this._callBtn);
      root.insertBefore(divider, this._callBtn);
      root.appendChild(this._smsBtn);
      root.appendChild(this._scheduleBtn);
      root.appendChild(arrow);
      root.addEventListener('mouseenter', () => { this._widgetHovering = true; if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; } });
      root.addEventListener('mouseleave', () => { this._widgetHovering = false; if (this._hideTimer) { clearTimeout(this._hideTimer); } this._hideTimer = setTimeout(() => { if (!this._widgetHovering && !this._currentTarget) { this._root.style.display = 'none'; } }, 250); });
      // Prevent page click handlers from firing and causing hover-out side effects
      root.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this._widgetHovering = true; if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; } });
      root.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
      document.body.appendChild(root);
      this._root = root;
    }
  }

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