const auth = require('./core/auth');
const { getLog, openLog, addLog, updateLog, getCachedNote, cacheCallNote, cacheUnresolvedLog, getLogCache, getAllUnresolvedLogs, resolveCachedLog, getConflictContentFromUnresolvedLog } = require('./core/log');
const { getContact, createContact, openContactPage } = require('./core/contact');
const { responseMessage, isObjectEmpty, showNotification, dismissNotification } = require('./lib/util');
const { getUserInfo } = require('./lib/rcAPI');
const { apiKeyLogin } = require('./core/auth');
const { openDB } = require('idb');
const logPage = require('./components/logPage');
const authPage = require('./components/authPage');
const feedbackPage = require('./components/feedbackPage');
const releaseNotesPage = require('./components/releaseNotesPage');
const supportPage = require('./components/supportPage');
const aboutPage = require('./components/aboutPage');
const developerSettingsPage = require('./components/developerSettingsPage');
const crmSetupErrorPage = require('./components/crmSetupErrorPage');
const moment = require('moment');
const {
  setAuthor,
  identify,
  reset,
  group,
  trackPage,
  trackRcLogin,
  trackRcLogout,
  trackPlacedCall,
  trackAnsweredCall,
  trackCallEnd,
  trackSentSMS,
  trackCreateMeeting,
  trackEditSettings,
  trackConnectedCall,
  trackOpenFeedback,
  trackFactoryReset,
  trackUpdateCallRecordingLink
} = require('./lib/analytics');

window.__ON_RC_POPUP_WINDOW = 1;

let manifest = {};
let registered = false;
let crmAuthed = false;
let platform = null;
let platformName = '';
let platformHostname = '';
let rcUserInfo = {};
let extensionUserSettings = null;
// trailing SMS logs need to know if leading SMS log is ready and page is open. The waiting is for getContact call
let leadingSMSCallReady = false;
let trailingSMSLogInfo = [];
let firstTimeLogoutAbsorbed = false;
let autoPopupMainConverastionId = null;
let currentNotificationId = null;

import axios from 'axios';
axios.defaults.timeout = 30000; // Set default timeout to 30 seconds, can be overriden with server manifest

async function checkC2DCollision() {
  try {
    const { rcForGoogleCollisionChecked } = await chrome.storage.local.get({ rcForGoogleCollisionChecked: false });
    const collidingC2DResponse = await fetch("chrome-extension://fddhonoimfhgiopglkiokmofecgdiedb/redirect.html");
    if (!rcForGoogleCollisionChecked && collidingC2DResponse.status === 200) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/images/logo32.png',
        title: `Click-to-dial may not work`,
        message: "The RingCentral for Google Chrome extension has been detected. You may wish to customize your click-to-dial preferences for your desired behavior",
        priority: 1,
        buttons: [
          {
            title: 'Configure'
          }
        ]
      });
      chrome.notifications.onButtonClicked.addListener(
        (notificationId, buttonIndex) => {
          window.open('https://youtu.be/tbCOM27GUbc');
        }
      )

      await chrome.storage.local.set({ rcForGoogleCollisionChecked: true });
    }
  }
  catch (e) {
    //ignore
  }
}

checkC2DCollision();

async function getCustomManifest() {
  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
  if (!!customCrmManifest) {
    manifest = customCrmManifest;
    setAuthor(manifest?.author?.name ?? "");
  }
}

getCustomManifest();

async function showUnresolvedTabPage(path) {
  // TEMP: hide it for now
  return;
  const unresolvedLogs = await getAllUnresolvedLogs();
  const unresolvedLogsPage = logPage.getUnresolvedLogsPageRender({ unresolvedLogs });
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-register-customized-page',
    page: unresolvedLogsPage,
  }, '*');
  if (unresolvedLogsPage.hidden && !!path && (path == '/customizedTabs/unresolve' || path == '/messageLogger' || path == '/callLogger')) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: 'goBack',
    }, '*');
  }
}

let errorLogs = [];
window.onerror = (event, source, lineno, colno, error) => {
  errorLogs.push({ event, source, lineno, colno, error })
};

// Interact with RingCentral Embeddable Voice:
window.addEventListener('message', async (e) => {
  const data = e.data;
  let noShowNotification = false;
  try {
    if (data) {
      switch (data.type) {
        case 'rc-calling-settings-notify':
          await chrome.storage.local.set({ callWith: data.callWith, callingMode: data.callingMode });
          break;
        case 'rc-region-settings-notify':
          // get region settings from widget
          console.log('rc-region-settings-notify:', data);
          if (data.countryCode) {
            await chrome.storage.local.set(
              { selectedRegion: data.countryCode }
            )
          }
          break;
        case 'rc-dialer-status-notify':
          if (data.ready) {
            // check for Click-To-Dial or Click-To-SMS cached action
            const cachedClickToXRequest = await chrome.runtime.sendMessage(
              {
                type: 'checkForClickToXCache'
              }
            )
            if (cachedClickToXRequest) {
              if (cachedClickToXRequest.type === 'c2d') {
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-new-call',
                  phoneNumber: cachedClickToXRequest.phoneNumber,
                  toCall: true,
                }, '*');
              }
              if (cachedClickToXRequest.type === 'c2sms') {
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-new-sms',
                  phoneNumber: cachedClickToXRequest.phoneNumber,
                  conversation: true, // will go to conversation page if conversation existed
                }, '*');
              }
            }
          }
        case 'rc-webphone-connection-status-notify':
          // get call on active call updated event
          if (data.connectionStatus === 'connectionStatus-connected') { // connectionStatus-connected, connectionStatus-disconnected
            await auth.checkAuth();

            RCAdapter.showFeedback({
              onFeedback: function () {
                window.postMessage({
                  path: '/custom-button-click',
                  type: 'rc-post-message-request',
                  body: { button: { id: 'openSupportPage' } }
                });
              },
            });
          }
          break;
        case 'rc-adapter-pushAdapterState':
          extensionUserSettings = (await chrome.storage.local.get('extensionUserSettings')).extensionUserSettings;
          if (!registered) {
            const platformInfo = await chrome.storage.local.get('platform-info');
            if (isObjectEmpty(platformInfo)) {
              renderCRMSetupErrorPage();
            }
            platformName = platformInfo['platform-info'].platformName;
            platformHostname = platformInfo['platform-info'].hostname;
            platform = manifest.platforms[platformName];
            if (!!platform.requestConfig?.timeout) {
              axios.defaults.timeout = platform.requestConfig.timeout * 1000;
            }
            registered = true;
            const serviceManifest = await getServiceManifest(platform.name);
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-register-third-party-service',
              service: serviceManifest
            }, '*');
          }
          break;
        case 'rc-login-status-notify':
          // get login status from widget
          console.log('rc-login-status-notify:', data.loggedIn, data.loginNumber, data.contractedCountryCode);
          const platformInfo = await chrome.storage.local.get('platform-info');
          if (isObjectEmpty(platformInfo)) {
            renderCRMSetupErrorPage();
          }
          platformName = platformInfo['platform-info'].platformName;
          rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
          if (data.loggedIn) {
            document.getElementById('rc-widget').style.zIndex = 0;
            let { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
            // TEMP - migrate bullhorn user ID
            if (platformName === 'bullhorn') {
              const { crm_extension_bullhorn_user_id_migrated } = await chrome.storage.local.get({ crm_extension_bullhorn_user_id_migrated: false });
              if (!!!crm_extension_bullhorn_user_id_migrated) {
                const migratedJWT = await axios.get(`${manifest.serverUrl}/temp-bullhorn-migrate-userId?jwtToken=${rcUnifiedCrmExtJwt}`);
                if (!!migratedJWT?.data?.jwtToken) {
                  rcUnifiedCrmExtJwt = migratedJWT.data.jwtToken;
                  await chrome.storage.local.set({ rcUnifiedCrmExtJwt });
                }
                await chrome.storage.local.set({ crm_extension_bullhorn_user_id_migrated: true });
              }
            }
            crmAuthed = !!rcUnifiedCrmExtJwt;
            // Unique: Pipedrive
            if (platformName === 'pipedrive' && !(await auth.checkAuth())) {
              chrome.runtime.sendMessage(
                {
                  type: 'popupWindowRequestPipedriveCallbackUri'
                }
              );
            }
            else if (!rcUnifiedCrmExtJwt) {
              currentNotificationId = await showNotification({ level: 'warning', message: 'Please go to Settings and connect to CRM platform', ttl: 60000 });
            }
            try {
              const extId = JSON.parse(localStorage.getItem('sdk-rc-widgetplatform')).owner_id;
              const indexDB = await openDB(`rc-widget-storage-${extId}`, 2);
              const rcInfo = await indexDB.get('keyvaluepairs', 'dataFetcherV2-storageData');
              const userInfoResponse = await getUserInfo({
                serverUrl: manifest.serverUrl,
                extensionId: rcInfo.value.cachedData.extensionInfo.id,
                accountId: rcInfo.value.cachedData.extensionInfo.account.id
              });
              rcUserInfo = {
                rcUserName: rcInfo.value.cachedData.extensionInfo.name,
                rcUserEmail: rcInfo.value.cachedData.extensionInfo.contact.email,
                rcAccountId: userInfoResponse.accountId,
                rcExtensionId: userInfoResponse.extensionId
              };
              await chrome.storage.local.set({ ['rcUserInfo']: rcUserInfo });
              reset();
              identify({ extensionId: rcUserInfo?.rcExtensionId, rcAccountId: rcUserInfo?.rcAccountId, platformName });
              group({ rcAccountId: rcUserInfo?.rcAccountId });
              // setup headers for server side analytics
              axios.defaults.headers.common['rc-extension-id'] = rcUserInfo?.rcExtensionId;
              axios.defaults.headers.common['rc-account-id'] = rcUserInfo?.rcAccountId;
              axios.defaults.headers.common['developer-author-name'] = manifest?.author?.name ?? "";
              await showUnresolvedTabPage();
              // TEMP:
              const storedTemplates = await chrome.storage.local.get('rc-sms-templates');
              if (!!storedTemplates && !isObjectEmpty(storedTemplates)) {
                const templates = storedTemplates['rc-sms-templates'];
                for (const t of templates) {
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-message-request',
                    requestId: Date.now().toString(),
                    path: '/create-sms-template',
                    body: {
                      displayName: t.name,
                      text: t.message
                    },
                  }, '*');
                }
                await chrome.storage.local.remove('rc-sms-templates');
              }
            }
            catch (e) {
              reset();
              console.error(e);
            }
          }

          let { rcLoginStatus } = await chrome.storage.local.get('rcLoginStatus');
          // case 1: fresh login
          if (rcLoginStatus === null) {
            if (data.loggedIn) {
              trackRcLogin();
              rcLoginStatus = true;
              await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
            }
          }
          // case 2: login status changed
          else {
            // case 2.1: logged in
            if (data.loggedIn && !rcLoginStatus) {
              trackRcLogin();
              rcLoginStatus = true;
              await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
            }
            // case 2.2: logged out
            if (!data.loggedIn && rcLoginStatus) {
              // first time open the extension, it'll somehow send a logout event anyway
              if (!firstTimeLogoutAbsorbed) {
                firstTimeLogoutAbsorbed = true;
              }
              else {
                trackRcLogout();
                rcLoginStatus = false;
                await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
              }
            }
          }
          // Check version and show release notes
          const registeredVersionInfo = await chrome.storage.local.get('rc-crm-extension-version');
          if (!!registeredVersionInfo[['rc-crm-extension-version']]) {
            const releaseNotesPageRender = await releaseNotesPage.getReleaseNotesPageRender({ manifest, platformName, registeredVersion: registeredVersionInfo['rc-crm-extension-version'] });
            if (!!releaseNotesPageRender) {
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: releaseNotesPageRender
              });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${releaseNotesPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
              }, '*');
            }
          }
          await chrome.storage.local.set({
            ['rc-crm-extension-version']: manifest.version
          });
          break;
        case 'rc-login-popup-notify':
          handleRCOAuthWindow(data.oAuthUri);
          break;
        case 'rc-call-init-notify':
          trackPlacedCall();
          break;
        case 'rc-call-start-notify':
          // get call when a incoming call is accepted or a outbound call is connected
          if (data.call.direction === 'Inbound') {
            trackAnsweredCall();
          }
          break;
        case 'rc-ringout-call-notify':
          // get call on active call updated event
          if (data.call.telephonyStatus === 'CallConnected') {
            trackConnectedCall();
          }
          break;
        case "rc-active-call-notify":
          switch (data.call.telephonyStatus) {
            case 'CallConnected':
              window.postMessage({ type: 'rc-expandable-call-note-open', sessionId: data.call.sessionId }, '*');
              switch (data.call.direction) {
                case 'Inbound':
                  chrome.runtime.sendMessage({
                    type: 'openPopupWindow'
                  });
                  if (!!extensionUserSettings && extensionUserSettings?.find(e => e.id === 'contacts')?.items?.find(e => e.id === 'openContactPageFromIncomingCall')?.value === 'onAnswer') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber });
                  }
                  break;
                case 'Outbound':
                  if (!!extensionUserSettings && extensionUserSettings?.find(e => e.id === 'contacts')?.items?.find(e => e.id === 'openContactPageFromOutgoingCall')?.value === 'onAnswer') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.to.phoneNumber });
                  }
                  break;
              }
              break;
            case 'NoCall':
              if (data.call.terminationType === 'final') {
                window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
              }
              break;
            case 'Ringing':
              switch (data.call.direction) {
                case 'Inbound':
                  chrome.runtime.sendMessage({
                    type: 'openPopupWindow'
                  });
                  if (!!extensionUserSettings && extensionUserSettings?.find(e => e.id === 'contacts')?.items?.find(e => e.id === 'openContactPageFromIncomingCall')?.value === 'onFirstRing') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber });
                  }
                  break;
                case 'Outbound':
                  if (!!extensionUserSettings && extensionUserSettings?.find(e => e.id === 'contacts')?.items?.find(e => e.id === 'openContactPageFromOutgoingCall')?.value === 'onFirstRing') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.to.phoneNumber });
                  }
                  break;
              }
              break;
          }
          break;
        case 'rc-analytics-track':
          switch (data.event) {
            case 'SMS: SMS sent successfully':
              trackSentSMS();
              break;
            case 'Meeting Scheduled':
              trackCreateMeeting();
              break;
            case 'WebRTC Call Ended':
              const { callWith, callingMode } = await chrome.storage.local.get({ callWith: null, callingMode: null });
              trackCallEnd({
                direction: data.properties.direction,
                durationInSeconds: data.properties.duration,
                result: data.properties.result,
                callWith,
                callingMode
              });
              break;
          }
          break;
        case 'rc-callLogger-auto-log-notify':
          await chrome.storage.local.set({ rc_callLogger_auto_log_notify: data.autoLog });
          trackEditSettings({ changedItem: 'auto-call-log', status: data.autoLog });
          break;
        case 'rc-messageLogger-auto-log-notify':
          await chrome.storage.local.set({ rc_messageLogger_auto_log_notify: data.autoLog });
          trackEditSettings({ changedItem: 'auto-message-log', status: data.autoLog });
          break;
        case 'rc-route-changed-notify':
          if (!data.path.startsWith('/log/message') && !data.path.startsWith('/conversations/')) {
            autoPopupMainConverastionId = null;
          }
          if (data.path !== '/') {
            trackPage(data.path);
            if (data.path === '/customizedTabs/unresolve') {
              await showUnresolvedTabPage(data.path);
            }
          }
          if (!!data.path) {
            if (data.path.startsWith('/conversations/') || data.path.startsWith('/composeText')) {
              window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
            }
          }
          break;
        case 'rc-post-message-request':
          if (!crmAuthed && (data.path === '/callLogger' || data.path === '/messageLogger')) {
            showNotification({ level: 'warning', message: 'Please go to Settings and connect to CRM platform', ttl: 60000 });
            break;
          }
          switch (data.path) {
            case '/authorize':
              const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
              crmAuthed = !!rcUnifiedCrmExtJwt;
              if (!rcUnifiedCrmExtJwt) {
                switch (platform.auth.type) {
                  case 'oauth':
                    let authUri;
                    let customState = '';
                    if (!!platform.auth.oauth.customState) {
                      customState = platform.auth.oauth.customState;
                    }
                    // Unique: Pipedrive
                    if (platformName === 'pipedrive') {
                      authUri = manifest.platforms.pipedrive.auth.oauth.redirectUri;
                    }
                    // Unique: Bullhorn
                    else if (platformName === 'bullhorn') {
                      let { crm_extension_bullhorn_user_urls } = await chrome.storage.local.get({ crm_extension_bullhorn_user_urls: null });
                      if (crm_extension_bullhorn_user_urls?.oauthUrl) {
                        authUri = `${crm_extension_bullhorn_user_urls.oauthUrl}/authorize?` +
                          `response_type=code` +
                          `&action=Login` +
                          `&client_id=${platform.auth.oauth.clientId}` +
                          `&state=platform=${platform.name}` +
                          '&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html';
                      }
                      else {
                        const { crm_extension_bullhornUsername } = await chrome.storage.local.get({ crm_extension_bullhornUsername: null });
                        showNotification({ level: 'warning', message: 'Bullhorn authorize error. Please refresh Bullhorn webpage and try again.', ttl: 30000 });
                        const { data: crm_extension_bullhorn_user_urls } = await axios.get(`https://rest.bullhornstaffing.com/rest-services/loginInfo?username=${crm_extension_bullhornUsername}`);
                        await chrome.storage.local.set({ crm_extension_bullhorn_user_urls });
                        if (crm_extension_bullhorn_user_urls?.oauthUrl) {
                          authUri = `${crm_extension_bullhorn_user_urls.oauthUrl}/authorize?` +
                            `response_type=code` +
                            `&action=Login` +
                            `&client_id=${platform.auth.oauth.clientId}` +
                            `&state=platform=${platform.name}` +
                            '&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html';
                        }
                      }
                    }
                    else {
                      authUri = `${platform.auth.oauth.authUrl}?` +
                        `response_type=code` +
                        `&client_id=${platform.auth.oauth.clientId}` +
                        `${!!platform.auth.oauth.scope && platform.auth.oauth.scope != '' ? `&${platform.auth.oauth.scope}` : ''}` +
                        `&state=${customState === '' ? `platform=${platform.name}` : customState}` +
                        '&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html';
                    }
                    handleThirdPartyOAuthWindow(authUri);
                    break;
                  case 'apiKey':
                    const authPageRender = authPage.getAuthPageRender({ manifest, platformName });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-register-customized-page',
                      page: authPageRender
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-navigate-to',
                      path: `/customized/${authPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
                    }, '*');
                    break;
                }
              }
              else {
                window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                await auth.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
                window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              }
              responseMessage(
                data.requestId,
                {
                  data: 'OK'
                }
              );
              break;
            case '/customizedPage/inputChanged':
              if (data.body.page.id === 'unresolve') {
                const unresolvedRecordId = data.body.formData.record;
                const unresolvedLog = await getLogCache({ cacheId: unresolvedRecordId });
                const pageId = unresolvedRecordId.split('-')[1];
                const logPageRender = logPage.getLogPageRender({
                  id: pageId,
                  manifest,
                  logType: unresolvedLog.type,
                  triggerType: 'createLog',
                  platformName,
                  direction: unresolvedLog.direction ?? '',
                  contactInfo: unresolvedLog.contactInfo,
                  subject: unresolvedLog.subject ?? '',
                  note: unresolvedLog.note ?? '',
                  isUnresolved: true
                });


                if (unresolvedLog.type === 'Call') {
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-update-call-log-page',
                    page: logPageRender,
                  }, '*');

                  // navigate to call log page
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/log/call/${pageId}`,
                  }, '*');
                }
                else {
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-update-messages-log-page',
                    page: logPageRender,
                  }, '*');

                  // navigate to messages log page
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/log/messages/${pageId}`,
                  }, '*');
                }
              }
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-post-message-response',
                responseId: data.requestId,
                response: { data: 'ok' },
              }, '*');
              break;
            case '/contacts/match':
              noShowNotification = true;
              let matchedContacts = {};
              const { tempContactMatchTask } = await chrome.storage.local.get({ tempContactMatchTask: null });
              if (data.body.phoneNumbers.length === 1 && !!tempContactMatchTask && tempContactMatchTask.phoneNumber === data.body.phoneNumbers[0]) {
                const cachedMatching = document.querySelector("#rc-widget-adapter-frame").contentWindow.phone.contactMatcher.data[tempContactMatchTask.phoneNumber];
                const platformContactMatching = !!cachedMatching ? cachedMatching[platformName]?.data : [];
                matchedContacts[tempContactMatchTask.phoneNumber] = [
                  ...platformContactMatching,
                  {
                    id: tempContactMatchTask.contactId,
                    type: platformName,
                    name: tempContactMatchTask.contactName,
                    phoneNumbers: [
                      {
                        phoneNumber: tempContactMatchTask.phoneNumber,
                        phoneType: 'direct'
                      }
                    ],
                    entityType: platformName,
                    contactType: tempContactMatchTask.contactType
                  }
                ];
                await chrome.storage.local.remove('tempContactMatchTask');
              }
              else {
                for (const contactPhoneNumber of data.body.phoneNumbers) {
                  // skip contact with just extension number
                  if (!contactPhoneNumber.startsWith('+')) {
                    continue;
                  }
                  // query on 3rd party API to get the matched contact info and return
                  const { matched: contactMatched, contactInfo } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber });
                  if (contactMatched) {
                    if (!!!matchedContacts[contactPhoneNumber]) {
                      matchedContacts[contactPhoneNumber] = [];
                    }
                    for (var contactInfoItem of contactInfo) {
                      if (contactInfoItem.isNewContact) {
                        continue;
                      }
                      matchedContacts[contactPhoneNumber].push({
                        id: contactInfoItem.id,
                        type: platformName,
                        name: contactInfoItem.name,
                        phoneNumbers: [
                          {
                            phoneNumber: contactPhoneNumber,
                            phoneType: 'direct'
                          }
                        ],
                        entityType: platformName,
                        contactType: contactInfoItem.type,
                        additionalInfo: contactInfoItem.additionalInfo
                      });
                    }
                  }
                }
              }
              // return matched contact object with phone number as key
              responseMessage(
                data.requestId,
                {
                  data: matchedContacts
                }
              );
              break;
            case '/contacts/view':
              window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
              await openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactId: data.body.id, contactType: data.body.contactType });
              window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              responseMessage(
                data.requestId,
                {
                  data: 'ok'
                });
              break;
            case '/callLogger':
              let isAutoLog = false;
              const callAutoPopup = !!extensionUserSettings && extensionUserSettings?.find(e => e.id === "popupLogPageAfterCall")?.value;

              // extensions numers should NOT be logged
              if (data.body.call.direction === 'Inbound') {
                if (!!data?.body?.call?.from?.extensionNumber) {
                  showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                  break;
                }
              }
              else {
                if (!!data?.body?.call?.to?.extensionNumber) {
                  showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                  break;
                }
              }
              // Sync events - update log
              if (data.body.triggerType === 'callLogSync') {
                if (!!data.body.call?.recording?.link) {
                  console.log('call recording updating...');
                  trackUpdateCallRecordingLink({ processState: 'start' });
                  await chrome.storage.local.set({ ['rec-link-' + data.body.call.sessionId]: { recordingLink: data.body.call.recording.link } });
                  await updateLog(
                    {
                      serverUrl: manifest.serverUrl,
                      logType: 'Call',
                      sessionId: data.body.call.sessionId,
                      recordingLink: data.body.call.recording.link
                    });
                  trackUpdateCallRecordingLink({ processState: 'finish' });
                }
                break;
              }
              // Auto log: presence events, and Disconnect result
              if (data.body.triggerType === 'presenceUpdate') {
                if (data.body.call.result === 'Disconnected') {
                  data.body.triggerType = 'createLog';
                  isAutoLog = true;
                }
                else {
                  break;
                }
              }
              window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
              const contactPhoneNumber = data.body.call.direction === 'Inbound' ?
                data.body.call.from.phoneNumber :
                data.body.call.to.phoneNumber;

              // Case: log form
              if (data.body.triggerType === 'logForm') {
                let additionalSubmission = {};
                const additionalFields = manifest.platforms[platformName].page?.callLog?.additionalFields ?? [];
                for (const f of additionalFields) {
                  if (data.body.formData[f.const] != "none") {
                    additionalSubmission[f.const] = data.body.formData[f.const];
                  }
                }
                switch (data.body.formData.triggerType) {
                  case 'createLog':
                    let newContactInfo = {};
                    if (data.body.formData.contact === 'createNewContact') {
                      const createContactResult = await createContact({
                        serverUrl: manifest.serverUrl,
                        phoneNumber: contactPhoneNumber,
                        newContactName: data.body.formData.newContactName,
                        newContactType: data.body.formData.newContactType
                      });
                      newContactInfo = createContactResult.contactInfo;
                      const newContactReturnMessage = createContactResult.returnMessage;
                      showNotification({ level: newContactReturnMessage?.messageType, message: newContactReturnMessage?.message, ttl: newContactReturnMessage?.ttl });
                      if (!!extensionUserSettings && extensionUserSettings.find(e => e.id === 'contacts')?.items?.find(e => e.id === 'openContactPageAfterCreation')?.value) {
                        await openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
                      }
                    }
                    await addLog(
                      {
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        logInfo: data.body.call,
                        isMain: true,
                        note: data.body.formData.note ?? "",
                        subject: data.body.formData.activityTitle ?? "",
                        additionalSubmission,
                        contactId: newContactInfo?.id ?? data.body.formData.contact,
                        contactType: data.body.formData.newContactName === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName
                      });
                    if (!!data.body.formData.isUnresolved) {
                      await showUnresolvedTabPage(data.path);
                    }
                    break;
                  case 'editLog':
                    await updateLog({
                      serverUrl: manifest.serverUrl,
                      logType: 'Call',
                      sessionId: data.body.call.sessionId,
                      subject: data.body.formData.activityTitle ?? "",
                      note: data.body.formData.note ?? "",
                    });
                    break;
                }
              }
              // Cases: open form when 1.create 2.edit 3.view on CRM page
              else {
                const { callLogs: fetchedCallLogs } = await getLog({
                  serverUrl: manifest.serverUrl,
                  logType: 'Call',
                  sessionIds: data.body.call.sessionId,
                  requireDetails: data.body.triggerType === 'editLog'
                });
                const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber });
                showNotification({ level: callLogContactMatchMessage?.messageType, message: callLogContactMatchMessage?.message, ttl: callLogContactMatchMessage?.ttl });
                if (!callContactMatched) {
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                }
                let note = '';
                let callLogSubject = ''
                switch (data.body.triggerType) {
                  // createLog and editLog share the same page
                  case 'createLog':
                    note = await getCachedNote({ sessionId: data.body.call.sessionId });
                  case 'editLog':
                    if (!!fetchedCallLogs) {
                      if (!!fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId)?.logData?.note) {
                        note = fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId).logData.note;
                      }
                      if (fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId)?.logData?.subject) {
                        callLogSubject = fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId).logData.subject;
                      }
                    }
                    const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog, contactInfo: callMatchedContact, logType: 'Call', direction: data.body.call.direction, isVoicemail: false });
                    if (isAutoLog && !callAutoPopup) {
                      // Case: auto log but encountering multiple selection that needs user input, so shown as conflicts
                      if (hasConflict) {
                        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                        const conflictLog = await cacheUnresolvedLog({
                          type: 'Call',
                          id: data.body.call.sessionId,
                          phoneNumber: contactPhoneNumber,
                          direction: data.body.call.direction,
                          contactInfo: callMatchedContact ?? [],
                          subject: callLogSubject,
                          note,
                          date: moment(data.body.call.startTime).format('MM/DD/YYYY')
                        });
                        await showUnresolvedTabPage();
                        const conflictContent = getConflictContentFromUnresolvedLog(conflictLog);
                        showNotification({ level: 'warning', message: `Call not logged. ${conflictContent.description}. Please log it manually on call history page`, ttl: 5000 });
                      }
                      // Case: auto log and no conflict, log directly
                      else {
                        callLogSubject = data.body.call.direction === 'Inbound' ?
                          `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
                          `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
                        await addLog(
                          {
                            serverUrl: manifest.serverUrl,
                            logType: 'Call',
                            logInfo: data.body.call,
                            isMain: true,
                            note,
                            subject: callLogSubject,
                            additionalSubmission: autoSelectAdditionalSubmission,
                            contactId: callMatchedContact[0]?.id,
                            contactType: callMatchedContact[0]?.type,
                            contactName: callMatchedContact[0]?.name
                          });
                      }
                    }
                    // Case: auto log OFF, open log page
                    else {
                      let loggedContactId = null;
                      const existingCallLogRecord = await chrome.storage.local.get(`rc-crm-call-log-${data.body.call.sessionId}`);
                      if (!!existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`]) {
                        loggedContactId = existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`].contact.id;
                      }
                      // add your codes here to log call to your service
                      const callPage = logPage.getLogPageRender({ id: data.body.call.sessionId, manifest, logType: 'Call', triggerType: data.body.triggerType, platformName, direction: data.body.call.direction, contactInfo: callMatchedContact ?? [], subject: callLogSubject, note, loggedContactId });
                      // CASE: Bullhorn default action code
                      if (platformName === 'bullhorn') {
                        if (!!extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')) {
                          if (data.body.call.direction === 'Inbound') {
                            const inboundCallDefaultNoteAction = extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items?.find(i => i.id === "bullhornInboundCallNoteAction");
                            if (!!inboundCallDefaultNoteAction && callPage.schema.properties.noteActions?.oneOf.some(o => o.const === inboundCallDefaultNoteAction.value)) {
                              callPage.formData.noteActions = inboundCallDefaultNoteAction.value;
                            }
                          }
                          else {
                            const outboundCallDefaultNoteAction = extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items?.find(i => i.id === "bullhornOutboundCallNoteAction");
                            if (!!outboundCallDefaultNoteAction && callPage.schema.properties.noteActions?.oneOf.some(o => o.const === outboundCallDefaultNoteAction.value)) {
                              callPage.formData.noteActions = outboundCallDefaultNoteAction.value;
                            }
                          }
                        }
                      }
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-update-call-log-page',
                        page: callPage,
                      }, '*');

                      // navigate to call log page
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-navigate-to',
                        path: `/log/call/${data.body.call.sessionId}`,
                      }, '*');
                    }
                    break;
                  case 'viewLog':
                    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                    const matchedEntity = data.body.call.direction === 'Inbound' ? data.body.fromEntity : data.body.toEntity;
                    if (manifest.platforms[platformName].canOpenLogPage) {
                      openLog({ manifest, platformName, hostname: platformHostname, logId: fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId)?.logId, contactType: matchedEntity.contactType });
                    }
                    else {
                      await openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: matchedEntity.id, contactType: matchedEntity.contactType });
                    }
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                    break;
                }
              }
              // response to widget
              responseMessage(
                data.requestId,
                {
                  data: 'ok'
                }
              );
              window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              break;
            case '/callLogger/inputChanged':
              await cacheCallNote({
                sessionId: data.body.call.sessionId,
                note: data.body.formData.note ?? ''
              });
              const page = logPage.getUpdatedLogPageRender({ manifest, platformName, updateData: data.body });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-update-call-log-page',
                page
              }, '*');
              responseMessage(
                data.requestId,
                {
                  data: 'ok'
                }
              );
              break;
            case '/callLogger/match':
              let callLogMatchData = {};
              const { successful, callLogs } = await getLog({ serverUrl: manifest.serverUrl, logType: 'Call', sessionIds: data.body.sessionIds.toString(), requireDetails: false });
              if (successful) {
                for (const sessionId of data.body.sessionIds) {
                  const correspondingLog = callLogs.find(l => l.sessionId === sessionId);
                  if (!!correspondingLog?.matched) {
                    const existingCallLogRecord = await chrome.storage.local.get(`rc-crm-call-log-${sessionId}`);
                    if (!!existingCallLogRecord[`rc-crm-call-log-${sessionId}`]) {
                      callLogMatchData[sessionId] = [{ id: sessionId, note: '', contact: { id: existingCallLogRecord[`rc-crm-call-log-${sessionId}`].contact?.id } }];
                    }
                    else {
                      callLogMatchData[sessionId] = [{ id: sessionId, note: '' }];
                    }
                  }
                }
              }
              responseMessage(
                data.requestId,
                {
                  data: callLogMatchData
                });
              break;
            case '/messageLogger':
              // Case: when auto log and auto pop turned ON, we need to know which event is for the conversation that user is looking at
              if (!!!autoPopupMainConverastionId) {
                autoPopupMainConverastionId = data.body.conversation.conversationId;
              }
              if (!!data?.body?.conversation?.correspondents[0]?.extensionNumber) {
                showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                break;
              }
              const { rc_messageLogger_auto_log_notify: messageAutoLogOn } = await chrome.storage.local.get({ rc_messageLogger_auto_log_notify: false });
              const messageAutoPopup = !!extensionUserSettings && extensionUserSettings?.find(e => e.id === "popupLogPageAfterSMS")?.value;
              const messageLogPrefId = `rc-crm-conversation-pref-${data.body.conversation.conversationId}`;
              const existingConversationLogPref = await chrome.storage.local.get(messageLogPrefId);
              let getContactMatchResult = null;
              window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
              // Case: auto log
              if (messageAutoLogOn && data.body.triggerType === 'auto' && !messageAutoPopup) {
                // Sub-case: has existing pref setup, log directly
                if (!!existingConversationLogPref[messageLogPrefId]) {
                  await addLog({
                    serverUrl: manifest.serverUrl,
                    logType: 'Message',
                    logInfo: data.body.conversation,
                    isMain: true,
                    note: '',
                    additionalSubmission: existingConversationLogPref[messageLogPrefId].additionalSubmission,
                    contactId: existingConversationLogPref[messageLogPrefId].contact.id,
                    contactType: existingConversationLogPref[messageLogPrefId].contact.type,
                    contactName: existingConversationLogPref[messageLogPrefId].contact.name
                  });
                }
                else {
                  getContactMatchResult = (await getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber
                  })).contactInfo;
                  const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog: messageAutoLogOn, contactInfo: getContactMatchResult, logType: 'Message', isVoicemail: true });
                  // Sub-case: has conflict, cache unresolved log
                  if (hasConflict) {
                    const conflictLog = await cacheUnresolvedLog({
                      type: 'Message',
                      id: data.body.conversation.conversationId,
                      direction: '',
                      contactInfo: getContactMatchResult ?? [],
                      date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
                    });
                    await showUnresolvedTabPage();
                    const conflictContent = getConflictContentFromUnresolvedLog(conflictLog);
                    showNotification({ level: 'warning', message: `Message not logged. ${conflictContent.description}. Review all conflict on the "Unlogged" tab.`, ttl: 5000 });
                  }
                  // Sub-case: no conflict, log directly
                  else {
                    await addLog({
                      serverUrl: manifest.serverUrl,
                      logType: 'Message',
                      logInfo: data.body.conversation,
                      isMain: true,
                      note: '',
                      additionalSubmission: autoSelectAdditionalSubmission,
                      contactId: getContactMatchResult[0]?.id,
                      contactType: getContactMatchResult[0]?.type,
                      contactName: getContactMatchResult[0]?.name
                    });
                  }
                }
                window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              }
              // Case: manual log, submit
              else if (data.body.triggerType === 'logForm') {
                if (data.body.redirect) {
                  let additionalSubmission = {};
                  const additionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
                  for (const f of additionalFields) {
                    if (data.body.formData[f.const] != "none") {
                      additionalSubmission[f.const] = data.body.formData[f.const];
                    }
                  }
                  let newContactInfo = {};
                  if (data.body.formData.contact === 'createNewContact') {
                    const newContactResp = await createContact({
                      serverUrl: manifest.serverUrl,
                      phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                      newContactName: data.body.formData.newContactName,
                      newContactType: data.body.formData.newContactType
                    });
                    newContactInfo = newContactResp.contactInfo;
                    if (!!extensionUserSettings && extensionUserSettings.find(e => e.id === 'contacts')?.items?.find(e => e.id === 'openContactPageAfterCreation')?.value) {
                      await openContactPage({ manifest, platformName, phoneNumber: data.body.conversation.correspondents[0].phoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
                    }
                  }
                  await addLog({
                    serverUrl: manifest.serverUrl,
                    logType: 'Message',
                    logInfo: data.body.conversation,
                    isMain: true,
                    note: '',
                    additionalSubmission,
                    contactId: newContactInfo?.id ?? data.body.formData.contact,
                    contactType: data.body.formData.newContactName === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                    contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName
                  });
                  for (const trailingConversations of trailingSMSLogInfo) {
                    await addLog({
                      serverUrl: manifest.serverUrl,
                      logType: 'Message',
                      logInfo: trailingConversations,
                      isMain: false,
                      note: '',
                      additionalSubmission,
                      contactId: newContactInfo?.id ?? data.body.formData.contact,
                      contactType: data.body.formData.newContactName === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                      contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName
                    });
                  }
                  if (!!data.body.formData.isUnresolved) {
                    await showUnresolvedTabPage(data.path);
                  }
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                }
              }
              // Case: manual log, open page OR auto log with auto pop up log page ON
              else {
                if ((!messageAutoLogOn && data.body.triggerType === 'auto') || (data.body.redirect != undefined && data.body.prefill != undefined && !data.body.redirect && !data.body.prefill)) {
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                }
                const isTrailing = !data.body.redirect && data.body.triggerType !== 'auto';
                if (isTrailing) {
                  if (!leadingSMSCallReady) {
                    trailingSMSLogInfo.push(data.body.conversation);
                    break;
                  }
                }
                else {
                  leadingSMSCallReady = false;
                  trailingSMSLogInfo = [];
                }
                if (!isTrailing) {
                  getContactMatchResult = await getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber
                  });
                }
                // add your codes here to log call to your service
                const messagePage = logPage.getLogPageRender({
                  id: data.body.conversation.conversationId,
                  manifest,
                  logType: 'Message',
                  triggerType: data.body.triggerType,
                  platformName,
                  direction: '',
                  contactInfo: getContactMatchResult.contactInfo ?? []
                });
                // CASE: Bullhorn default action code
                if (platformName === 'bullhorn') {
                  const bullhornDefaultNoteAction = extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction');
                  if (data.body.conversation.type === 'VoiceMail') {
                    const voicemailDefaultNoteAction = bullhornDefaultNoteAction?.items?.find(i => i.id === "bullhornVoicemailNoteAction");
                    if (!!voicemailDefaultNoteAction && getContactMatchResult.contactInfo[0].additionalInfo.noteActions?.some(o => o.const === voicemailDefaultNoteAction.value)) {
                      messagePage.formData.noteActions = voicemailDefaultNoteAction.value
                    }
                  }
                  else {
                    const smsDefaultNoteAction = bullhornDefaultNoteAction?.items?.find(i => i.id === "bullhornMessageNoteAction");
                    if (!!smsDefaultNoteAction && getContactMatchResult.contactInfo[0].additionalInfo.noteActions?.some(o => o.const === smsDefaultNoteAction.value)) {
                      messagePage.formData.noteActions = smsDefaultNoteAction.value
                    }
                  }
                }

                // to stop following unlogged message events override current message log page
                if (messageAutoLogOn && data.body.triggerType === 'auto' && messageAutoPopup && data.body.conversation.conversationId != autoPopupMainConverastionId) {
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                }

                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-update-messages-log-page',
                  page: messagePage
                }, '*');

                // navigate to message log page
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-navigate-to',
                  path: `/log/messages/${data.body.conversation.conversationId}`, // conversation id that you received from message logger event
                }, '*');

                if (!isTrailing) {
                  leadingSMSCallReady = true;
                }
                window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              }
              // response to widget
              responseMessage(
                data.requestId,
                {
                  data: 'ok'
                }
              );
              break;
            case '/messageLogger/inputChanged':
              const updatedPage = logPage.getUpdatedLogPageRender({ manifest, logType: 'Message', platformName, updateData: data.body });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-update-messages-log-page',
                page: updatedPage
              }, '*');
              responseMessage(
                data.requestId,
                {
                  data: 'ok'
                }
              );
              break;
            case '/messageLogger/match':
              let localMessageLogs = {};
              const messageMatchPromises = data.body.conversationLogIds.map(async (conversationLogId) => {
                const savedMessageLogRecord = await chrome.storage.local.get(conversationLogId);
                return { conversationLogId, savedMessageLogRecord };
              });
              const messageMatchResults = await Promise.all(messageMatchPromises);
              messageMatchResults.forEach(({ conversationLogId, savedMessageLogRecord }) => {
                if (!!savedMessageLogRecord && !isObjectEmpty(savedMessageLogRecord)) {
                  localMessageLogs[conversationLogId] = [{ id: 'dummyId' }];
                }
              });
              responseMessage(
                data.requestId,
                {
                  data: localMessageLogs
                }
              );
              break;
            case '/settings':
              extensionUserSettings = data.body.settings;
              await chrome.storage.local.set({ extensionUserSettings });
              if (data.body.setting.id === "toggleDeveloperMode") {
                showNotification({ level: 'success', message: `Developer mode is turn ${data.body.setting.value ? 'ON' : 'OFF'}. Please reload the extension.`, ttl: 5000 });
              }
              break;
            case '/custom-button-click':
              switch (data.body.button.id) {
                case 'insightlyGetApiKey':
                  const platformInfo = await chrome.storage.local.get('platform-info');
                  const hostname = platformInfo['platform-info'].hostname;
                  window.open(`https://${hostname}/Users/UserSettings`);
                  break;
                case 'authPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const returnedToken = await auth.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: data.body.button.formData.apiKey, apiUrl: data.body.button.formData.apiUrl, username: data.body.button.formData.username, password: data.body.button.formData.password });
                  crmAuthed = !!returnedToken;
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'feedbackPage':
                  // const platformNameInUrl = platformName.charAt(0).toUpperCase() + platformName.slice(1)
                  let formUrl = manifest.platforms[platformName].page.feedback.url
                  for (const formKey of Object.keys(data.body.button.formData)) {
                    formUrl = formUrl.replace(`{${formKey}}`, encodeURIComponent(data.body.button.formData[formKey]));
                  }
                  formUrl = formUrl
                    .replace('{crmName}', manifest.platforms[platformName].displayName)
                    .replace('{userName}', rcUserInfo.rcUserName)
                    .replace('{userEmail}', rcUserInfo.rcUserEmail)
                    .replace('{version}', manifest.version)
                  window.open(formUrl, '_blank');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  break;
                case 'openSupportPage':
                  let isOnline = false;
                  try {
                    const isServiceOnlineResponse = await axios.get(`${manifest.serverUrl}/is-alive`);
                    isOnline = isServiceOnlineResponse.status === 200;
                  }
                  catch (e) {
                    isOnline = false;
                  }
                  const supportPageRender = supportPage.getSupportPageRender({ manifest, isOnline });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: supportPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/supportPage', // page id
                  }, '*');
                  break;
                case 'openAboutPage':
                  const aboutPageRender = aboutPage.getAboutPageRender({ manifest });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: aboutPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/aboutPage', // page id
                  }, '*');
                  break;
                case 'openDeveloperSettingsPage':
                  const { customCrmManifestUrl } = await chrome.storage.local.get({ customCrmManifestUrl: '' });

                  const developerSettingsPageRender = developerSettingsPage.getDeveloperSettingsPageRender({ customUrl: customCrmManifestUrl });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: developerSettingsPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/developerSettingsPage', // page id
                  }, '*');
                  break;
                case 'clearLogConflictsButton':
                  await chrome.storage.local.remove('unresolvedLogs');
                  showNotification({ level: 'success', message: 'All unresolved logs cleared', ttl: 3000 });
                  break;
                case 'factoryResetButton':
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                  if (!!rcUnifiedCrmExtJwt) {
                    await auth.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
                  }
                  await chrome.storage.local.remove('platform-info');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-logout'
                  }, '*');
                  await chrome.storage.local.remove('unresolvedLogs');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  trackFactoryReset();
                  break;
                case 'generateErrorLogButton':
                  const errorLogFileName = "[RingCentral CRM Extension]ErrorLogs.txt";
                  const errorLogFileContent = JSON.stringify(errorLogs);
                  DownloadTextFile({ filename: errorLogFileName, text: errorLogFileContent });
                  break;
                case 'checkForUpdateButton':
                  const registeredVersionInfo = await chrome.storage.local.get('rc-crm-extension-version');
                  const localVersion = registeredVersionInfo['rc-crm-extension-version'];
                  const onlineVerison = manifest.version;
                  if (localVersion === onlineVerison) {
                    showNotification({ level: 'success', message: `You are using the latest version (${localVersion})`, ttl: 5000 });
                  }
                  else {
                    showNotification({ level: 'warning', message: `New version (${onlineVerison}) is available, please go to chrome://extensions and press "Update"`, ttl: 5000 });
                  }
                  break;
                case 'openFeedbackPageButton':
                  chrome.runtime.sendMessage({
                    type: "openPopupWindow",
                    navigationPath: "/feedback"
                  });
                  break;
                case 'documentation':
                  if (!!platform?.documentationUrl) {
                    window.open(platform.documentationUrl);
                    trackPage('/documentation');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Documentation URL is not set', ttl: 3000 });
                  }
                  break;
                case 'releaseNotes':
                  if (!!platform?.releaseNotesUrl) {
                    window.open(platform.releaseNotesUrl);
                    trackPage('/releaseNotes');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Release notes URL is not set', ttl: 3000 });
                  }
                  break;
                case 'getSupport':
                  if (!!platform?.getSupportUrl) {
                    window.open(platform.getSupportUrl);
                    trackPage('/getSupport');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Get support URL is not set', ttl: 3000 });
                  }
                  break;
                case 'writeReview':
                  if (!!platform?.writeReviewUrl) {
                    window.open(platform.writeReviewUrl);
                    trackPage('/writeReview');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Write review URL is not set', ttl: 3000 });
                  }
                  break;
                case 'developerSettingsPage':
                  try {
                    const customManifestUrl = data.body.button.formData.customManifestUrl;
                    if (customManifestUrl === '') {
                      return;
                    }
                    await chrome.storage.local.set({ customCrmManifestUrl: customManifestUrl });

                    await chrome.storage.local.remove('customCrmManifest');
                    const customCrmManifestJson = await (await fetch(customManifestUrl)).json();
                    if (customCrmManifestJson) {
                      await chrome.storage.local.set({ customCrmManifest: customCrmManifestJson });
                      showNotification({ level: 'success', message: 'Custom manifest file updated. Please reload the extension.', ttl: 5000 });
                    }
                  }
                  catch (e) {
                    showNotification({ level: 'warning', message: 'Failed to get custom manifest file', ttl: 5000 });
                  }
                  break;
                case 'clearPlatformInfoButton':
                  await chrome.storage.local.remove('platform-info');
                  showNotification({ level: 'success', message: 'Platform info cleared. Please close the extension and open from CRM page.', ttl: 5000 });
                  break;
              }
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-post-message-response',
                responseId: data.requestId,
                response: { data: 'ok' },
              }, '*');
              break;
            default:
              break;
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
    if (e.response && e.response.data && !noShowNotification && typeof e.response.data === 'string') {
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

function DownloadTextFile({ filename, text }) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}


function getLogConflictInfo({ isAutoLog, contactInfo, logType, direction, isVoicemail }) {
  if (!isAutoLog) {
    return { hasConflict: false, autoSelectAdditionalSubmission: {} }
  }
  let hasConflict = false;
  let autoSelectAdditionalSubmission = {};
  contactInfo = contactInfo.filter(c => !c.isNewContact);
  if (contactInfo.length === 0) {
    hasConflict = true;
  }
  else if (contactInfo.length > 1) {
    hasConflict = true;
  }
  else if (!!contactInfo[0]?.additionalInfo) {
    // CASE: Bullhorn default action code
    if (platformName === 'bullhorn' && !!extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items?.find(i => i.id === "bullhornApplyToAutoLog")?.value) {
      hasConflict = true;
      const bullhornDefaultNoteAction = extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction');
      if (!!bullhornDefaultNoteAction) {
        if (logType === 'Call') {
          if (direction === 'Inbound') {
            const inboundCallDefaultNoteAction = bullhornDefaultNoteAction.items.find(i => i.id === "bullhornInboundCallNoteAction");
            if (!!inboundCallDefaultNoteAction && contactInfo[0].additionalInfo.noteActions?.some(o => o.const === inboundCallDefaultNoteAction.value)) {
              autoSelectAdditionalSubmission = {
                noteActions: inboundCallDefaultNoteAction.value
              };
              hasConflict = false;
            }
          }
          else {
            const outboundCallDefaultNoteAction = bullhornDefaultNoteAction.items.find(i => i.id === "bullhornOutboundCallNoteAction");
            if (!!outboundCallDefaultNoteAction && contactInfo[0].additionalInfo.noteActions?.some(o => o.const === outboundCallDefaultNoteAction.value)) {
              autoSelectAdditionalSubmission = {
                noteActions: outboundCallDefaultNoteAction.value
              };
              hasConflict = false;
            }
          }
        }
        else if (logType === 'Message') {
          if (isVoicemail) {
            const voicemailDefaultNoteAction = bullhornDefaultNoteAction?.items?.find(i => i.id === "bullhornVoicemailNoteAction");
            if (!!voicemailDefaultNoteAction && contactInfo[0].additionalInfo.noteActions?.some(o => o.const === voicemailDefaultNoteAction.value)) {
              autoSelectAdditionalSubmission = {
                noteActions: voicemailDefaultNoteAction.value
              };
              hasConflict = false;
            }
          }
          else {
            const smsDefaultNoteAction = bullhornDefaultNoteAction.items.find(i => i.id === "bullhornMessageNoteAction");
            if (!!smsDefaultNoteAction && contactInfo[0].additionalInfo.noteActions?.some(o => o.const === smsDefaultNoteAction.value)) {
              autoSelectAdditionalSubmission = {
                noteActions: smsDefaultNoteAction.value
              };
              hasConflict = false;
            }
          }
        }
      }
    }
    else {
      const additionalFieldsKeys = Object.keys(contactInfo[0].additionalInfo);
      for (const key of additionalFieldsKeys) {
        const field = contactInfo[0].additionalInfo[key];
        if (Array.isArray(field)) {
          if (field.length > 1) {
            hasConflict = true;
          }
          else {
            autoSelectAdditionalSubmission[key] = field[0].const;
          }
        }
      }
    }
  }
  return { hasConflict, autoSelectAdditionalSubmission }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'oauthCallBack') {
    if (request.platform === 'rc') {
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-authorization-code',
        callbackUri: request.callbackUri,
      }, '*');
      // remove previous crm auth if existing
      await chrome.storage.local.remove('rcUnifiedCrmExtJwt');
    }
    else if (request.platform === 'thirdParty') {
      const returnedToken = await auth.onAuthCallback({ serverUrl: manifest.serverUrl, callbackUri: request.callbackUri });
      crmAuthed = !!returnedToken;
      if (crmAuthed) {
        await dismissNotification({ notificationId: currentNotificationId });
      }
    }
    sendResponse({ result: 'ok' });
  }
  // Unique: Pipedrive
  else if (request.type === 'pipedriveCallbackUri' && !(await auth.checkAuth())) {
    await auth.onAuthCallback({ serverUrl: manifest.serverUrl, callbackUri: `${request.pipedriveCallbackUri}&state=platform=pipedrive` });
    crmAuthed = true;
    await dismissNotification({ notificationId: currentNotificationId });
    console.log('pipedriveAltAuthDone')
    chrome.runtime.sendMessage(
      {
        type: 'pipedriveAltAuthDone'
      }
    );
  }
  else if (request.type === 'c2sms') {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-new-sms',
      phoneNumber: request.phoneNumber,
      conversation: true, // will go to conversation page if conversation existed
    }, '*');
    sendResponse({ result: 'ok' });
  } else if (request.type === 'c2d') {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-new-call',
      phoneNumber: request.phoneNumber,
      toCall: true,
    }, '*');
    sendResponse({ result: 'ok' });
  }
  else if (request.type === 'navigate') {
    if (request.path === '/feedback') {
      const feedbackPageRender = feedbackPage.getFeedbackPageRender({ pageConfig: manifest.platforms[platformName].page.feedback, version: manifest.version });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: feedbackPageRender
      });
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: `/customized/${feedbackPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
      }, '*');
      trackOpenFeedback();
    }
    else {
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-navigate-to',
        path: request.path, // '/meeting', '/dialer', '//history', '/settings'
      }, '*');
    }
    sendResponse({ result: 'ok' });
  }
  else if (request.type === 'insightlyAuth') {
    const returnedToken = await apiKeyLogin({
      serverUrl: manifest.serverUrl,
      apiKey: request.apiKey,
      apiUrl: request.apiUrl
    });
    crmAuthed = !!returnedToken;
    if (crmAuthed) {
      await dismissNotification({ notificationId: currentNotificationId });
    }
    window.postMessage({ type: 'rc-apiKey-input-modal-close', platform: platform.name }, '*');
    chrome.runtime.sendMessage({
      type: 'openPopupWindow'
    });
  }
});

function handleRCOAuthWindow(oAuthUri) {
  chrome.runtime.sendMessage({
    type: 'openRCOAuthWindow',
    oAuthUri,
  });
}

function handleThirdPartyOAuthWindow(oAuthUri) {
  chrome.runtime.sendMessage({
    type: 'openThirdPartyAuthWindow',
    oAuthUri
  });
}

function renderCRMSetupErrorPage() {
  const crmSetupErrorPageRender = crmSetupErrorPage.getCRMSetupErrorPageRender();
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-register-customized-page',
    page: crmSetupErrorPageRender
  });
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/crmSetupErrorPage', // page id
  }, '*');
}

async function getServiceManifest(serviceName) {
  const services = {
    name: serviceName,
    displayName: platform.displayName,
    customizedPageInputChangedEventPath: '/customizedPage/inputChanged',
    contactMatchPath: '/contacts/match',
    viewMatchedContactPath: '/contacts/view',
    contactMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact match cache time in seconds, set as 7 days
    contactNoMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact no match cache time in seconds, default is 5 minutes, from v1.10.2

    // show auth/unauth button in ringcentral widgets
    authorizationPath: '/authorize',
    authorizedTitle: 'Logout',
    unauthorizedTitle: 'Connect',
    authorizationLogo: platform?.logoUrl ?? '',
    showAuthRedDot: true,
    authorized: false,
    authorizedAccount: '',
    info: `Developed by ${manifest?.author?.name ?? 'Unknown'}`,

    // Enable call log sync feature
    callLoggerPath: '/callLogger',
    callLogPageInputChangedEventPath: '/callLogger/inputChanged',
    callLogEntityMatcherPath: '/callLogger/match',
    callLoggerAutoSettingLabel: 'Log phone calls automatically',

    messageLoggerPath: '/messageLogger',
    messagesLogPageInputChangedEventPath: '/messageLogger/inputChanged',
    messageLogEntityMatcherPath: '/messageLogger/match',
    messageLoggerAutoSettingLabel: 'Log SMS conversations automatically',

    settingsPath: '/settings',
    settings: [
      {
        id: "popupLogPageAfterCall",
        type: "boolean",
        groupId: "logging",
        name: 'Open call logging page after call',
        value: !!extensionUserSettings && (extensionUserSettings.find(e => e.id === "popupLogPageAfterCall")?.value ?? false)
      },
      {
        id: "popupLogPageAfterSMS",
        type: "boolean",
        groupId: "logging",
        name: 'Open SMS logging page after message',
        value: !!extensionUserSettings && (extensionUserSettings.find(e => e.id === "popupLogPageAfterSMS")?.value ?? false)
      },
      {
        id: 'contacts',
        type: 'section',
        name: 'Contacts',
        items: [
          {
            id: "numberFormatterTitle",
            name: "Contact page",
            type: "typography",
            variant: "title2",
            value: "Open contact page",
          },
          {
            id: 'openContactPageFromIncomingCall',
            type: 'option',
            name: 'Open contact from incoming call',
            options: [
              {
                id: 'disabled',
                name: 'Disabled'
              },
              {
                id: 'onFirstRing',
                name: 'On first ring'
              },
              {
                id: 'onAnswer',
                name: 'On answer'
              }
            ],
            value: extensionUserSettings?.find(e => e.id === 'contacts')?.items.find(e => e.id === "openContactPageFromIncomingCall")?.value ?? 'disabled'
          },
          {
            id: 'openContactPageFromOutgoingCall',
            type: 'option',
            name: 'Open contact from outgoing call',
            options: [
              {
                id: 'disabled',
                name: 'Disabled'
              },
              {
                id: 'onFirstRing',
                name: 'On first ring'
              },
              {
                id: 'onAnswer',
                name: 'On answer'
              }
            ],
            value: extensionUserSettings?.find(e => e.id === 'contacts')?.items.find(e => e.id === "openContactPageFromOutgoingCall")?.value ?? 'disabled'
          },
          {
            id: 'openContactPageAfterCreation',
            type: 'boolean',
            name: 'Open contact after creating it',
            value: !!extensionUserSettings && (extensionUserSettings.find(e => e.id === 'contacts')?.items.find(e => e.id === "openContactPageAfterCreation")?.value ?? true)
          }
        ]
      },
      {
        id: "openSupportPage",
        type: "button",
        name: "Support",
        buttonLabel: "Open",
        buttonType: "link",
      },
      {
        id: "openAboutPage",
        type: "button",
        name: "About",
        buttonLabel: "Open",
        buttonType: "link",
      },
      {
        id: "advancedFeatures",
        type: "group",
        name: "Advanced features",
        items: [
          {
            id: 'toggleDeveloperMode',
            type: 'boolean',
            name: 'Developer mode',
            value: !!extensionUserSettings && (extensionUserSettings.find(e => e.id === 'advancedFeatures')?.items.find(e => e.id === "toggleDeveloperMode")?.value ?? false)
          }
        ]
      }
    ],

    buttonEventPath: '/custom-button-click'
  }
  if (serviceName === 'bullhorn') {
    services.settings.unshift(
      {
        id: "bullhornDefaultNoteAction",
        type: "section",
        name: "Bullhorn options",
        items: [
          {
            id: "bullhornInboundCallNoteAction",
            type: "string",
            name: "Default action for inbound calls",
            value: extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items.find(i => i.id === 'bullhornInboundCallNoteAction')?.value ?? "",
            placeholder: "Enter action value"
          },
          {
            id: "bullhornOutboundCallNoteAction",
            type: "string",
            name: "Default action for outbound calls",
            value: extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items.find(i => i.id === 'bullhornOutboundCallNoteAction')?.value ?? "",
            placeholder: "Enter action value"
          },
          {
            id: "bullhornMessageNoteAction",
            type: "string",
            name: "Default action for SMS",
            value: extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items.find(i => i.id === 'bullhornMessageNoteAction')?.value ?? "",
            placeholder: "Enter action value"
          },
          {
            id: "bullhornVoicemailNoteAction",
            type: "string",
            name: "Default action for voicemails",
            value: extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items.find(i => i.id === 'bullhornVoicemailNoteAction')?.value ?? "",
            placeholder: "Enter action value"
          },
          {
            id: "bullhornApplyToAutoLog",
            type: "boolean",
            name: "Use default values for auto-logged notes",
            value: extensionUserSettings?.find(e => e.id === 'bullhornDefaultNoteAction')?.items.find(i => i.id === 'bullhornApplyToAutoLog')?.value ?? false,
          },
        ]
      });
  };
  if (serviceName === 'clio' || serviceName === 'insightly') {
    // TEMP
    const { overridingPhoneNumberFormat, overridingPhoneNumberFormat2, overridingPhoneNumberFormat3 } =
      await chrome.storage.local.get({ overridingPhoneNumberFormat: null, overridingPhoneNumberFormat2: null, overridingPhoneNumberFormat3: null });
    if (!!overridingPhoneNumberFormat || !!overridingPhoneNumberFormat2 || !!overridingPhoneNumberFormat3) {
      await chrome.storage.local.remove('overridingPhoneNumberFormat');
      await chrome.storage.local.remove('overridingPhoneNumberFormat2');
      await chrome.storage.local.remove('overridingPhoneNumberFormat3');
    }
    const numberFormatterComponent = [
      {
        id: "info",
        name: "info",
        type: "admonition",
        severity: "warning",
        value: "Please input your overriding phone number format: (please use * to represent a number, eg. (***) ***-****)",
      },
      {
        id: "overridingPhoneNumberFormat",
        name: "Format 1",
        type: "string",
        value: overridingPhoneNumberFormat ?? (!!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat')?.value ?? "")),
      },
      {
        id: "overridingPhoneNumberFormat2",
        name: "Format 2",
        type: "string",
        value: overridingPhoneNumberFormat2 ?? (!!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat2')?.value ?? "")),
      },
      {
        id: "overridingPhoneNumberFormat3",
        name: "Format 3",
        type: "string",
        value: overridingPhoneNumberFormat3 ?? (!!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Contacts')?.items.find(e => e.id === 'overridingPhoneNumberFormat3')?.value ?? "")),
      }
    ]
    services.settings.find(s => s.id === 'contacts').items.push(
      {
        id: "numberFormatterTitle",
        name: "Number formatter",
        type: "typography",
        variant: "title2",
        value: "Phone number format alternatives",
      });
    services.settings.find(s => s.id === 'contacts').items.push(...numberFormatterComponent);
  }

  if (!!extensionUserSettings && (extensionUserSettings.find(e => e.id === 'advancedFeatures')?.items.find(e => e.id === "toggleDeveloperMode")?.value)) {
    services.settings.push(
      {
        id: 'openDeveloperSettingsPage',
        type: 'button',
        name: 'Developer settings',
        buttonLabel: 'Open',
        buttonType: "link",
      }
    )
  }
  return services;
}