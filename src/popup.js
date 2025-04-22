import auth from './core/auth';
import logCore from './core/log';
import contactCore from './core/contact';
import dispositionCore from './core/disposition';
import userCore from './core/user';
import adminCore from './core/admin';
import authCore from './core/auth';
import { downloadTextFile, checkC2DCollision, responseMessage, isObjectEmpty, showNotification, dismissNotification, getRcInfo, getRcAccessToken, getPlatformInfo } from './lib/util';
import { getUserInfo } from './lib/rcAPI';
import moment from 'moment';
import logPage from './components/logPage';
import authPage from './components/authPage';
import feedbackPage from './components/feedbackPage';
import releaseNotesPage from './components/releaseNotesPage';
import supportPage from './components/supportPage';
import aboutPage from './components/aboutPage';
import developerSettingsPage from './components/developerSettingsPage';
import adminPage from './components/admin/adminPage';
import managedSettingsPage from './components/admin/managedSettingsPage';
import callAndSMSLoggingSettingPage from './components/admin/managedSettings/callAndSMSLoggingSettingPage';
import customAdapterPage from './components/admin/customAdapterPage';
import serverSideLoggingPage from './components/admin/serverSideLoggingPage';
import contactSettingPage from './components/admin/managedSettings/contactSettingPage';
import advancedFeaturesSettingPage from './components/admin/managedSettings/advancedFeaturesSettingPage';
import customSettingsPage from './components/admin/managedSettings/customSettingsPage';
import tempLogNotePage from './components/tempLogNotePage';
import googleSheetsPage from './components/platformSpecific/googleSheetsPage';
import {
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
  trackUpdateCallRecordingLink,
  trackFactoryReset
} from './lib/analytics';

import logService from './service/logService';
import embeddableServices from './service/embeddableServices';
import { logPageFormDataDefaulting, getLogConflictInfo } from './lib/logUtil';
import { bullhornHeartbeat } from './misc/bullhorn';

import axios from 'axios';
axios.defaults.timeout = 30000; // Set default timeout to 30 seconds, can be overriden with server manifest

window.__ON_RC_POPUP_WINDOW = 1;

let platformName = '';
let registered = false;
let platformHostname = '';
let rcUserInfo = {};
let firstTimeLogoutAbsorbed = false;
let autoPopupMainConverastionId = null;
let currentNotificationId = null;
let adminSettings = {
  userSettings: {}
};
let userSettings = {};
let crmAuthed = false;
let manifest = {};
let platform = null;
let hasOngoingCall = false;
let lastUserSettingSyncDate = new Date();

checkC2DCollision();
getCustomManifest();

async function getCustomManifest() {
  const { customCrmManifest } = await chrome.storage.local.get({ customCrmManifest: null });
  if (customCrmManifest) {
    manifest = customCrmManifest;
    setAuthor(customCrmManifest.author?.name ?? "");
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
        case 'rc-telephony-session-notify':
          const hasRecording = data.telephonySession.parties.some(p => !!p.recordings);
          if (hasRecording) {
            await chrome.storage.local.set({
              ['rec-link-' + data.telephonySession.sessionId]: {
                link: "(pending...)",
                expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days
              }
            });
          }
          break;
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
        case 'rc-adapter-side-drawer-open-notify':
          chrome.runtime.sendMessage({
            type: 'sideWidgetOpen',
            opened: data.open
          });
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
          break;
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
          if (!registered) {
            const platformInfo = await getPlatformInfo();
            if (!platformInfo) {
              console.error('Cannot find platform info');
              return;
            }
            manifest = (await chrome.storage.local.get({ customCrmManifest: {} }))?.customCrmManifest;
            platform = manifest.platforms[platformInfo.platformName]
            platformName = platformInfo.platformName;
            platformHostname = platformInfo.hostname;
            // setup C2D match all numbers
            if (platform.clickToDialMatchAllNumbers !== undefined) {
              await chrome.storage.local.set({ matchAllNumbers: platform.clickToDialMatchAllNumbers });
            }
            else {
              await chrome.storage.local.set({ matchAllNumbers: false });
            }
            if (platform.requestConfig?.timeout) {
              axios.defaults.timeout = platform.requestConfig.timeout * 1000;
            }
            registered = true;
            const serviceManifest = await embeddableServices.getServiceManifest();
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-register-third-party-service',
              service: serviceManifest
            }, '*');
          }
          break;
        case 'rc-login-status-notify':
          // get login status from widget
          const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} });
          userPermissions.aiNote = data.features && data.features.smartNote;
          await chrome.storage.local.set({ userPermissions });
          console.log('rc-login-status-notify:', data.loggedIn, data.loginNumber, data.contractedCountryCode);

          const platformInfo = await getPlatformInfo();
          if (!platformInfo) {
            console.error('Cannot find platform info');
            return;
          }
          manifest = (await chrome.storage.local.get({ customCrmManifest: {} }))?.customCrmManifest;
          platform = manifest.platforms[platformInfo.platformName]
          platformName = platformInfo.platformName;
          platformHostname = platformInfo.hostname;
          rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
          let { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
          if (data.loggedIn) {
            document.getElementById('rc-widget').style.zIndex = 0;
            crmAuthed = !!rcUnifiedCrmExtJwt;
            await chrome.storage.local.set({ crmAuthed })
            // Manifest case: use RC login to login CRM as well
            if (!crmAuthed && !!platform.autoLoginCRMWithRingCentralLogin) {
              const returnedToken = await auth.authCore.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: getRcAccessToken() });
              crmAuthed = !!returnedToken;
              await chrome.storage.local.set({ crmAuthed })
            }
            if (crmAuthed) {
              // Set every 15min, user settings will refresh
              setInterval(async function () {
                userSettings = await userCore.refreshUserSettings({});
              }, 900000);
              // Submit 
            }
            // Unique: Bullhorn
            if (platform.name === 'bullhorn' && crmAuthed) {
              bullhornHeartbeat();
              // every 30 min, 
              setInterval(function () {
                bullhornHeartbeat();
              }, 1800000);
            }

            // Unique: Pipedrive
            if (platform.name === 'pipedrive' && !(await auth.checkAuth())) {
              chrome.runtime.sendMessage(
                {
                  type: 'popupWindowRequestPipedriveCallbackUri'
                }
              );
            }
            else if (!rcUnifiedCrmExtJwt && !crmAuthed) {
              currentNotificationId = await showNotification({ level: 'warning', message: `Please go to Settings and connect to ${platform.name}`, ttl: 60000 });
            }
            try {
              const rcInfo = await getRcInfo();
              const rcAdditionalSubmission = {};
              if (platform.rcAdditionalSubmission) {
                for (const ras of platform.rcAdditionalSubmission) {
                  const pathSegments = ras.path.split('.');
                  let rcInfoSubmissionValue = null;
                  for (const ps of pathSegments) {
                    if (rcAdditionalSubmission === undefined) {
                      break;
                    }
                    if (rcInfoSubmissionValue === null) {
                      rcInfoSubmissionValue = rcInfo.value[ps];
                    }
                    else {
                      rcInfoSubmissionValue = rcInfoSubmissionValue[ps];
                    }
                  }

                  if (rcInfoSubmissionValue) {
                    rcAdditionalSubmission[ras.id] = rcInfoSubmissionValue;
                  }
                }
              }
              await chrome.storage.local.set({ rcAdditionalSubmission });
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
              identify({ extensionId: rcUserInfo?.rcExtensionId, rcAccountId: rcUserInfo?.rcAccountId, platformName: platform.name });
              group({ rcAccountId: rcUserInfo?.rcAccountId });
              // setup headers for server side analytics
              axios.defaults.headers.common['rc-extension-id'] = rcUserInfo?.rcExtensionId;
              axios.defaults.headers.common['rc-account-id'] = rcUserInfo?.rcAccountId;
              axios.defaults.headers.common['developer-author-name'] = manifest?.author?.name ?? "";
            }
            catch (e) {
              reset();
              console.error(e);
            }
          }

          let { rcLoginStatus } = await chrome.storage.local.get('rcLoginStatus');
          // case 1: fresh login
          if (rcLoginStatus === undefined) {
            if (data.loggedIn) {
              trackRcLogin();
              rcLoginStatus = true;
              await chrome.storage.local.set({ ['rcLoginStatus']: rcLoginStatus });
              const userSettingsByAdmin = await userCore.preloadUserSettingsFromAdmin({ serverUrl: manifest.serverUrl });
              const customManifestUrl = userSettingsByAdmin?.customCrmManifestUrl?.url;
              if (customManifestUrl) {
                console.log('Custom manifest url:', customManifestUrl);
                await chrome.storage.local.set({ customCrmManifestUrl: customManifestUrl });
                await chrome.storage.local.remove('customCrmManifest');
                const customCrmManifestJson = await (await fetch(customManifestUrl)).json();
                if (customCrmManifestJson) {
                  await chrome.storage.local.set({ customCrmManifest: customCrmManifestJson });
                  console.log('Custom manifest loaded:', customCrmManifestJson);
                }
              }
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
          if (registeredVersionInfo[['rc-crm-extension-version']]) {
            const releaseNotesPageRender = await releaseNotesPage.getReleaseNotesPageRender({ manifest, platformName, registeredVersion: registeredVersionInfo['rc-crm-extension-version'] });
            if (releaseNotesPageRender) {
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: releaseNotesPageRender
              });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${releaseNotesPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
              }, '*');
              showNotification({ level: 'success', message: 'New version released. Please check release notes and reload the extension.', ttl: 60000 });
            }
          }
          await chrome.storage.local.set({
            ['rc-crm-extension-version']: manifest.version
          });

          if (crmAuthed) {
            const adminSettingResults = await adminCore.refreshAdminSettings();
            adminSettings = adminSettingResults.adminSettings;
            userSettings = await userCore.refreshUserSettings({});
            const serverSideLoggingEnabled = userSettings?.serverSideLogging?.enable ?? false;
            if (serverSideLoggingEnabled) {
              const serverSideLoggingToken = await adminCore.authServerSideLogging({ platform });
              const serverDomainUrl = platform.serverSideLogging.url;
              const updateSSCLTokenResponse = await axios.post(
                `${serverDomainUrl}/update-crm-token`,
                {
                  crmToken: rcUnifiedCrmExtJwt,
                  crmPlatform: platformName
                },
                {
                  headers: {
                    Accept: 'application/json',
                    'X-Access-Token': serverSideLoggingToken
                  }
                }
              );
            }
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-update-authorization-status',
              authorized: crmAuthed
            }, '*');
            setInterval(function () {
              logService.forceCallLogMatcherCheck();
            }, 600000)
          }
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
          if (data.call.queueCall) {
            await chrome.storage.local.set({
              [`is-call-queue-${data.call.sessionId}`]: {
                isQueue: true,
                expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
              }
            });
          }
          switch (data.call.telephonyStatus) {
            case 'CallConnected':
              window.postMessage({ type: 'rc-expandable-call-note-open', sessionId: data.call.sessionId }, '*');
              switch (data.call.direction) {
                case 'Inbound':
                  chrome.runtime.sendMessage({
                    type: 'openPopupWindow'
                  });
                  if (userCore.getIncomingCallPop(userSettings).value === 'onAnswer') {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
                  }
                  break;
                case 'Outbound':
                  if (userCore.getOutgoingCallPop(userSettings).value === 'onAnswer') {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.call.to.phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
                  }
                  break;
              }
              break;
            case 'NoCall':
              if (data.call.terminationType === 'final') {
                window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
                const callAutoPopup = userCore.getCallPopSetting(userSettings).value;
                if (callAutoPopup) {
                  const isExtensionNumber = data.call.direction === 'Inbound' ?
                    !!data.call.from.extensionNumber :
                    !!data.call.to.extensionNumber;

                  const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
                  if (isExtensionNumber && !allowExtensionNumberLogging) {
                    responseMessage(data.requestId, { data: 'ok' });
                    return;
                  }

                  const contactPhoneNumber = data.call.direction === 'Inbound' ?
                    (data.call.from.phoneNumber ?? data.call.from.extensionNumber) :
                    (data.call.to.phoneNumber ?? data.call.to.extensionNumber);

                  const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
                  const callLogSubject = data.call.direction === 'Inbound' ?
                    `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
                    `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
                  const note = await logCore.getCachedNote({ sessionId: data.call.sessionId });
                  const logInfo = {
                    note,
                    subject: callLogSubject,
                  }
                  let callPage = logPage.getLogPageRender({ id: data.call.sessionId, manifest, logType: 'Call', triggerType: 'createLog', platformName, direction: data.call.direction, contactInfo: callMatchedContact ?? [], logInfo, loggedContactId: null });
                  // default form value from user settings
                  if (data.call.direction === 'Inbound') {
                    callPage = await logPageFormDataDefaulting({
                      platform,
                      targetPage: callPage,
                      caseType: 'inboundCall',
                      logType: 'callLog'
                    });
                  }
                  if (data.call.direction === 'Outbound') {
                    callPage = await logPageFormDataDefaulting({
                      platform,
                      targetPage:
                        callPage,
                      caseType: 'outboundCall',
                      logType: 'callLog'
                    });
                  }
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-update-call-log-page',
                    page: callPage,
                  }, '*');

                  // navigate to call log page
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/log/call/${data.call.sessionId}`,
                  }, '*');
                }

                await chrome.storage.local.set({
                  [`call-log-data-ready-${data.call.sessionId}`]: {
                    isReady: false,
                    expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                  }
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-trigger-call-logger-match',
                  sessionIds: [data.call.sessionId]
                }, '*');
              }
              break;
            case 'Ringing':
              hasOngoingCall = true;
              switch (data.call.direction) {
                case 'Inbound':
                  chrome.runtime.sendMessage({
                    type: 'openPopupWindow'
                  });
                  if (userCore.getIncomingCallPop(userSettings).value === 'onFirstRing') {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
                  }
                  break;
                case 'Outbound':
                  if (userCore.getOutgoingCallPop(userSettings).value === 'onFirstRing') {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.call.to.phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
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
              hasOngoingCall = false;
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
          userSettings = await userCore.refreshUserSettings({
            changedSettings: {
              autoLogCall: {
                value: data.autoLog
              }
            },
            isAvoidForceChange: true
          });
          trackEditSettings({ changedItem: 'auto-call-log', status: data.autoLog });
          if (!!data.autoLog && !!crmAuthed) {
            await chrome.storage.local.set({ retroAutoCallLogMaxAttempt: 10 });
            const retroAutoCallLogIntervalId = setInterval(
              function () {
                logService.retroAutoCallLog({
                  manifest,
                  platformName
                })
              }, 60000);
            await chrome.storage.local.set({ retroAutoCallLogIntervalId });
          }
          break;
        case 'rc-messageLogger-auto-log-notify':
          userSettings = await userCore.refreshUserSettings({
            changedSettings: {
              autoLogSMS: {
                value: data.autoLog
              }
            },
            isAvoidForceChange: true
          });
          trackEditSettings({ changedItem: 'auto-message-log', status: data.autoLog });
          break;
        case 'rc-route-changed-notify':
          if (!data.path.startsWith('/log/message') && !data.path.startsWith('/conversations/')) {
            autoPopupMainConverastionId = null;
          }
          if (data.path !== '/') {
            trackPage(data.path);
          }
          if (data.path) {
            if (data.path.startsWith('/conversations/') || data.path.startsWith('/composeText')) {
              window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
            }
          }
          // user setting page needs a refresh mechanism to make sure user settings are up to date
          if (data.path === '/settings' && crmAuthed) {
            const nowDate = new Date();
            if (nowDate - lastUserSettingSyncDate > 60000) {
              showNotification({ level: 'success', message: 'User settings syncing', ttl: 2000 });
              userSettings = await userCore.refreshUserSettings({});
              showNotification({ level: 'success', message: 'User settings synced', ttl: 2000 });
              lastUserSettingSyncDate = new Date();
            }
          }
          break;
        case 'rc-adapter-ai-assistant-settings-notify':
          userSettings = await userCore.refreshUserSettings({
            changedSettings: {
              showAiAssistantWidget: {
                value: data.showAiAssistantWidget
              },
              autoStartAiAssistant: {
                value: data.autoStartAiAssistant
              }
            },
            isAvoidForceChange: true
          });
          break;
        case 'rc-post-message-request':
          if (!crmAuthed && (data.path === '/callLogger' || data.path === '/messageLogger')) {
            showNotification({ level: 'warning', message: `Please go to Settings and connect to ${platformName}`, ttl: 60000 });
            responseMessage(data.requestId, { data: 'ok' });
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
                    if (platform.auth.oauth.customState) {
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
                        showNotification({
                          level: 'warning',
                          message: 'Login failure. Refresh Bullhorn page and try again.',
                          details: [
                            {
                              title: 'Details',
                              items: [
                                {
                                  id: '1',
                                  type: 'text',
                                  text: `To connect to Bullhorn successfully, please open up the Bullhorn app and reload the page in your browser. Then click the "Connect" button again.`
                                }
                              ]
                            }
                          ],
                          ttl: 30000
                        });
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
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/customizedPage/inputChanged':
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-post-message-response',
                responseId: data.requestId,
                response: { data: 'ok' },
              }, '*');
              // refresh multi match prompt
              switch (data.body.page.id) {
                case 'getMultiContactPopPromptPage':
                  if (data.body.keys.some(k => k === 'search')) {
                    const searchWord = data.body.formData.search;
                    contactCore.refreshContactPromptPage({ contactInfo: data.body.page.formData.contactInfo, searchWord });
                  }
                  else if (data.body.keys.some(k => k === 'contactList')) {
                    const contactToOpen = data.body.formData.contactInfo.find(c => c.id === data.body.formData.contactList);
                    contactCore.openContactPage({ manifest, platformName, contactType: contactToOpen.type, contactId: contactToOpen.id });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-navigate-to',
                      path: 'goBack',
                    }, '*');
                    // bring back inbound call modal if in Ringing state if exist
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-control-call',
                      callAction: 'toggleRingingDialog',
                    }, '*');
                  }
                  break;
                case 'googleSheetsPage':
                  const updatedGoogleSheetsPage = googleSheetsPage.getUpdatedGoogleSheetsPage({ page: data.body.page, formData: data.body.formData, manifest, userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: updatedGoogleSheetsPage
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${updatedGoogleSheetsPage.id}`, // page id
                  }, '*');
                  break;
              }
              switch (data.body?.formData?.section) {
                case 'managedSettings':
                  const managedSettingsPageRender = managedSettingsPage.getManagedSettingsPageRender({ crmManifest: platform });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: managedSettingsPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${managedSettingsPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'callAndSMSLogging':
                  const callAndSMSLoggingSettingPageRender = callAndSMSLoggingSettingPage.getCallAndSMSLoggingSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: callAndSMSLoggingSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${callAndSMSLoggingSettingPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'serverSideLoggingSetting':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const serverSideLoggingSubscription = await adminCore.getServerSideLogging({ platform });
                  const subscriptionLevel = serverSideLoggingSubscription.subscribed ? serverSideLoggingSubscription.subscriptionLevel : 'Disable';
                  const serverSideLoggingSettingPageRender = serverSideLoggingPage.getServerSideLoggingSettingPageRender({
                    subscriptionLevel,
                    doNotLogNumbers: serverSideLoggingSubscription.doNotLogNumbers,
                    loggingByAdmin: serverSideLoggingSubscription.loggingByAdmin,
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: serverSideLoggingSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${serverSideLoggingSettingPageRender.id}`, // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'contactSetting':
                  const contactSettingPageRender = contactSettingPage.getContactSettingPageRender({ adminUserSettings: adminSettings?.userSettings, renderOverridingNumberFormat: platform.name == 'clio' || platform.name == 'insightly', renderAllowExtensionNumberLogging: !!platform.enableExtensionNumberLoggingSetting });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: contactSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${contactSettingPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'advancedFeaturesSetting':
                  const advancedFeaturesSettingPageRender = advancedFeaturesSettingPage.getAdvancedFeaturesSettingPageRender({ adminUserSettings: adminSettings?.userSettings })
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: advancedFeaturesSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${advancedFeaturesSettingPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'customSettings':
                  const customSettingsPageRender = customSettingsPage.getCustomSettingsPageRender({ crmManifest: platform, adminUserSettings: adminSettings?.userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: customSettingsPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${customSettingsPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'customAdapter':
                  const customManifestUrl = adminSettings.customAdapter?.url ?? '';
                  const customAdapterPageRender = customAdapterPage.getCustomAdapterPageRender({ customManifestUrl });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: customAdapterPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${customAdapterPageRender.id}`, // page id
                  }, '*');
                  break;
                default:
                  break;
              }
              break;
            case '/contacts/match':
              console.log(`start contact matching for ${data.body.phoneNumbers.length} numbers...`);
              noShowNotification = true;
              let matchedContacts = {};
              // Case: this is a follow-up contact match event triggered by other functions so to register the matched contacts
              const tempContactMatchTask = (await chrome.storage.local.get(`tempContactMatchTask-${data.body.phoneNumbers[0]}`))[`tempContactMatchTask-${data.body.phoneNumbers[0]}`];
              if (data.body.phoneNumbers.length === 1 && tempContactMatchTask?.length > 0) {
                const cachedMatching = document.querySelector("#rc-widget-adapter-frame").contentWindow.phone.contactMatcher.data[tempContactMatchTask.phone];
                const platformContactMatching = cachedMatching ? cachedMatching[platformName]?.data : [];
                const formattedMactchContacts = tempContactMatchTask.map(c => ({
                  id: c.id,
                  type: platformName,
                  name: c.name,
                  phoneNumbers: [
                    {
                      phoneNumber: c.phone,
                      phoneType: 'direct'
                    }
                  ],
                  entityType: platformName,
                  contactType: c.type,
                  additionalInfo: c.additionalInfo
                }));
                matchedContacts[data.body.phoneNumbers[0]] = [
                  ...platformContactMatching,
                  ...formattedMactchContacts
                ];
                await chrome.storage.local.remove(`tempContactMatchTask-${data.body.phoneNumbers[0]}`);
                console.log('contact match task done.')
              }
              // Case: this is a contact match event triggered as contact match event itself
              else {
                // Segment an array of phone numbers into one at a time. 
                // This is to prevent fetching too many contacts at once and causing timeout.
                const contactPhoneNumber = data.body.phoneNumbers[0];
                const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
                // If it's direct number (starting with +), go ahead
                // If not a direct number, but allow extension number logging, go ahead as well
                if (contactPhoneNumber.startsWith('+') || allowExtensionNumberLogging) {
                  // query on 3rd party API to get the matched contact info and return
                  const { matched: contactMatched, returnMessage: contactMatchReturnMessage, contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isForceRefresh: true, isToTriggerContactMatch: false });
                  if (contactMatched) {
                    if (!matchedContacts[contactPhoneNumber]) {
                      matchedContacts[contactPhoneNumber] = [];
                    }
                    for (const contactInfoItem of contactInfo) {
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
                    if (matchedContacts[contactPhoneNumber].length > 0) {
                      console.log(`contact matched for ${contactPhoneNumber}`);
                    }
                    else {
                      if (data.body.triggerFrom === 'manual') {
                        showNotification({ level: contactMatchReturnMessage?.messageType, message: contactMatchReturnMessage?.message, ttl: contactMatchReturnMessage?.ttl, details: contactMatchReturnMessage?.details });
                      }
                      console.log(`contact not matched for ${contactPhoneNumber}`);
                    }
                  }
                  else {
                    if (data.body.triggerFrom === 'manual') {
                      showNotification({ level: contactMatchReturnMessage?.messageType, message: contactMatchReturnMessage?.message, ttl: contactMatchReturnMessage?.ttl, details: contactMatchReturnMessage?.details });
                    }
                    console.log(`contact not matched for ${contactPhoneNumber}`);
                  }
                }
                // After match task done above, re-organize the request so to make it ready for next round
                if (data.body.phoneNumbers.length > 1) {
                  const remainingPhoneNumbers = data.body.phoneNumbers.slice(1);
                  // Do another contact match with remaining phone numbers
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-contact-match',
                    phoneNumbers: remainingPhoneNumbers,
                  }, '*');
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
              if (hasOngoingCall) {
                await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactType: data.body.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
              }
              else {
                await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber, contactId: data.body.id, contactType: data.body.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
              }
              window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/callLogger':
              if (data.body?.call?.action) {
                const isQueue = await chrome.storage.local.get(`is-call-queue-${data.body.call.sessionId}`);
                if ((data.body.call.result === 'Missed' && isQueue[`is-call-queue-${data.body.call.sessionId}`]?.isQueue) || (data.body.call.delegationType === 'QueueForwarding' && data.body.call.result === 'Answered Elsewhere')) {
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-call-logger-match',
                    sessionIds: [data.body.call.sessionId]
                  }, '*');
                  await chrome.storage.local.set({
                    [`is-call-queue-${data.body.call.sessionId}`]: {
                      isQueue: true,
                      warning: 'Answered by someone else',
                      expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                    }
                  });
                  if (data.body.redirect) {
                    showNotification({ level: 'warning', message: 'This call is answered elsewhere in call queue', ttl: 3000 });
                  }
                  responseMessage(data.requestId, { data: 'ok' });
                  break;
                }
              }
              if (data.body.call.queueCall) {
                await chrome.storage.local.set({
                  [`is-call-queue-${data.body.call.sessionId}`]: {
                    isQueue: true,
                    expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                  }
                });
                if (data.body?.call?.result === 'Ringing') {
                  responseMessage(data.requestId, { data: 'ok' });
                  break;
                }
                if (data.body?.call?.telephonyStatus === 'Ringing' && data.body?.call?.result === 'Disconnected') {
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-call-logger-match',
                    sessionIds: [data.body.call.sessionId]
                  }, '*');
                  await chrome.storage.local.set({
                    [`is-call-queue-${data.body.call.sessionId}`]: {
                      isQueue: true,
                      warning: 'Answered by someone else',
                      expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                    }
                  });
                  if (data.body.redirect) {
                    showNotification({ level: 'warning', message: 'This call is answered elsewhere in call queue', ttl: 3000 });
                  }
                  responseMessage(data.requestId, { data: 'ok' });
                  break;
                }
              }
              const isFinalDataResult = data.body?.call?.action !== undefined;
              const isRecorded = !isObjectEmpty((await chrome.storage.local.get(`rec-link-${data.body.call.sessionId}`)));
              const hasRecording = !!data.body.call.recording?.link;
              const isCallLogDataReady = isFinalDataResult && (isRecorded || !hasRecording);
              await chrome.storage.local.set({
                [`call-log-data-ready-${data.body.call.sessionId}`]:
                {
                  isReady: isCallLogDataReady,
                  expiry: new Date().getTime() + 60000 * 60 * 24 * 30 // 30 days 
                }
              });
              if (userCore.getOneTimeLogSetting(userSettings).value) {
                if (!isCallLogDataReady) {
                  if (data.body.redirect) {
                    showNotification({ level: 'warning', message: 'Call data is not yet ready. Please input your custom note while it is preparing data.', ttl: 3000 });
                    const cachedNote = await logCore.getCachedNote({ sessionId: data.body.call.sessionId });
                    const tempLogNotePageRender = tempLogNotePage.getTempLogNotePageRender({ sessionId: data.body.call.sessionId, cachedNote });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-register-customized-page',
                      page: tempLogNotePageRender
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-navigate-to',
                      path: `/customized/${tempLogNotePageRender.id}`, // page id
                    }, '*');
                  }
                  responseMessage(data.requestId, { data: 'ok' });
                  break;
                }
              }
              let isAutoLog = false;
              const isCallAutoPopup = userCore.getCallPopSetting(userSettings).value;
              // extensions numbers should NOT be logged unless explicitly allowed
              const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
              const isExtensionNumber = data.body.call.direction === 'Inbound' ?
                !!data.body.call.from.extensionNumber :
                !!data.body.call.to.extensionNumber;
              if (!allowExtensionNumberLogging) {
                if (isExtensionNumber) {
                  showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                  responseMessage(data.requestId, { data: 'ok' });
                  break;
                }
              }

              const contactPhoneNumber = data.body.call.direction === 'Inbound' ?
                (data.body.call.from.phoneNumber ?? data.body.call.from.extensionNumber) :
                (data.body.call.to.phoneNumber ?? data.body.call.to.extensionNumber);

              // If user click, show loading animation
              if (data.body.redirect) {
                window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
              }

              let { callLogs: existingCalls } = await logCore.getLog({
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                sessionIds: data.body.call.sessionId,
                requireDetails: false
              });

              // Translate: If no existing call log, create condition here to navigate to auto log
              if (userCore.getAutoLogCallSetting(userSettings).value && data.body.triggerType === 'callLogSync' && !(existingCalls?.length > 0 && existingCalls[0]?.matched)) {
                data.body.triggerType = 'createLog';
                isAutoLog = true;
              }

              // Translate: Right after call, once presence update to Disconnect, auto log the call
              if (data.body.triggerType === 'presenceUpdate') {
                if (data.body.call.result === 'Disconnected' || data.body.call.result === 'CallConnected') {
                  data.body.triggerType = 'createLog';
                  isAutoLog = true;
                }
                else {
                  responseMessage(data.requestId, { data: 'ok' });
                  break;
                }
              }

              // Translate: If want to create, but find log already exist, then change to edit
              if (data.body.triggerType === 'createLog' && !!existingCalls && existingCalls.find(l => l.sessionId == data.body.call.sessionId)?.matched) {
                data.body.triggerType = 'editLog';
              }
              // Cases that don't need to get contact info
              // Case 1: manual log
              // Case 2: call log sync 
              // Case 3: view log
              // Case 4: open log form
              switch (data.body.triggerType) {
                // Case 1: User manual log via form
                case 'logForm':
                  let additionalSubmission = {};
                  const additionalFields = manifest.platforms[platformName].page?.callLog?.additionalFields ?? [];
                  for (const f of additionalFields) {
                    if (data.body.formData[f.const] && data.body.formData[f.const] != "none") {
                      additionalSubmission[f.const] = data.body.formData[f.const];
                    }
                  }
                  switch (data.body.formData.triggerType) {
                    // Case 1.1: create log
                    case 'createLog':
                      let newContactInfo = {};
                      if (data.body.formData.contact === 'createNewContact') {
                        const createContactResult = await contactCore.createContact({
                          serverUrl: manifest.serverUrl,
                          phoneNumber: contactPhoneNumber,
                          newContactName: data.body.formData.newContactName,
                          newContactType: data.body.formData.newContactType
                        });
                        newContactInfo = createContactResult.contactInfo;
                        const newContactReturnMessage = createContactResult.returnMessage;
                        showNotification({ level: newContactReturnMessage?.messageType, message: newContactReturnMessage?.message, ttl: newContactReturnMessage?.ttl, details: newContactReturnMessage?.details });
                        if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
                          await contactCore.openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
                        }
                      }
                      await logCore.addLog(
                        {
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          logInfo: data.body.call,
                          isMain: true,
                          note: data.body.formData.note ?? "",
                          aiNote: data.body.aiNote,
                          transcript: data.body.transcript,
                          subject: data.body.formData.activityTitle ?? "",
                          contactId: newContactInfo?.id ?? data.body.formData.contact,
                          contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                          contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
                          additionalSubmission
                        });
                      if (!isObjectEmpty(additionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                        await dispositionCore.upsertDisposition({
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          sessionId: data.body.call.sessionId,
                          dispositions: additionalSubmission
                        });
                      }
                      break;
                    // Case 1.2: update log
                    case 'editLog':
                      await logCore.updateLog({
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        sessionId: data.body.call.sessionId,
                        subject: data.body.formData.activityTitle ?? "",
                        note: data.body.formData.note ?? "",
                        aiNote: data.body.aiNote,
                        transcript: data.body.transcript,
                        startTime: data.body.call.startTime,
                        duration: data.body.call.duration,
                        result: data.body.call.result,
                        isShowNotification: true
                      });
                      await dispositionCore.upsertDisposition({
                        serverUrl: manifest.serverUrl,
                        logType: 'Call',
                        sessionId: data.body.call.sessionId,
                        dispositions: additionalSubmission
                      });
                      break;
                  }
                  break;
                // Case 2: call log sync
                case 'callLogSync':
                  if (data.body.call?.recording?.link) {
                    trackUpdateCallRecordingLink({ processState: 'start' });
                  }
                  // If there is existing call log, update it
                  if (existingCalls?.length > 0 && existingCalls[0]?.matched) {
                    await logService.syncCallData({
                      manifest,
                      dataBody: data.body
                    });
                    if (data.body.call?.recording?.link) {
                      trackUpdateCallRecordingLink({ processState: 'finish' });
                    }
                  }
                  break;
                // Case 3: view log page
                case 'viewLog':
                  const matchedEntity = data.body.call.direction === 'Inbound' ? data.body.fromEntity : data.body.toEntity;
                  if (manifest.platforms[platformName].canOpenLogPage) {
                    logCore.openLog({ manifest, platformName, hostname: platformHostname, logId: existingCalls.find(l => l.sessionId == data.body.call.sessionId)?.logId, contactType: matchedEntity.contactType, contactId: matchedEntity.id });
                  }
                  else {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber, contactId: matchedEntity.id, contactType: matchedEntity.contactType, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value });
                  }
                  break;
                // Case 4&5: open create&edit form (both share the same form)
                case 'editLog':
                  existingCalls = (await logCore.getLog({
                    serverUrl: manifest.serverUrl,
                    logType: 'Call',
                    sessionIds: data.body.call.sessionId,
                    requireDetails: true
                  })).callLogs;
                // eslint-disable-next-line no-fallthrough
                case 'createLog':
                  const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
                  let defaultingContact = callMatchedContact?.length > 0 ? callMatchedContact[0] : null;
                  if (data.body.call.toNumberEntity) {
                    if (callMatchedContact.some(c => c.id == data.body.call.toNumberEntity)) {
                      const toNumberEntityContact = callMatchedContact.find(c => c.id == data.body.call.toNumberEntity);
                      toNumberEntityContact.toNumberEntity = true;
                      defaultingContact = toNumberEntityContact;
                    }
                  }
                  if (!callContactMatched) {
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                    // Unique: Google Sheets
                    if (platformName === 'googleSheets') {
                      showNotification({ level: callLogContactMatchMessage?.messageType, message: callLogContactMatchMessage?.message, ttl: callLogContactMatchMessage?.ttl, details: callLogContactMatchMessage?.details });
                    }
                    responseMessage(data.requestId, { data: 'ok' });
                    break;
                  }
                  let logInfo = {
                    note: '',
                    subject: ''
                  }
                  if (existingCalls && existingCalls.find(l => l.sessionId == data.body.call.sessionId)?.logData) {
                    logInfo = existingCalls.find(l => l.sessionId == data.body.call.sessionId).logData;
                  }
                  else {
                    logInfo.note = await logCore.getCachedNote({ sessionId: data.body.call.sessionId }) ?? "";
                  }
                  const { hasConflict, autoSelectAdditionalSubmission, requireManualDisposition } = await getLogConflictInfo({
                    platform,
                    isAutoLog,
                    contactInfo: callMatchedContact,
                    logType: 'callLog',
                    direction: data.body.call.direction,
                    isVoicemail: false
                  });

                  if (isAutoLog && !isCallAutoPopup) {
                    // Case: auto log but encountering multiple selection that needs user input, so shown as conflicts
                    if (hasConflict) {
                      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                      const conflictLog = {
                        type: 'Call',
                        id: data.body.call.sessionId,
                        phoneNumber: contactPhoneNumber,
                        direction: data.body.call.direction,
                        contactInfo: callMatchedContact ?? [],
                        subject: logInfo.subject,
                        note: logInfo.note,
                        date: moment(data.body.call.startTime).format('MM/DD/YYYY')
                      };
                      const conflictContent = logCore.getConflictContentFromUnresolvedLog(conflictLog);
                      showNotification({ level: 'warning', message: `Call not logged. ${conflictContent.description}. Please log it manually on call history page`, ttl: 5000 });
                    }
                    // Case: auto log and no conflict, log directly
                    else {
                      logInfo.subject = data.body.call.direction === 'Inbound' ?
                        `Inbound Call from ${defaultingContact?.name ?? ''}` :
                        `Outbound Call to ${defaultingContact?.name ?? ''}`;
                      if (existingCalls?.length > 0 && existingCalls[0]?.matched) {
                        await logCore.updateLog({
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          sessionId: data.body.call.sessionId,
                          subject: logInfo.subject,
                          note: logInfo.note,
                          aiNote: data.body.aiNote,
                          transcript: data.body.transcript,
                          startTime: data.body.call.startTime,
                          duration: data.body.call.duration,
                          result: data.body.call.result,
                          isShowNotification: true
                        });
                      }
                      else {
                        // auto log
                        await logCore.addLog(
                          {
                            serverUrl: manifest.serverUrl,
                            logType: 'Call',
                            logInfo: data.body.call,
                            isMain: true,
                            note: logInfo.note,
                            aiNote: data.body.aiNote,
                            transcript: data.body.transcript,
                            subject: logInfo.subject,
                            additionalSubmission: autoSelectAdditionalSubmission,
                            contactId: defaultingContact?.id,
                            contactType: defaultingContact?.type,
                            contactName: defaultingContact?.name
                          });
                        if (!isObjectEmpty(autoSelectAdditionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                          await dispositionCore.upsertDisposition({
                            serverUrl: manifest.serverUrl,
                            logType: 'Call',
                            sessionId: data.body.call.sessionId,
                            dispositions: autoSelectAdditionalSubmission
                          });
                        }
                      }
                    }
                    if (requireManualDisposition) {
                      showNotification({ level: 'warning', message: 'Manual disposition needed. Please edit logged call to disposition.', ttl: 5000 });
                    }
                  }
                  // Case: auto log OFF, open log page
                  else {
                    let loggedContactId = null;
                    const existingCallLogRecord = await chrome.storage.local.get(`rc-crm-call-log-${data.body.call.sessionId}`);
                    if (existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`]) {
                      loggedContactId = existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`].contact?.id ?? null;
                    }
                    // add your codes here to log call to your service
                    let callPage = logPage.getLogPageRender({
                      id: data.body.call.sessionId,
                      manifest,
                      logType: 'Call',
                      triggerType: data.body.triggerType,
                      platformName,
                      direction: data.body.call.direction,
                      contactInfo: callMatchedContact ?? [],
                      logInfo,
                      loggedContactId
                    });

                    // create log page defaulting
                    if (data.body.triggerType === 'createLog') {
                      // default form value from user settings
                      if (data.body.call.direction === 'Inbound') {
                        callPage = await logPageFormDataDefaulting({
                          platform,
                          targetPage: callPage,
                          caseType: 'inboundCall',
                          logType: 'callLog'
                        });
                      }
                      if (data.body.call.direction === 'Outbound') {
                        callPage = await logPageFormDataDefaulting({
                          platform,
                          targetPage: callPage,
                          caseType: 'outboundCall',
                          logType: 'callLog'
                        });
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
                    break;
                  }
              }
              // response to widget
              responseMessage(data.requestId, { data: 'ok' });
              window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              break;
            case '/callLogger/inputChanged':
              await logCore.cacheCallNote({
                sessionId: data.body.call.sessionId,
                note: data.body.formData.note ?? ''
              });
              const page = logPage.getUpdatedLogPageRender({ manifest, platformName, logType: 'Call', updateData: data.body });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-update-call-log-page',
                page
              }, '*');
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/callLogger/match':
              let callLogMatchData = {};
              let noLocalMatchedSessionIds = [];
              const existingCallLogRecords = await chrome.storage.local.get(
                data.body.sessionIds.map(sessionId => `rc-crm-call-log-${sessionId}`)
              );
              for (const sessionId of data.body.sessionIds) {
                if (existingCallLogRecords[`rc-crm-call-log-${sessionId}`]) {
                  callLogMatchData[sessionId] = [{ id: sessionId, note: '', contact: { id: existingCallLogRecords[`rc-crm-call-log-${sessionId}`].contact?.id } }];
                } else {
                  noLocalMatchedSessionIds.push(sessionId);
                }

                const isCallQueue = await chrome.storage.local.get({ [`is-call-queue-${sessionId}`]: { isQueue: false } });
                if (isCallQueue[`is-call-queue-${sessionId}`]?.isQueue && isCallQueue[`is-call-queue-${sessionId}`]?.warning) {
                  callLogMatchData[sessionId] = [
                    {
                      type: 'status',
                      status: 'failed',
                      message: isCallQueue[`is-call-queue-${sessionId}`]?.warning
                    }
                  ];

                }
              }
              if (noLocalMatchedSessionIds.length > 0) {
                const { successful, callLogs } = await logCore.getLog({ serverUrl: manifest.serverUrl, logType: 'Call', sessionIds: noLocalMatchedSessionIds.toString(), requireDetails: false });
                if (successful) {
                  const newLocalMatchedCallLogRecords = {};
                  for (const sessionId of noLocalMatchedSessionIds) {
                    const correspondingLog = callLogs.find(l => l.sessionId === sessionId);
                    if (correspondingLog?.matched) {
                      callLogMatchData[sessionId] = [{ id: sessionId, note: '' }];
                      newLocalMatchedCallLogRecords[`rc-crm-call-log-${sessionId}`] = { logId: correspondingLog.logId, contact: { id: correspondingLog.contact?.id } };
                    }
                  }
                  await chrome.storage.local.set(newLocalMatchedCallLogRecords);
                }
              }
              if (userCore.getOneTimeLogSetting(userSettings).value) {
                const loggedSessionIds = Object.keys(callLogMatchData);
                for (const sessionId of data.body.sessionIds) {
                  if (loggedSessionIds.includes(sessionId)) {
                    continue;
                  }
                  const isCallLogDataReady = await chrome.storage.local.get(`call-log-data-ready-${sessionId}`);
                  if (!isObjectEmpty(isCallLogDataReady) && !isCallLogDataReady[`call-log-data-ready-${sessionId}`]?.isReady) {
                    callLogMatchData[sessionId] = [
                      {
                        type: 'status',
                        status: 'failed',
                        message: 'preparring data...'
                      }
                    ]
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
              console.log('message log request for', data.body.conversation.conversationLogId, data.body.triggerType);
              // Case: when auto log and auto pop turned ON, we need to know which event is for the conversation that user is looking at
              if (!autoPopupMainConverastionId) {
                autoPopupMainConverastionId = data.body.conversation.conversationId;
              }
              if (data?.body?.conversation?.correspondents[0]?.extensionNumber) {
                showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                responseMessage(data.requestId, { data: 'ok' });
                break;
              }
              const messageAutoLogOn = userSettings.autoLogSMS?.value ?? false;
              const messageAutoPopup = userCore.getSMSPopSetting(userSettings).value;
              const messageLogPrefId = `rc-crm-conversation-pref-${data.body.conversation.conversationLogId}`;
              const existingConversationLogPref = await chrome.storage.local.get(messageLogPrefId);
              let getContactMatchResult = null;
              // Case: auto log
              if (messageAutoLogOn && data.body.triggerType === 'auto' && !messageAutoPopup) {
                // Sub-case: has existing pref setup, log directly
                if (existingConversationLogPref[messageLogPrefId]) {
                  // auto log - has existing pref
                  await logCore.addLog({
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
                  getContactMatchResult = (await contactCore.getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                    platformName
                  })).contactInfo;
                  const { hasConflict, autoSelectAdditionalSubmission, requireManualDisposition } = await getLogConflictInfo({
                    platform,
                    isAutoLog: messageAutoLogOn,
                    contactInfo: getContactMatchResult,
                    logType: 'messageLog',
                    direction: '',
                    isVoicemail: data.body.conversation.type === 'VoiceMail'
                  });
                  // Sub-case: has conflict
                  if (hasConflict) {
                    const conflictLog = {
                      type: 'Message',
                      id: data.body.conversation.conversationId,
                      direction: '',
                      contactInfo: getContactMatchResult ?? [],
                      date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
                    };
                    const conflictContent = logCore.getConflictContentFromUnresolvedLog(conflictLog);
                    showNotification({ level: 'warning', message: `Message not logged. ${conflictContent.description}.`, ttl: 5000 });
                  }
                  // Sub-case: no conflict, log directly
                  else {
                    // auto log, no pref, no conflict
                    await logCore.addLog({
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
                  if (requireManualDisposition) {
                    showNotification({ level: 'warning', message: 'Manual disposition needed. Please edit logged message to disposition.', ttl: 5000 });
                  }
                }
              }
              // Case: manual log, submit
              else if (data.body.triggerType === 'logForm') {
                let additionalSubmission = {};
                const additionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
                for (const f of additionalFields) {
                  if (data.body.formData[f.const] != "none") {
                    additionalSubmission[f.const] = data.body.formData[f.const];
                  }
                }
                let newContactInfo = {};
                if (data.body.formData.contact === 'createNewContact' && data.body.redirect) {
                  const newContactResp = await contactCore.createContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                    newContactName: data.body.formData.newContactName,
                    newContactType: data.body.formData.newContactType
                  });
                  newContactInfo = newContactResp.contactInfo;
                  if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
                    await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.body.conversation.correspondents[0].phoneNumber, contactId: newContactInfo.id, contactType: data.body.formData.newContactType });
                  }
                }
                // user manaully submit message log form
                await logCore.addLog({
                  serverUrl: manifest.serverUrl,
                  logType: 'Message',
                  logInfo: data.body.conversation,
                  isMain: true,
                  note: '',
                  additionalSubmission,
                  contactId: newContactInfo?.id ?? data.body.formData.contact,
                  contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                  contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName
                });
              }
              // Case: Open page OR auto pop up log page
              else {
                if (data.body.redirect || messageAutoPopup) {
                  getContactMatchResult = await contactCore.getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                    platformName
                  });
                  // add your codes here to log call to your service
                  let messagePage = logPage.getLogPageRender({
                    id: data.body.conversation.conversationId,
                    manifest,
                    logType: 'Message',
                    triggerType: data.body.triggerType,
                    platformName,
                    direction: '',
                    contactInfo: getContactMatchResult.contactInfo ?? []
                  });
                  // default form value from user settings
                  if (data.body.conversation.type === 'VoiceMail') {
                    messagePage = await logPageFormDataDefaulting({
                      platform,
                      targetPage: messagePage,
                      caseType: 'voicemail',
                      logType: 'messageLog'
                    });
                  }
                  else {
                    messagePage = await logPageFormDataDefaulting({
                      platform,
                      targetPage: messagePage,
                      caseType: 'message',
                      logType: 'messageLog'
                    });
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
                }
              }
              // response to widget
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/messageLogger/inputChanged':
              const updatedPage = logPage.getUpdatedLogPageRender({ manifest, logType: 'Message', platformName, updateData: data.body });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-update-messages-log-page',
                page: updatedPage
              }, '*');
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/messageLogger/match':
              let localMessageLogs = {};
              const savedMessageLogRecords = await chrome.storage.local.get(
                data.body.conversationLogIds.map(conversationLogId => `rc-crm-conversation-log-${conversationLogId}`)
              );
              const messageMatchResults = data.body.conversationLogIds.map((conversationLogId) => {
                return { conversationLogId, savedMessageLogRecord: savedMessageLogRecords[`rc-crm-conversation-log-${conversationLogId}`] };
              });
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
              const changedSettings = {};
              for (const s of data.body.settings) {
                if (s.items !== undefined) {
                  for (const i of s.items) {
                    changedSettings[i.id] = { value: i.value };
                  }
                }
                else if (s.value !== undefined) {
                  changedSettings[s.id] = { value: s.value };
                }
              }

              userSettings = await userCore.refreshUserSettings({
                changedSettings
              });
              if (data.body.setting.id === "developerMode") {
                showNotification({ level: 'success', message: `Developer mode is turned ${data.body.setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
                const serviceManifest = await embeddableServices.getServiceManifest();
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-register-third-party-service',
                  service: serviceManifest
                }, '*');
              }
              else if (data.body.setting.id === "autoOpenWithCRM") {
                showNotification({ level: 'success', message: `Auto open is turned ${data.body.setting.value ? 'ON' : 'OFF'}.`, ttl: 5000 });
              }
              else {
                showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
              }
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/custom-button-click':

              switch (data.body.button.id) {
                case 'callAndSMSLoggingSettingPage':
                case 'contactSettingPage':
                case 'advancedFeaturesSettingPage':
                case 'customSettingsPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const settingDataKeys = Object.keys(data.body.button.formData);
                  for (const k of settingDataKeys) {
                    adminSettings.userSettings[k] = data.body.button.formData[k];
                  }
                  await chrome.storage.local.set({ adminSettings });
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'insightlyGetApiKey':
                  const platformInfo = await chrome.storage.local.get('platform-info');
                  const hostname = platformInfo['platform-info'].hostname;
                  window.open(`https://${hostname}/Users/UserSettings`);
                  break;
                case 'authPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const returnedToken = await auth.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: data.body.button.formData.apiKey, formData: data.body.button.formData });
                  const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false });
                  if (crmAuthed) {
                    const adminSettingResults = await adminCore.refreshAdminSettings();
                    adminSettings = adminSettingResults.adminSettings;
                    const adminPageRender = adminPage.getAdminPageRender({ platform });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-register-customized-page',
                      page: adminPageRender,
                    }, '*');
                  }
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
                  chrome.runtime.sendMessage({
                    type: "openPopupWindow",
                    navigationPath: "/support"
                  });
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
                case 'factoryResetButton':
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                  if (rcUnifiedCrmExtJwt) {
                    await auth.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
                  }
                  await chrome.storage.local.remove('platform-info');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-logout'
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  trackFactoryReset();
                  break;
                case 'generateErrorLogButton':
                  const errorLogFileName = "[RingCentral App Connect]ErrorLogs.txt";
                  const errorLogFileContent = JSON.stringify(errorLogs);
                  downloadTextFile({ filename: errorLogFileName, text: errorLogFileContent });
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
                  if (platform?.documentationUrl) {
                    window.open(platform.documentationUrl);
                    trackPage('/documentation');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Documentation URL is not set', ttl: 3000 });
                  }
                  break;
                case 'releaseNotes':
                  if (platform?.releaseNotesUrl) {
                    window.open(platform.releaseNotesUrl);
                    trackPage('/releaseNotes');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Release notes URL is not set', ttl: 3000 });
                  }
                  break;
                case 'getSupport':
                  if (platform?.getSupportUrl) {
                    window.open(platform.getSupportUrl);
                    trackPage('/getSupport');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Get support URL is not set', ttl: 3000 });
                  }
                  break;
                case 'writeReview':
                  if (platform?.writeReviewUrl) {
                    window.open(platform.writeReviewUrl);
                    trackPage('/writeReview');
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Write review URL is not set', ttl: 3000 });
                  }
                  break;
                case 'saveAdminAdapterButton':
                  const customCrmManifestJson = await (await fetch(data.body.button.formData.customManifestUrl)).json();
                  if (customCrmManifestJson) {
                    adminSettings.customAdapter = {
                      url: data.body.button.formData.customManifestUrl,
                    }
                    await chrome.storage.local.set({ adminSettings });
                    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                    showNotification({ level: 'success', message: 'Custom manifest file uploaded.', ttl: 5000 });
                  }
                  break;
                case 'saveServerSideLoggingButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  adminSettings.userSettings.serverSideLogging =
                  {
                    enable: data.body.button.formData.serverSideLogging != 'Disable',
                    doNotLogNumbers: data.body.button.formData.doNotLogNumbers,
                    loggingLevel: data.body.button.formData.serverSideLogging
                  };
                  userSettings = await userCore.refreshUserSettings({
                    changedSettings: {
                      serverSideLogging:
                      {
                        enable: data.body.button.formData.serverSideLogging != 'Disable',
                        doNotLogNumbers: data.body.button.formData.doNotLogNumbers,
                        loggingLevel: data.body.button.formData.serverSideLogging
                      }
                    }
                  });
                  await chrome.storage.local.set({ adminSettings });
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  if (data.body.button.formData.serverSideLogging != 'Disable') {
                    await adminCore.enableServerSideLogging({
                      platform,
                      subscriptionLevel: data.body.button.formData.serverSideLogging,
                      loggingByAdmin: data.body.button.formData.activityRecordOwner === 'admin'
                    });
                    showNotification({ level: 'success', message: 'Server side logging turned ON. Auto call log inside the extension will be forced OFF.', ttl: 5000 });
                  }
                  else {
                    await adminCore.disableServerSideLogging({ platform });
                    showNotification({ level: 'success', message: 'Server side logging turned OFF.', ttl: 5000 });
                  }
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-third-party-service',
                    service: (await embeddableServices.getServiceManifest())
                  }, '*');
                  await adminCore.updateServerSideDoNotLogNumbers({ platform, doNotLogNumbers: data.body.button.formData.doNotLogNumbers ?? "" });
                  showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
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
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-navigate-to',
                        path: 'goBack',
                      }, '*');
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
                case 'saveTempNoteButton':
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  await logCore.cacheCallNote({ sessionId: data.body.button.formData.sessionId, note: data.body.button.formData.note });
                  break;
                case 'googleSheetsConfig':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  userSettings = await userCore.refreshUserSettings({});
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: googleSheetsPage.renderGoogleSheetsPage({ manifest, userSettings })
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/googleSheetsPage', // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'newSheetButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const { rcUnifiedCrmExtJwt: tokenForNewSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                  const newSheetResponse = await axios.post(`${manifest.serverUrl}/googleSheets/sheet?jwtToken=${tokenForNewSheet}`,
                    {
                      name: data.body.button.formData.newSheetName
                    }
                  );
                  if (newSheetResponse.status === 200) {
                    userSettings = await userCore.refreshUserSettings({
                      changedSettings: {
                        googleSheetsName: {
                          value: newSheetResponse.data.name
                        },
                        googleSheetsUrl: {
                          value: newSheetResponse.data.url
                        }
                      }
                    });
                    showNotification({ level: 'success', message: 'New sheet created successfully', ttl: 5000 });
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Failed to create new sheet', ttl: 5000 });
                  }
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: googleSheetsPage.renderGoogleSheetsPage({ manifest, userSettings })
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/googleSheetsPage', // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'selectExistingSheetButton':
                  const { rcUnifiedCrmExtJwt: tokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                  window.open(`${manifest.serverUrl}/googleSheets/filePicker?token=${tokenForExistingSheet}`, '_blank');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack', // page id
                  }, '*');
                  break;
                case 'sheetInfoButton':
                  window.open(data.body.button.formData.sheetUrl, '_blank');
                  break;
                case 'removeSheetButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  userSettings = await userCore.refreshUserSettings({
                    changedSettings: {
                      googleSheetsName: {
                        value: ''
                      },
                      googleSheetsUrl: {
                        value: ''
                      }
                    }
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: googleSheetsPage.renderGoogleSheetsPage({ manifest, userSettings })
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/googleSheetsPage', // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
              }
              responseMessage(data.requestId, { data: 'ok' });
              break;
            default:
              responseMessage(data.requestId, { data: 'ok' });
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

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  platform = manifest.platforms[platformName];
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
      await chrome.storage.local.set({ crmAuthed });
      if (crmAuthed) {
        const adminSettingResults = await adminCore.refreshAdminSettings();
        adminSettings = adminSettingResults.adminSettings;
        const adminPageRender = adminPage.getAdminPageRender({ platform });
        userSettings = await userCore.refreshUserSettings({});
        document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
          type: 'rc-adapter-register-customized-page',
          page: adminPageRender,
        }, '*');
      }
    }
    sendResponse({ result: 'ok' });
  }
  // Unique: Pipedrive
  else if (request.type === 'pipedriveCallbackUri' && !(await auth.checkAuth())) {
    await auth.onAuthCallback({ serverUrl: manifest.serverUrl, callbackUri: `${request.pipedriveCallbackUri}&state=platform=pipedrive` });
    crmAuthed = true;
    await chrome.storage.local.set({ crmAuthed });
    const adminSettingResults = await adminCore.refreshAdminSettings();
    adminSettings = adminSettingResults.adminSettings;
    const adminPageRender = adminPage.getAdminPageRender({ platform });
    userSettings = await userCore.refreshUserSettings({});
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: adminPageRender,
    }, '*');
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
    else if (request.path === '/support') {
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
    const returnedToken = await authCore.apiKeyLogin({
      serverUrl: manifest.serverUrl,
      apiKey: request.apiKey,
      formData: {
        apiUrl: request.apiUrl
      }
    });
    crmAuthed = !!returnedToken;
    await chrome.storage.local.set({ crmAuthed });
    if (crmAuthed) {
      const adminSettingResults = await adminCore.refreshAdminSettings();
      adminSettings = adminSettingResults.adminSettings;
      const adminPageRender = adminPage.getAdminPageRender({ platform });
      userSettings = await userCore.refreshUserSettings({});
      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page: adminPageRender,
      }, '*');
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
