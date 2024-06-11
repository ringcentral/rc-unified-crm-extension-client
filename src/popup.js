const auth = require('./core/auth');
const { getLog, openLog, addLog, updateLog, getCachedNote, cacheCallNote, cacheUnresolvedLog, getLogCache, getAllUnresolvedLogs, resolveCachedLog } = require('./core/log');
const { getContact, createContact, openContactPage } = require('./core/contact');
const { responseMessage, isObjectEmpty, showNotification } = require('./lib/util');
const { getUserInfo } = require('./lib/rcAPI');
const { apiKeyLogin } = require('./core/auth');
const { openDB } = require('idb');
const logPage = require('./components/logPage');
const authPage = require('./components/authPage');
const feedbackPage = require('./components/feedbackPage');
const releaseNotesPage = require('./components/releaseNotesPage');
const moment = require('moment');
const {
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
  trackOpenFeedback
} = require('./lib/analytics');

window.__ON_RC_POPUP_WINDOW = 1;

let manifest = {};
let registered = false;
let crmAuthed = false;
let platform = null;
let platformName = '';
let rcUserInfo = {};
let extensionUserSettings = null;
// trailing SMS logs need to know if leading SMS log is ready and page is open. The waiting is for getContact call
let leadingSMSCallReady = false;
let trailingSMSLogInfo = [];
let firstTimeLogoutAbsorbed = false;

import axios from 'axios';

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
  }
}

getCustomManifest();

async function showUnresolvedTabPage() {
  const unresolvedLogs = await getAllUnresolvedLogs();
  const unresolvedLogsPage = logPage.getUnresolvedLogsPageRender({ unresolvedLogs });
  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
    type: 'rc-adapter-register-customized-page',
    page: unresolvedLogsPage,
  }, '*');
  if (unresolvedLogsPage.hidden) {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: 'goBack',
    }, '*');
  }
}

// Interact with RingCentral Embeddable Voice:
window.addEventListener('message', async (e) => {
  const data = e.data;
  let noShowNotification = false;
  try {
    if (data) {
      switch (data.type) {
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
                const feedbackPageRender = feedbackPage.getFeedbackPageRender({ pageConfig: manifest.platforms[platformName].page.feedback });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-register-customized-page',
                  page: feedbackPageRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-navigate-to',
                  path: `/customized/${feedbackPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
                }, '*');
                trackOpenFeedback();
              },
            });
          }
          break;
        case 'rc-adapter-pushAdapterState':
          extensionUserSettings = (await chrome.storage.local.get('extensionUserSettings')).extensionUserSettings;
          if (!registered) {
            const platformInfo = await chrome.storage.local.get('platform-info');
            platformName = platformInfo['platform-info'].platformName;
            platformHostname = platformInfo['platform-info'].hostname;
            platform = manifest.platforms[platformName];
            registered = true;
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-register-third-party-service',
              service: getServiceManifest(platform.name)
            }, '*');
          }
          break;
        case 'rc-login-status-notify':
          // get login status from widget
          console.log('rc-login-status-notify:', data.loggedIn, data.loginNumber, data.contractedCountryCode);
          const platformInfo = await chrome.storage.local.get('platform-info');
          platformName = platformInfo['platform-info'].platformName;
          rcUserInfo = (await chrome.storage.local.get('rcUserInfo')).rcUserInfo;
          if (data.loggedIn) {
            document.getElementById('rc-widget').style.zIndex = 0;
            const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
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
              showNotification({ level: 'warning', message: 'Please authorize CRM platform account via Settings.', ttl: 10000 });
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
              await showUnresolvedTabPage();
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
        case 'rc-call-end-notify':
          // get call on call end event
          const callDurationInSeconds = (data.call.endTime - data.call.startTime) / 1000;
          trackCallEnd({ durationInSeconds: callDurationInSeconds });
          break;
        case 'rc-ringout-call-notify':
          // get call on active call updated event
          if (data.call.telephonyStatus === 'NoCall' && data.call.terminationType === 'final') {
            const callDurationInSeconds = (data.call.endTime - data.call.startTime) / 1000;
            trackCallEnd({ durationInSeconds: callDurationInSeconds });
          }
          if (data.call.telephonyStatus === 'CallConnected') {
            trackConnectedCall();
          }
          break;
        case "rc-active-call-notify":
          if (data.call.telephonyStatus === 'CallConnected') {
            window.postMessage({ type: 'rc-expandable-call-note-open', sessionId: data.call.sessionId }, '*');
          }
          if (data.call.telephonyStatus === 'NoCall' && data.call.terminationType === 'final') {
            window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
          }
          if (data.call.telephonyStatus === 'Ringing' && data.call.direction === 'Inbound') {
            chrome.runtime.sendMessage({
              type: 'openPopupWindow'
            });
            if (!!extensionUserSettings && extensionUserSettings.find(e => e.name === 'Open contact web page from incoming call')?.value) {
              await openContactPage({ manifest, platformName, phoneNumber: data.call.direction === 'Inbound' ? data.call.from.phoneNumber : data.call.to.phoneNumber });
            }
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
          if (data.path !== '/') {
            trackPage(data.path);
            if (data.path === '/customizedTabs/unresolve') {
              await showUnresolvedTabPage();
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
            showNotification({ level: 'warning', message: 'Please authorize CRM platform account via Settings.', ttl: 10000 });
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
                      authUri = manifest.platforms.pipedrive.redirectUri;
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
                auth.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
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
                matchedContacts[tempContactMatchTask.phoneNumber] = [
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
                    entityType: platformName
                  }
                ];
                await chrome.storage.local.remove('tempContactMatchTask');
              }
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
              await openContactPage({ manifest, platformName, phoneNumber: data.body.phoneNumbers[0].phoneNumber });
              window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
              responseMessage(
                data.requestId,
                {
                  data: 'ok'
                });
              break;
            case '/callLogger':
              let isAutoLog = false;
              const callAutoPopup = !!extensionUserSettings && extensionUserSettings.find(e => e.name === 'Auto pop up call log page')?.value;

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
                  await chrome.storage.local.set({ ['rec-link-' + data.body.call.sessionId]: { recordingLink: data.body.call.recording.link } });
                  await updateLog(
                    {
                      serverUrl: manifest.serverUrl,
                      logType: 'Call',
                      sessionId: data.body.call.sessionId,
                      recordingLink: data.body.call.recording.link
                    });
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
              const { callLogs: fetchedCallLogs } = await getLog({
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                sessionIds: data.body.call.sessionId
              });
              const { matched: callContactMatched, message: callLogContactMatchMessage, contactInfo: callMatchedContact } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber });
              if (!callContactMatched) {
                showNotification({ level: 'warning', message: callLogContactMatchMessage, ttl: 3000 });
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
                  const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog, contactInfo: callMatchedContact });
                  if (isAutoLog && !callAutoPopup) {
                    // Case: auto log but encountering multiple selection that needs user input, so shown as conflicts
                    if (hasConflict) {
                      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                      await cacheUnresolvedLog({
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
                      showNotification({ level: 'warning', message: 'Unable to log call with unresolved conflict.', ttl: 3000 });
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
                      const { bullhornDefaultActionCode } = await chrome.storage.local.get({ bullhornDefaultActionCode: null });
                      if (!!bullhornDefaultActionCode && callPage.schema.properties.noteActions?.oneOf.some(o => o.const === bullhornDefaultActionCode)) {
                        callPage.formData.noteActions = bullhornDefaultActionCode;
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
                  if (manifest.platforms[platformName].canOpenLogPage) {
                    // if callMatchedContact elements only have the same value of "type", then open log page once
                    const uniqueContactTypes = [...new Set(callMatchedContact.map(c => c.type))];
                    if (uniqueContactTypes.length === 1) {
                      openLog({ manifest, platformName, hostname: platformHostname, logId: fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId)?.logId, contactType: uniqueContactTypes[0] });
                    } else {
                      for (const c of callMatchedContact) {
                        openLog({ manifest, platformName, hostname: platformHostname, logId: fetchedCallLogs.find(l => l.sessionId == data.body.call.sessionId)?.logId, contactType: c.type });
                      }
                    }
                  }
                  else {
                    await openContactPage({ manifest, platformName, phoneNumber: contactPhoneNumber });
                  }
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'logForm':
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
                        const newContactResp = await createContact({
                          serverUrl: manifest.serverUrl,
                          phoneNumber: contactPhoneNumber,
                          newContactName: data.body.formData.newContactName,
                          newContactType: data.body.formData.newContactType
                        });
                        newContactInfo = newContactResp.contactInfo;
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
                        await showUnresolvedTabPage();
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
                  break;
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
              const { successful, callLogs } = await getLog({ serverUrl: manifest.serverUrl, logType: 'Call', sessionIds: data.body.sessionIds.toString() });
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
              else {
                showNotification({ level: 'warning', message: 'Cannot find call log', ttl: 3000 });
                break;
              }
              responseMessage(
                data.requestId,
                {
                  data: callLogMatchData
                });
              break;
            case '/messageLogger':
              const { rc_messageLogger_auto_log_notify: messageAutoLogOn } = await chrome.storage.local.get({ rc_messageLogger_auto_log_notify: false });
              const messageAutoPopup = !!extensionUserSettings && extensionUserSettings.find(e => e.name === 'Auto pop up message log page')?.value;
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
                  const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog: messageAutoLogOn, contactInfo: getContactMatchResult });
                  // Sub-case: has conflict, cache unresolved log
                  if (hasConflict) {
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                    await cacheUnresolvedLog({
                      type: 'Message',
                      id: data.body.conversation.conversationId,
                      direction: '',
                      contactInfo: getContactMatchResult ?? [],
                      date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
                    });
                    await showUnresolvedTabPage();
                    showNotification({ level: 'warning', message: 'Unable to log message with unresolved conflict.', ttl: 3000 });

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
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                }
              }
              // Case: manual log, open page
              else {
                if (!messageAutoLogOn && data.body.triggerType === 'auto') {
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
                window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
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
                  const { bullhornDefaultActionCode } = await chrome.storage.local.get({ bullhornDefaultActionCode: null });
                  if (!!bullhornDefaultActionCode && messagePage.schema.properties.noteActions?.oneOf.some(o => o.const === bullhornDefaultActionCode)) {
                    messagePage.formData.noteActions = bullhornDefaultActionCode;
                  }
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
              for (const conversationLogId of data.body.conversationLogIds) {
                const savedMessageLogRecord = await chrome.storage.local.get(conversationLogId);
                if (!!savedMessageLogRecord && !isObjectEmpty(savedMessageLogRecord)) {
                  localMessageLogs[conversationLogId] = [{ id: 'dummyId' }]
                }
              }
              responseMessage(
                data.requestId,
                {
                  data: localMessageLogs
                }
              );
              break;
            case '/feedback':
              // response to widget
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-post-message-response',
                responseId: data.requestId,
                response: { data: 'ok' },
              }, '*');
              const feedbackPageRender = feedbackPage.getFeedbackPageRender({ pageConfig: manifest.platforms[platformName].page.feedback });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: feedbackPageRender
              });
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-navigate-to',
                path: `/customized/${feedbackPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
              }, '*');
              trackOpenFeedback();
              break;
            case '/settings':
              extensionUserSettings = data.body.settings;
              await chrome.storage.local.set({ extensionUserSettings });
              for (const setting of extensionUserSettings) {
                trackEditSettings({ changedItem: setting.name.replaceAll(' ', '-'), status: setting.value });
              }
              break;
            case '/custom-button-click':
              switch (data.body.button.id) {
                case 'sms-template-button':
                  window.postMessage({
                    type: 'rc-select-sms-template'
                  }, '*');
                  break;
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
                  window.open(formUrl, '_blank');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  break;
                case 'removeUnresolveButton':
                  await resolveCachedLog({ type: 'Call', id: data.body.button.formData.id });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  await showUnresolvedTabPage();
                  break;
              }
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
    console.log(e)
    if (e.response && e.response.data && !noShowNotification && typeof e.response.data === 'string') {
      showNotification({ level: 'warning', message: e.response.data, ttl: 5000 });
    }
    else {
      console.error(e);
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
});

function getLogConflictInfo({ isAutoLog, contactInfo }) {
  if (!isAutoLog) {
    return { hasConflict: false, autoSelectAdditionalSubmission: {} }
  }
  let hasConflict = false;
  let autoSelectAdditionalSubmission = {};
  if (contactInfo.length > 1) {
    hasConflict = true;
  }
  else if (!!contactInfo[0]?.additionalInfo) {
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
    }
    sendResponse({ result: 'ok' });
  }
  // Unique: Pipedrive
  else if (request.type === 'pipedriveCallbackUri' && !(await auth.checkAuth())) {
    await auth.onAuthCallback({ serverUrl: manifest.serverUrl, callbackUri: `${request.pipedriveCallbackUri}&state=platform=pipedrive` });
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
      const feedbackPageRender = feedbackPage.getFeedbackPageRender({ pageConfig: manifest.platforms[platformName].page.feedback });
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


function getServiceManifest(serviceName) {
  const services = {
    name: serviceName,
    customizedPageInputChangedEventPath: '/customizedPage/inputChanged',
    // buttonEventPath: '/button-click',
    contactMatchPath: '/contacts/match',
    viewMatchedContactPath: '/contacts/view',
    contactMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact match cache time in seconds, set as 7 days
    contactNoMatchTtl: 7 * 24 * 60 * 60 * 1000, // contact no match cache time in seconds, default is 5 minutes, from v1.10.2

    // show auth/unauth button in ringcentral widgets
    authorizationPath: '/authorize',
    authorizedTitle: 'Logout',
    unauthorizedTitle: 'Connect',
    showAuthRedDot: true,
    authorized: false,
    authorizedAccount: '',

    // Enable call log sync feature
    callLoggerPath: '/callLogger',
    callLogPageInputChangedEventPath: '/callLogger/inputChanged',
    callLogEntityMatcherPath: '/callLogger/match',
    callLoggerAutoSettingLabel: 'Auto log call',

    messageLoggerPath: '/messageLogger',
    messagesLogPageInputChangedEventPath: '/messageLogger/inputChanged',
    messageLogEntityMatcherPath: '/messageLogger/match',
    messageLoggerAutoSettingLabel: 'Auto log SMS',

    feedbackPath: '/feedback',
    settingsPath: '/settings',
    settings: [
      {
        name: 'Auto pop up call log page',
        value: !!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Auto pop up call log page')?.value ?? false)
      },
      {
        name: 'Auto pop up message log page',
        value: !!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Auto pop up message log page')?.value ?? false)
      },
      {
        name: 'Open contact web page from incoming call',
        value: !!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Open contact web page from incoming call')?.value ?? false)
      },
      {
        name: 'Open contact web page after creating it',
        value: !!extensionUserSettings && (extensionUserSettings.find(e => e.name === 'Open contact web page after creating it')?.value ?? true)
      }
    ],

    // SMS template button
    buttonEventPath: '/custom-button-click',
    buttons: [{
      fill: 'rgba(102, 102, 102, 0.88)',
      id: 'sms-template-button',
      type: 'smsToolbar',
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV8/RNGqgxlEHDJUXSyIijhKFYtgobQVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6uKk6CIl/i8ptIjx4Lgf7+497t4B/nqZqWZwAlA1y0jGomImuyp2vqIHAoIYQ5/ETD2eWkzDc3zdw8fXuwjP8j735+hVciYDfCLxHNMNi3iDeGbT0jnvEwusKCnE58TjBl2Q+JHrsstvnAsO+3mmYKST88QCsVhoY7mNWdFQiaeJw4qqUb4/47LCeYuzWq6y5j35C0M5bSXFdZrDiGEJcSQgQkYVJZRhIUKrRoqJJO1HPfxDjj9BLplcJTByLKACFZLjB/+D392a+alJNykUBTpebPtjBOjcBRo12/4+tu3GCRB4Bq60lr9SB2Y/Sa+1tPAR0L8NXFy3NHkPuNwBBp90yZAcKUDTn88D72f0TVlg4BboXnN7a+7j9AFIU1fLN8DBITBaoOx1j3d3tff275lmfz9t63Kl20nLgAAAAAZiS0dEAMcAxwDHM5ZYYgAAAAlwSFlzAAAN1wAADdcBQiibeAAAAAd0SU1FB+cLFAQoM4q6FyMAAAIvSURBVFjD7Zg9aBRBFIC/vctd/kgRIiksFJU0aQMhJAREG/9QEhElSZFmEGRMiNEQSfM6QRNQmUamMypKII2F2OgVaiCFKEIghYKNSKJYCAZRLjYjnGu4Pfaye6vsg2XhzVvet29m3nszkHDxlJZbQGuEPs5ZI5/CflwHHAN2Rgh4sZqPM0mf4hSwWqkDzgD1EfpYI5VU/mHxlJb7QFuEPoatkbVqdnF/xJWkIU3UKaATpaVZaWnwr8HDQC5Cvx8rhBsDZoGfSstZa2QewEtI5IaB+RKeInDKGln0EgCXA1aBPb6hb0BXttaAL5cLxa7u/U+AIV9Kyv1eg7WK3G5gArhgjbxRWgaBR0C+xKzRU1qWgPaQfqatkYUQcK3AM6ATuGaNTDn9CHDbrcVN4EAG2AXsDfm0hIDLAwsODuCS0jIOYI3cAWacfsYaKWRintaMi9BB39Cc0jLgIK8AJ9079kR9FTi9hT4L3FVa+hzkYuyVRGk5D0yWMWksmd4/Kkmv+4Mwsl4h3ABwPcDsLTD6Vz8YQ+S6gadAUxmzz0CfNbIaa7OgtOwDHgbAbQDHt4KLFFBp2eESb7kcWwRGrJEXsbZbSkuTi1xHgOlE6Y6NBVBpyQL3gJ6glGON3KxFw3oDOBFg8wC4XNGpbpuj1ws8DzArAIeske+1aPnzAeMrwGClcHGXug/AEWvkSxIPTV+Bo9bI+ySe6n6488WrsDcL2ynvgGmf7rU18vi/vTz6Bc+FlUoLYeXrAAAAAElFTkSuQmCC',
      label: 'SMS Template',
    }],
  }
  return services;
}