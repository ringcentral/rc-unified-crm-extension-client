const auth = require('./core/auth');
const { getLog, openLog, addLog, updateLog, getCachedNote, cacheCallNote, getConflictContentFromUnresolvedLog } = require('./core/log');
const { getContact, createContact, openContactPage } = require('./core/contact');
const userCore = require('./core/user');
const { getAdminSettings, uploadAdminSettings } = require('./core/admin');
const { responseMessage, isObjectEmpty, showNotification, dismissNotification, getRcInfo, getRcAccessToken } = require('./lib/util');
const { getUserInfo } = require('./lib/rcAPI');
const { apiKeyLogin } = require('./core/auth');
const moment = require('moment');
const logPage = require('./components/logPage');
const authPage = require('./components/authPage');
const feedbackPage = require('./components/feedbackPage');
const releaseNotesPage = require('./components/releaseNotesPage');
const supportPage = require('./components/supportPage');
const aboutPage = require('./components/aboutPage');
const developerSettingsPage = require('./components/developerSettingsPage');
const crmSetupErrorPage = require('./components/crmSetupErrorPage');
const adminPage = require('./components/admin/adminPage');
const managedSettingsPage = require('./components/admin/managedSettingsPage');
const callAndSMSLoggingSettingPage = require('./components/admin/managedSettings/callAndSMSLoggingSettingPage');
const customAdapterPage = require('./components/admin/customAdapterPage');
const contactSettingPage = require('./components/admin/managedSettings/contactSettingPage');
const advancedFeaturesSettingPage = require('./components/admin/managedSettings/advancedFeaturesSettingPage');
const customSettingsPage = require('./components/admin/managedSettings/customSettingsPage');
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
  trackUpdateCallRecordingLink,
  trackCRMSetupError
} = require('./lib/analytics');

window.__ON_RC_POPUP_WINDOW = 1;

let manifest = {};
let registered = false;
let crmAuthed = false;
let platform = null;
let platformName = '';
let platformHostname = '';
let rcUserInfo = {};
let firstTimeLogoutAbsorbed = false;
let autoPopupMainConverastionId = null;
let currentNotificationId = null;
let rcInfo = null;
let rcAdditionalSubmission = {};
let adminSettings = {
  userSettings: {}
};
let userSettings = {};

import axios from 'axios';
axios.defaults.timeout = 30000; // Set default timeout to 30 seconds, can be overriden with server manifest

// TEMP
async function tempConvertExtensionUserSettingsToUserSettings() {
  const extensionUserSettings = (await chrome.storage.local.get('extensionUserSettings'))?.extensionUserSettings;
  let formattedUserSettings = {};
  if (!!extensionUserSettings) {
    for (const s of extensionUserSettings) {
      if (s.items !== undefined) {
        for (const i of s.items) {
          formattedUserSettings[i.id] = { value: i.value };
        }
      }
      else if (s.value !== undefined) {
        formattedUserSettings[s.id] = { value: s.value };
      }
    }
  }
  userSettings = await userCore.uploadUserSettings({
    serverUrl: manifest.serverUrl,
    userSettings: formattedUserSettings
  });
  await chrome.storage.local.set({ userSettings });
}

// Hack: bullhorn specific logic to check if allow custom note action value
function allowBullhornCustomNoteAction() {
  if (platformName === 'bullhorn') {
    const allowedFromUserSetting = userSettings?.allowBullhornCustomNoteAction?.value ?? false;
    return allowedFromUserSetting;
  }
  else {
    return true;
  }
}

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

let retroAutoCallLogMaxAttempt = 0;
let retroAutoCallLogIntervalId;
let retroAutoCallLogNotificationId;
let retroLoggedCount = 0;

async function retroAutoCallLog() {
  if (retroAutoCallLogMaxAttempt > 0) {
    retroAutoCallLogMaxAttempt--;
    const effectiveTotal = 10;
    let effectiveCount = 0;
    const itemsPerPage = 50;
    const pageNumber = 1;
    const { calls, hasMore } = await RCAdapter.getUnloggedCalls(itemsPerPage, pageNumber)
    const { rc_callLogger_auto_log_notify: isAutoLog } = await chrome.storage.local.get({ rc_callLogger_auto_log_notify: false })
    if (isAutoLog) {
      if (!!!retroAutoCallLogNotificationId) {
        retroAutoCallLogNotificationId = await showNotification({ level: 'success', message: 'Attempting to sync historical call logs in the background...', ttl: 5000 });
      }
      for (const c of calls) {
        if (effectiveCount >= effectiveTotal) {
          break;
        }
        const contactPhoneNumber = c.direction === 'Inbound' ? c.from.phoneNumber : c.to.phoneNumber;
        const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName });
        if (!callContactMatched) {
          continue;
        }
        const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog, contactInfo: callMatchedContact, logType: 'callLog', direction: c.direction, isVoicemail: false });
        if (!hasConflict) {
          const callLogSubject = c.direction === 'Inbound' ?
            `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
            `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
          const note = await getCachedNote({ sessionId: c.sessionId });
          const exsitingLog = await getLog({
            serverUrl: manifest.serverUrl,
            logType: 'Call',
            sessionIds: c.sessionId,
            requireDetails: false
          });
          if (!!!exsitingLog?.callLogs || !exsitingLog.callLogs[0].matched) {
            await addLog(
              {
                serverUrl: manifest.serverUrl,
                logType: 'Call',
                logInfo: c,
                isMain: true,
                note,
                subject: callLogSubject,
                additionalSubmission: autoSelectAdditionalSubmission,
                rcAdditionalSubmission,
                contactId: callMatchedContact[0]?.id,
                contactType: callMatchedContact[0]?.type,
                contactName: callMatchedContact[0]?.name,
                isShowNotification: false
              });
            retroLoggedCount++;
            effectiveCount++;
          }
          else {
            // force call log matcher check
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-trigger-call-logger-match',
              sessionIds: [exsitingLog.callLogs[0].sessionId]
            }, '*');
          }
        }
      }
      if (!hasMore) {
        clearInterval(retroAutoCallLogIntervalId);
        dismissNotification({ notificationId: retroAutoCallLogNotificationId });
        showNotification({ level: 'success', message: `Historical call syncing finished. ${retroLoggedCount} call(s) synced.`, ttl: 5000 });
      }
    }
  }
  else {
    clearInterval(retroAutoCallLogIntervalId);
    dismissNotification({ notificationId: retroAutoCallLogNotificationId });
    showNotification({ level: 'success', message: `Historical call syncing finished. ${retroLoggedCount} call(s) synced.`, ttl: 5000 });
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
          await tempConvertExtensionUserSettingsToUserSettings();
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
            const serviceManifest = await getServiceManifest({ serviceName: platform.name, customSettings: platform.settings });
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
              rcInfo = await getRcInfo();
              if (!!platform.rcAdditionalSubmission) {
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

                  if (!!rcInfoSubmissionValue) {
                    rcAdditionalSubmission[ras.id] = rcInfoSubmissionValue;
                  }
                }
              }
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
              const rcAccessToken = getRcAccessToken();
              const userSettingsByAdmin = await userCore.preloadUserSettingsFromAdmin({ serverUrl: manifest.serverUrl, rcAccessToken });
              const customManifestUrl = userSettingsByAdmin?.customManifestUrl?.url;
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
              showNotification({ level: 'success', message: 'New version released. Please check release notes and reload the extension.', ttl: 60000 });
            }
          }
          await chrome.storage.local.set({
            ['rc-crm-extension-version']: manifest.version
          });

          if (crmAuthed) {
            // Admin tab render
            const isAdmin = rcInfo?.value?.cachedData?.extensionInfo?.permissions?.admin?.enabled;
            if (isAdmin || rcInfo?.value?.cachedData?.extensionInfo?.name === 'Da Kong') {
              const adminPageRender = adminPage.getAdminPageRender();
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-adapter-register-customized-page',
                page: adminPageRender,
              }, '*');
              const storedAdminSettings = await getAdminSettings({ serverUrl: manifest.serverUrl, rcAccessToken: getRcAccessToken() });
              await chrome.storage.local.set({ adminSettings: storedAdminSettings });
              adminSettings = storedAdminSettings;
            }
            userSettings = await userCore.getUserSettings({ serverUrl: manifest.serverUrl, rcAccessToken: getRcAccessToken() });
            const serviceManifest = await getServiceManifest({ serviceName: platform.name, customSettings: platform.settings, userSettings });
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-register-third-party-service',
              service: serviceManifest
            }, '*');
            document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
              type: 'rc-adapter-update-authorization-status',
              authorized: crmAuthed,
              authorizedAccount: 'test@email.com', // optional, authorized account email or id
            }, '*');
            console.log(userSettings);
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
          switch (data.call.telephonyStatus) {
            case 'CallConnected':
              window.postMessage({ type: 'rc-expandable-call-note-open', sessionId: data.call.sessionId }, '*');
              switch (data.call.direction) {
                case 'Inbound':
                  chrome.runtime.sendMessage({
                    type: 'openPopupWindow'
                  });
                  if (userSettings?.find(s => s.id === 'contactSettingPage')?.data?.openContactPageFromIncomingCall?.value === 'onAnswer') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber });
                  }
                  break;
                case 'Outbound':
                  if (userSettings?.find(s => s.id === 'contactSettingPage')?.data?.openContactPageFromOutgoingCall?.value === 'onAnswer') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.to.phoneNumber });
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
                  if (isExtensionNumber && !!!allowExtensionNumberLogging) {
                    responseMessage(
                      data.requestId,
                      {
                        data: 'OK'
                      }
                    );
                    return;
                  }

                  const contactPhoneNumber = data.call.direction === 'Inbound' ?
                    (data.call.from.phoneNumber ?? data.call.from.extensionNumber) :
                    (data.call.to.phoneNumber ?? data.call.to.extensionNumber);

                  const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
                  const callLogSubject = data.call.direction === 'Inbound' ?
                    `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
                    `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
                  const note = await getCachedNote({ sessionId: data.call.sessionId });
                  const callPage = logPage.getLogPageRender({ id: data.call.sessionId, manifest, logType: 'Call', triggerType: 'createLog', platformName, direction: data.call.direction, contactInfo: callMatchedContact ?? [], subject: callLogSubject, note, loggedContactId: null });
                  // default form value from user settings
                  if (data.call.direction === 'Inbound') {
                    const inboundCallDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType: 'inboundCall', logType: 'callLog' });
                    for (const inboundCallDefaultValue of inboundCallDefaultValues) {
                      const inboundCallMappedOption = callPage.schema.properties[inboundCallDefaultValue.field]?.oneOf.find(o => rawTextCompare(o.const, inboundCallDefaultValue.value))?.const;
                      if (!!inboundCallMappedOption) {
                        callPage.formData[inboundCallDefaultValue.field] = inboundCallMappedOption;
                      }
                      else if (allowBullhornCustomNoteAction() && !!platform?.page['callLog']?.additionalFields.find(f => f.const == inboundCallDefaultValue.field)?.allowCustomValue && !!callPage.schema.properties[inboundCallDefaultValue.field]?.oneOff) {
                        callPage.schema.properties[inboundCallDefaultValue.field].oneOf.push({ const: inboundCallDefaultValue.value, title: inboundCallDefaultValue.value });
                        callPage.formData[inboundCallDefaultValue.field] = inboundCallDefaultValue.value;
                      }
                    }
                  }
                  if (data.call.direction === 'Outbound') {
                    const outboundCallDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType: 'outboundCall', logType: 'callLog' });
                    for (const outboundCallDefaultValue of outboundCallDefaultValues) {
                      const outboundCallMappedOption = callPage.schema.properties[outboundCallDefaultValue.field]?.oneOf.find(o => rawTextCompare(o.const, outboundCallDefaultValue.value))?.const;
                      if (!!outboundCallMappedOption) {
                        callPage.formData[outboundCallDefaultValue.field] = outboundCallMappedOption;
                      }
                      else if (allowBullhornCustomNoteAction() && !!platform?.page['callLog']?.additionalFields.find(f => f.const == outboundCallDefaultValue.field)?.allowCustomValue && !!callPage.schema.properties[outboundCallDefaultValue.field]?.oneOf) {
                        callPage.schema.properties[outboundCallDefaultValue.field].oneOf.push({ const: outboundCallDefaultValue.value, title: outboundCallDefaultValue.value });
                        callPage.formData[outboundCallDefaultValue.field] = outboundCallDefaultValue.value;
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
                    path: `/log/call/${data.call.sessionId}`,
                  }, '*');
                }
              }
              break;
            case 'Ringing':
              switch (data.call.direction) {
                case 'Inbound':
                  chrome.runtime.sendMessage({
                    type: 'openPopupWindow'
                  });
                  if (userCore.getIncomingCallPop(userSettings).value === 'onFirstRing') {
                    await openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber });
                  }
                  break;
                case 'Outbound':
                  if (userCore.getOutgoingCallPop(userSettings).value === 'onFirstRing') {
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
          await userCore.uploadUserSettings({
            serverUrl: manifest.serverUrl,
            userSettings
          });
          trackEditSettings({ changedItem: 'auto-call-log', status: data.autoLog });
          if (!!data.autoLog && !!crmAuthed) {
            retroAutoCallLogMaxAttempt = 10;
            retroAutoCallLogIntervalId = setInterval(retroAutoCallLog, 60000);
          }
          break;
        case 'rc-messageLogger-auto-log-notify':
          await chrome.storage.local.set({ rc_messageLogger_auto_log_notify: data.autoLog });
          await userCore.uploadUserSettings({
            serverUrl: manifest.serverUrl,
            userSettings
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
              document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                type: 'rc-post-message-response',
                responseId: data.requestId,
                response: { data: 'ok' },
              }, '*');
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
                case 'contactSetting':
                  const contactSettingPageRender = contactSettingPage.getContactSettingPageRender({ adminUserSettings: adminSettings?.userSettings, renderOverridingNumberFormat: platform.name == 'clio' || platform.name == 'insightly' });
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
                  const { matched: contactMatched, contactInfo } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isForceRefresh: true });
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
              const callAutoPopup = userCore.getCallPopSetting(userSettings).value;
              // extensions numers should NOT be logged unless explicitly allowed
              const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
              if (!!!allowExtensionNumberLogging) {
                if (data.body.call.direction === 'Inbound') {
                  if (!!data?.body?.call?.from?.extensionNumber) {
                    showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                    responseMessage(
                      data.requestId,
                      {
                        data: 'ok'
                      }
                    );
                    break;
                  }
                }
                else {
                  if (!!data?.body?.call?.to?.extensionNumber) {
                    showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                    responseMessage(
                      data.requestId,
                      {
                        data: 'ok'
                      }
                    );
                    break;
                  }
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
                      rcAdditionalSubmission,
                      sessionId: data.body.call.sessionId,
                      recordingLink: data.body.call.recording.link
                    });
                  trackUpdateCallRecordingLink({ processState: 'finish' });
                }
                responseMessage(
                  data.requestId,
                  {
                    data: 'ok'
                  }
                );
                break;
              }
              // Auto log: presence events, and Disconnect result
              if (data.body.triggerType === 'presenceUpdate') {
                if (data.body.call.result === 'Disconnected') {
                  data.body.triggerType = 'createLog';
                  isAutoLog = true;
                }
                else {
                  responseMessage(
                    data.requestId,
                    {
                      data: 'ok'
                    }
                  );
                  break;
                }
              }
              window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
              const isExtensionNumber = data.body.call.direction === 'Inbound' ?
                !!data.body.call.from.extensionNumber :
                !!data.body.call.to.extensionNumber;

              const contactPhoneNumber = data.body.call.direction === 'Inbound' ?
                (data.body.call.from.phoneNumber ?? data.body.call.from.extensionNumber) :
                (data.body.call.to.phoneNumber ?? data.body.call.to.extensionNumber);

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
                      if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
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
                        rcAdditionalSubmission,
                        contactId: newContactInfo?.id ?? data.body.formData.contact,
                        contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                        contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName
                      });
                    break;
                  case 'editLog':
                    await updateLog({
                      serverUrl: manifest.serverUrl,
                      logType: 'Call',
                      sessionId: data.body.call.sessionId,
                      rcAdditionalSubmission,
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
                const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
                showNotification({ level: callLogContactMatchMessage?.messageType, message: callLogContactMatchMessage?.message, ttl: callLogContactMatchMessage?.ttl });
                if (!callContactMatched) {
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  responseMessage(
                    data.requestId,
                    {
                      data: 'ok'
                    }
                  );
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
                    const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog, contactInfo: callMatchedContact, logType: 'callLog', direction: data.body.call.direction, isVoicemail: false });
                    if (isAutoLog && !callAutoPopup) {
                      // Case: auto log but encountering multiple selection that needs user input, so shown as conflicts
                      if (hasConflict) {
                        window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                        const conflictLog = {
                          type: 'Call',
                          id: data.body.call.sessionId,
                          phoneNumber: contactPhoneNumber,
                          direction: data.body.call.direction,
                          contactInfo: callMatchedContact ?? [],
                          subject: callLogSubject,
                          note,
                          date: moment(data.body.call.startTime).format('MM/DD/YYYY')
                        };
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
                            rcAdditionalSubmission,
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
                        loggedContactId = existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`].contact?.id ?? null;
                      }
                      // add your codes here to log call to your service
                      const callPage = logPage.getLogPageRender({ id: data.body.call.sessionId, manifest, logType: 'Call', triggerType: data.body.triggerType, platformName, direction: data.body.call.direction, contactInfo: callMatchedContact ?? [], subject: callLogSubject, note, loggedContactId });
                      // default form value from user settings
                      if (data.body.call.direction === 'Inbound') {
                        const inboundCallDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType: 'inboundCall', logType: 'callLog' });
                        for (const inboundCallDefaultValue of inboundCallDefaultValues) {
                          const inboundCallMappedOption = callPage.schema.properties[inboundCallDefaultValue.field]?.oneOf.find(o => rawTextCompare(o.const, inboundCallDefaultValue.value))?.const;
                          if (!!inboundCallMappedOption) {
                            callPage.formData[inboundCallDefaultValue.field] = inboundCallMappedOption;
                          }
                          else if (allowBullhornCustomNoteAction() && !!platform?.page['callLog']?.additionalFields.find(f => f.const == inboundCallDefaultValue.field)?.allowCustomValue && !!callPage.schema.properties[inboundCallDefaultValue.field]?.oneOf) {
                            callPage.schema.properties[inboundCallDefaultValue.field].oneOf.push({ const: inboundCallDefaultValue.value, title: inboundCallDefaultValue.value });
                            callPage.formData[inboundCallDefaultValue.field] = inboundCallDefaultValue.value;
                          }
                        }
                      }
                      if (data.body.call.direction === 'Outbound') {
                        const outboundCallDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType: 'outboundCall', logType: 'callLog' });
                        for (const outboundCallDefaultValue of outboundCallDefaultValues) {
                          const outboundCallMappedOption = callPage.schema.properties[outboundCallDefaultValue.field]?.oneOf.find(o => rawTextCompare(o.const, outboundCallDefaultValue.value))?.const;
                          if (!!outboundCallMappedOption) {
                            callPage.formData[outboundCallDefaultValue.field] = outboundCallMappedOption;
                          }
                          else if (allowBullhornCustomNoteAction() && !!platform?.page['callLog']?.additionalFields.find(f => f.const == outboundCallDefaultValue.field)?.allowCustomValue && !!callPage.schema.properties[outboundCallDefaultValue.field]?.oneOf) {
                            callPage.schema.properties[outboundCallDefaultValue.field].oneOf.push({ const: outboundCallDefaultValue.value, title: outboundCallDefaultValue.value });
                            callPage.formData[outboundCallDefaultValue.field] = outboundCallDefaultValue.value;
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
              let noLocalMatchedSessionIds = [];
              const existingCallLogRecords = await chrome.storage.local.get(
                data.body.sessionIds.map(sessionId => `rc-crm-call-log-${sessionId}`)
              );
              for (const sessionId of data.body.sessionIds) {
                if (!!existingCallLogRecords[`rc-crm-call-log-${sessionId}`]) {
                  callLogMatchData[sessionId] = [{ id: sessionId, note: '', contact: { id: existingCallLogRecords[`rc-crm-call-log-${sessionId}`].contact?.id } }];
                } else {
                  noLocalMatchedSessionIds.push(sessionId);
                }
              }
              if (noLocalMatchedSessionIds.length > 0) {
                const { successful, callLogs } = await getLog({ serverUrl: manifest.serverUrl, logType: 'Call', sessionIds: noLocalMatchedSessionIds.toString(), requireDetails: false });
                if (successful) {
                  const newLocalMatchedCallLogRecords = {};
                  for (const sessionId of noLocalMatchedSessionIds) {
                    const correspondingLog = callLogs.find(l => l.sessionId === sessionId);
                    if (!!correspondingLog?.matched) {
                      callLogMatchData[sessionId] = [{ id: sessionId, note: '' }];
                      newLocalMatchedCallLogRecords[`rc-crm-call-log-${sessionId}`] = { logId: correspondingLog.logId, contact: { id: correspondingLog.contact?.id } };
                    }
                  }
                  await chrome.storage.local.set(newLocalMatchedCallLogRecords);
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
              if (!!!autoPopupMainConverastionId) {
                autoPopupMainConverastionId = data.body.conversation.conversationId;
              }
              if (!!data?.body?.conversation?.correspondents[0]?.extensionNumber) {
                showNotification({ level: 'warning', message: 'Extension numbers cannot be logged', ttl: 3000 });
                responseMessage(data.requestId, { data: 'ok' });
                break;
              }
              const { rc_messageLogger_auto_log_notify: messageAutoLogOn } = await chrome.storage.local.get({ rc_messageLogger_auto_log_notify: false });
              const messageAutoPopup = usercore.getSMSPopSetting(userSettings).value;
              const messageLogPrefId = `rc-crm-conversation-pref-${data.body.conversation.conversationLogId}`;
              const existingConversationLogPref = await chrome.storage.local.get(messageLogPrefId);
              let getContactMatchResult = null;
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
                    rcAdditionalSubmission,
                    contactId: existingConversationLogPref[messageLogPrefId].contact.id,
                    contactType: existingConversationLogPref[messageLogPrefId].contact.type,
                    contactName: existingConversationLogPref[messageLogPrefId].contact.name
                  });
                }
                else {
                  getContactMatchResult = (await getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                    platformName
                  })).contactInfo;
                  const { hasConflict, autoSelectAdditionalSubmission } = getLogConflictInfo({ isAutoLog: messageAutoLogOn, contactInfo: getContactMatchResult, logType: 'messageLog', isVoicemail: data.body.conversation.type === 'VoiceMail' });
                  // Sub-case: has conflict
                  if (hasConflict) {
                    const conflictLog = {
                      type: 'Message',
                      id: data.body.conversation.conversationId,
                      direction: '',
                      contactInfo: getContactMatchResult ?? [],
                      date: moment(data.body.conversation.messages[0].creationTime).format('MM/DD/YYYY')
                    };
                    const conflictContent = getConflictContentFromUnresolvedLog(conflictLog);
                    showNotification({ level: 'warning', message: `Message not logged. ${conflictContent.description}.`, ttl: 5000 });
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
                      rcAdditionalSubmission,
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
                    if (userCore.getOpenContactAfterCreationSetting(userSettings).value) {
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
                    rcAdditionalSubmission,
                    contactId: newContactInfo?.id ?? data.body.formData.contact,
                    contactType: data.body.formData.newContactType === '' ? data.body.formData.contactType : data.body.formData.newContactType,
                    contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName
                  });
                }
              }
              // Case: Open page OR auto pop up log page
              else {
                if (data.body.redirect) {
                  getContactMatchResult = await getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                    platformName
                  });
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
                  // default form value from user settings
                  if (data.body.conversation.type === 'VoiceMail') {
                    const voicemailDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType: 'voicemail', logType: 'messageLog' });
                    for (const voicemailDefaultValue of voicemailDefaultValues) {
                      const voicemailMappedOption = messagePage.schema.properties[voicemailDefaultValue.field]?.oneOf.find(o => rawTextCompare(o.const, voicemailDefaultValue.value))?.const;
                      if (!!voicemailMappedOption) {
                        messagePage.formData[voicemailDefaultValue.field] = voicemailMappedOption;
                      }
                      else if (allowBullhornCustomNoteAction() && !!platform?.page['messageLog']?.additionalFields.find(f => f.const == voicemailDefaultValue.field)?.allowCustomValue && !!messagePage.schema.properties[voicemailDefaultValue.field]?.oneOf) {
                        messagePage.schema.properties[voicemailDefaultValue.field].oneOf.push({ const: voicemailDefaultValue.value, title: voicemailDefaultValue.value });
                        messagePage.formData[voicemailDefaultValue.field] = voicemailDefaultValue.value;
                      }
                    }
                  }
                  else {
                    const smsDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType: 'message', logType: 'messageLog' });
                    for (const smsDefaultValue of smsDefaultValues) {
                      const smsMappedOption = messagePage.schema.properties[smsDefaultValue.field]?.oneOf.find(o => rawTextCompare(o.const, smsDefaultValue.value))?.const;
                      if (!!smsMappedOption) {
                        messagePage.formData[smsDefaultValue.field] = smsMappedOption;
                      }
                      else if (allowBullhornCustomNoteAction() && !!platform?.page['messageLog']?.additionalFields.find(f => f.const == smsDefaultValue.field)?.allowCustomValue && !!messagePage.schema.properties[smsDefaultValue.field]?.oneOf) {
                        messagePage.schema.properties[smsDefaultValue.field].oneOf.push({ const: smsDefaultValue.value, title: smsDefaultValue.value });
                        messagePage.formData[smsDefaultValue.field] = smsDefaultValue.value;
                      }
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
                }
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
              let formattedUserSettings = {};
              for (const s of data.body.userSettings) {
                if (s.items !== undefined) {
                  for (const i of s.items) {
                    formattedUserSettings[i.id] = { value: i.value };
                  }
                }
                else if (s.value !== undefined) {
                  formattedUserSettings[s.id] = { value: s.value };
                }
              }
              userSettings = await userCore.uploadUserSettings({
                serverUrl: manifest.serverUrl,
                userSettings: formattedUserSettings
              });
              await chrome.storage.local.set({ userSettings });
              if (data.body.setting.id === "toggleDeveloperMode") {
                showNotification({ level: 'success', message: `Developer mode is turned ${data.body.setting.value ? 'ON' : 'OFF'}. Please reload the extension.`, ttl: 5000 });
              }
              else if (data.body.setting.id === "toggleAutoOpenWithCRM") {
                showNotification({ level: 'success', message: `Auto open is turned ${data.body.setting.value ? 'ON' : 'OFF'}. Please reload the extension.`, ttl: 5000 });
              }
              else {
                showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
              }
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
                  const rcAccessToken = getRcAccessToken();
                  await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings, rcAccessToken });
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
                case 'saveAdminAdapterButton':
                  const customCrmManifestJson = await (await fetch(data.body.button.formData.customManifestUrl)).json();
                  if (customCrmManifestJson) {
                    adminSettings.customAdapter = {
                      url: data.body.button.formData.customManifestUrl,
                    }
                    await chrome.storage.local.set({ adminSettings });
                    const rcAccessToken = getRcAccessToken();
                    await uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings, rcAccessToken });
                    showNotification({ level: 'success', message: 'Custom manifest file uploaded.', ttl: 5000 });
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

function getAdditionalFieldDefaultValuesFromSetting({ caseType, logType }) {
  const additionalFields = platform?.page[logType]?.additionalFields;
  const result = [];
  if (!!additionalFields && !!platform.settings && platform.settings.length > 0) {
    for (const field of additionalFields) {
      const defaultValueSetting = platform.settings.find(s => s.id == field.defaultSettingId);
      if (!!defaultValueSetting) {
        const valueItem = defaultValueSetting.items.find(i => i.id === field.defaultSettingValues[caseType].settingId)
        if (!!valueItem) {
          result.push({ field: field.const, value: userCore.getCustomSetting(userSettings, valueItem.id, valueItem.defaultValue).value });
        }
      }
    }
  }
  return result;
}

// A fuzzy string compare that ignores cases and spaces
function rawTextCompare(str1 = '', str2 = '') {
  return str1.toLowerCase().replace(/\s/g, '') === str2.toLowerCase().replace(/\s/g, '');
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
    const additionalFieldsKeys = Object.keys(contactInfo[0].additionalInfo);
    // go through all additional fields
    for (const key of additionalFieldsKeys) {
      const fieldOptions = contactInfo[0].additionalInfo[key];
      // check if this contact's field options exist and
      // 1. Only 1 option -> directly choose it
      // 2. More than 1 option -> Check default value setup
      //    2.1 If no default value -> Report conflict
      //    2.2 If default value -> Apply it
      // 3. zero option ->  
      if (Array.isArray(fieldOptions)) {
        if (fieldOptions.length > 1) {
          let caseType = '';
          if (logType === 'callLog') {
            if (direction === 'Inbound') {
              caseType = 'inboundCall';
            }
            else {
              caseType = 'outboundCall';
            }
          }
          else if (logType === 'messageLog') {
            if (isVoicemail) {
              caseType = 'voicemail';
            }
            else {
              caseType = 'message';
            }
          }
          const fieldDefaultValues = getAdditionalFieldDefaultValuesFromSetting({ caseType, logType });
          let allMatched = true;
          const fieldDefaultValue = fieldDefaultValues.find(f => f.field === key);
          if (!!fieldDefaultValue) {
            const fieldMappedOption = contactInfo[0].additionalInfo[key]?.find(o => rawTextCompare(o.const, fieldDefaultValue.value))?.const;
            if (!!fieldMappedOption) {
              autoSelectAdditionalSubmission[key] = fieldMappedOption;
              continue;
            }
            else {
              const allowCustomValue = !!platform?.page[logType]?.additionalFields.find(f => f.const == key)?.allowCustomValue;
              if (allowBullhornCustomNoteAction() && allowCustomValue) {
                autoSelectAdditionalSubmission[key] = fieldDefaultValue.value;
                continue;
              }
              else {
                allMatched = false;
              }
            }
          }
          return { hasConflict: !allMatched, autoSelectAdditionalSubmission };
        }
        else if (fieldOptions.length === 1) {
          autoSelectAdditionalSubmission[key] = fieldOptions[0].const;
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
  trackCRMSetupError();
}

async function getServiceManifest({ serviceName, customSettings, userSettings }) {
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
    callLoggerAutoSettingReadOnly: userCore.getAutoLogCallSetting(userSettings).readOnly,
    callLoggerAutoSettingReadOnlyReason: userCore.getAutoLogCallSetting(userSettings).readOnlyReason,
    callLoggerAutoSettingReadOnlyValue: userCore.getAutoLogCallSetting(userSettings).value,

    messageLoggerPath: '/messageLogger',
    messagesLogPageInputChangedEventPath: '/messageLogger/inputChanged',
    messageLogEntityMatcherPath: '/messageLogger/match',
    messageLoggerAutoSettingLabel: 'Log SMS conversations automatically',
    messageLoggerAutoSettingReadOnly: userCore.getAutoLogSMSSetting(userSettings).readOnly,
    messageLoggerAutoSettingReadOnlyReason: userCore.getAutoLogSMSSetting(userSettings).readOnlyReason,
    messageLoggerAutoSettingReadOnlyValue: userCore.getAutoLogSMSSetting(userSettings).value,

    settingsPath: '/settings',
    settings: [
      {
        id: "popupLogPageAfterCall",
        type: "boolean",
        groupId: "logging",
        name: 'Open call logging page after call',
        readOnly: userCore.getCallPopSetting(userSettings).readOnly,
        readOnlyReason: userCore.getCallPopSetting(userSettings).readOnlyReason,
        value: userCore.getCallPopSetting(userSettings).value
      },
      {
        id: "popupLogPageAfterSMS",
        type: "boolean",
        groupId: "logging",
        name: 'Open SMS logging page after message',
        readOnly: userCore.getSMSPopSetting(userSettings).readOnly,
        readOnlyReason: userCore.getSMSPopSetting(userSettings).readOnlyReason,
        value: userCore.getSMSPopSetting(userSettings).value
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
            value: userCore.getIncomingCallPop(userSettings).value,
            readOnly: userCore.getIncomingCallPop(userSettings).readOnly,
            readOnlyReason: userCore.getIncomingCallPop(userSettings).readOnlyReason,
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
            value: userCore.getOutgoingCallPop(userSettings).value,
            readOnly: userCore.getOutgoingCallPop(userSettings).readOnly,
            readOnlyReason: userCore.getOutgoingCallPop(userSettings).readOnlyReason
          },
          (platform.enableExtensionNumberLoggingSetting ?
            {
              id: 'allowExtensionNumberLogging',
              type: 'boolean',
              name: 'Allow extension number logging',
              value: userSettings?.allowExtensionNumberLogging?.value ?? false
            } : {}),
          {
            id: 'openContactPageAfterCreation',
            type: 'boolean',
            name: 'Open contact after creating it',
            value: userCore.getOpenContactAfterCreationSetting(userSettings).value,
            readOnly: userCore.getOpenContactAfterCreationSetting(userSettings).readOnly,
            readOnlyReason: userCore.getOpenContactAfterCreationSetting(userSettings).readOnlyReason
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
            value: userCore.getDeveloperModeSetting(userSettings).value,
            readOnly: userCore.getDeveloperModeSetting(userSettings).readOnly,
            readOnlyReason: userCore.getDeveloperModeSetting(userSettings).readOnlyReason
          },
          {
            id: 'toggleAutoOpenWithCRM',
            type: 'boolean',
            name: 'Auto open extension',
            value: userCore.getAutoOpenSetting(userSettings).value,
            readOnly: userCore.getAutoOpenSetting(userSettings).readOnly,
            readOnlyReason: userCore.getAutoOpenSetting(userSettings).readOnlyReason
          },
        ]
      }
    ],
    buttonEventPath: '/custom-button-click'
  }
  if (!!customSettings) {
    for (const cs of customSettings) {
      const items = [];
      for (const item of cs.items) {
        switch (item.type) {
          case 'inputField':
            items.push({
              id: item.id,
              type: 'string',
              name: item.name,
              placeHolder: item.placeHolder ?? "",
              value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value,
              readOnly: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnly,
              readOnlyReason: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnlyReason
            });
            break;
          case 'boolean':
            items.push({
              id: item.id,
              type: item.type,
              name: item.name,
              value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value,
              readOnly: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnly,
              readOnlyReason: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnlyReason
            });
            break;
          case 'warning':
            items.push(
              {
                id: item.id,
                name: item.name,
                type: 'admonition',
                severity: 'warning',
                value: item.value
              }
            )
            break;
          case 'option':
            items.push(
              {
                id: item.id,
                type: "option",
                name: item.name,
                options: item.options,
                value: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).value,
                readOnly: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnly,
                readOnlyReason: userCore.getCustomSetting(userSettings, item.id, item.defaultValue).readOnlyReason
              }
            )
            break;
        }
      }
      services.settings.unshift(
        {
          id: cs.id,
          type: cs.type,
          name: cs.name,
          items
        }
      );
    }
  };
  if (serviceName === 'clio' || serviceName === 'insightly') {
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
        value: userSettings?.numberFormatter1?.value ?? "",
        readOnly: userSettings?.numberFormatter1?.customizable ?? true,
        readOnlyReason: !!!userSettings?.numberFormatter1?.customizable ? 'This setting is managed by admin' : ''
      },
      {
        id: "overridingPhoneNumberFormat2",
        name: "Format 2",
        type: "string",
        value: userSettings?.numberFormatter2?.value ?? "",
        readOnly: userSettings?.numberFormatter2?.customizable ?? true,
        readOnlyReason: !!!userSettings?.numberFormatter2?.customizable ? 'This setting is managed by admin' : ''
      },
      {
        id: "overridingPhoneNumberFormat3",
        name: "Format 3",
        type: "string",
        value: userSettings?.numberFormatter3?.value ?? "",
        readOnly: userSettings?.numberFormatter3?.customizable ?? true,
        readOnlyReason: !!!userSettings?.numberFormatter3?.customizable ? 'This setting is managed by admin' : ''
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

  if (userCore.getDeveloperModeSetting(userSettings).value) {
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