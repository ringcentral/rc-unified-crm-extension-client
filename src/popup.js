import logCore from './core/log';
import contactCore from './core/contact';
import contactSearch from './core/customContactSearch';
import dispositionCore from './core/disposition';
import userCore from './core/user';
import adminCore from './core/admin';
import authCore from './core/auth';
import { downloadTextFile, checkC2DCollision, responseMessage, isObjectEmpty, showNotification, dismissNotification, getRcInfo, getRcAccessToken, getUserReportStats, getRcContactInfo } from './lib/util';
import { getUserInfo } from './lib/rcAPI';
import moment from 'moment';
import logPage from './components/logPage';
import authPage from './components/authPage';
import feedbackPage from './components/feedbackPage';
import releaseNotesPage from './components/releaseNotesPage';
import supportPage from './components/supportPage';
import aboutPage from './components/aboutPage';
import developerSettingsPage from './components/developerSettingsPage';
import reportPage from './components/reportPage';
import adminPage from './components/admin/adminPage';
import managedSettingsPage from './components/admin/managedSettingsPage';
import generalSettingPage from './components/admin/generalSettingPage';
import callAndSMSLoggingSettingPage from './components/admin/managedSettings/callAndSMSLoggingSettingPage';
import customAdapterPage from './components/admin/customAdapterPage';
import userMappingPage from './components/admin/userMappingPage/userMappingPage';
import editUserMappingPage from './components/admin/userMappingPage/editUserMappingPage';
import serverSideLoggingPage from './components/admin/serverSideLoggingPage';
import contactSettingPage from './components/admin/managedSettings/contactSettingPage';
import advancedFeaturesSettingPage from './components/admin/managedSettings/advancedFeaturesSettingPage';
import customSettingsPage from './components/admin/managedSettings/customSettingsPage';
import customizeTabsSettingPage from './components/admin/generalSettings/customizeTabsSettingPage';
import clickToDialEmbedPage from './components/admin/generalSettings/clickToDialEmbedPage';
import notificationLevelSettingPage from './components/admin/generalSettings/notificationLevelSettingPage';
import appearancePage from './components/admin/generalSettings/appearancePage';
import callLogDetailsSettingPage from './components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage';
import tempLogNotePage from './components/tempLogNotePage';
import googleSheetsPage from './components/platformSpecific/googleSheetsPage';
import adminGoogleSheetsPage from './components/admin/adminGoogleSheetsPage';
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
import { logPageFormDataDefaulting, getLogConflictInfo, addPendingRecordingSessionId, triggerPendingRecordingCheck, removePendingRecordingSessionId } from './lib/logUtil';
import { bullhornHeartbeat, tryConnectToBullhorn } from './misc/bullhorn';

import axios from 'axios';
import { getManifest } from './service/manifestService';
import { saveManifestUrl } from './service/manifestService';
import { getPlatformInfo } from './service/platformService';

// event handlers
import rcTelephonySessionNotifyHandler from './eventHandlers/rc-telephony-session-notify';
import rcCallingSettingsNotifyHandler from './eventHandlers/rc-calling-settings-notify';
import rcRegionSettingsNotifyHandler from './eventHandlers/rc-region-settings-notify';
import rcAdapterSideDrawerOpenNotifyHandler from './eventHandlers/rc-adapter-side-drawer-open-notify';
import rcDialerStatusNotifyHandler from './eventHandlers/rc-dialer-status-notify';
import rcWebphoneConnectionStatusNotifyHandler from './eventHandlers/rc-webphone-connection-status-notify';
import rcAdapterPushAdapterStateHandler from './eventHandlers/rc-adapter-pushAdapterState';
import rcLoginStatusNotifyHandler from './eventHandlers/rc-login-status-notify';
import rcLoginPopupNotifyHandler from './eventHandlers/rc-login-popup-notify';
import rcCallInitNotifyHandler from './eventHandlers/rc-call-init-notify';
import rcCallStartNotifyHandler from './eventHandlers/rc-call-start-notify';
import rcCallEndNotifyHandler from './eventHandlers/rc-call-end-notify';
import rcRingoutCallNotifyHandler from './eventHandlers/rc-ringout-call-notify';
import rcActiveCallNotifyHandler from './eventHandlers/rc-active-call-notify';
import rcAnalyticsTrackNotifyHandler from './eventHandlers/rc-analytics-track';
import rcCallLoggerAutoLogNotifyHandler from './eventHandlers/rc-callLogger-auto-log-notify';
import rcMessageLoggerAutoLogNotifyHandler from './eventHandlers/rc-messageLogger-auto-log-notify';
import rcRouteChangedNotifyHandler from './eventHandlers/rc-route-changed-notify';
import rcAdapterAiAssistantSettingsNotifyHandler from './eventHandlers/rc-adapter-ai-assistant-settings-notify';
import rcPostMessageRequestHandler from './eventHandlers/rc-post-message-request';
import rcAdapterPhoneNumberFormatSettingsNotifyHandler from './eventHandlers/rc-adapter-phone-number-format-settings-notify';

// message handlers
import oauthCallBackHandler from './messageHandlers/oauthCallBack';
import pipedriveCallbackUriHandler from './messageHandlers/pipedriveCallbackUri';
import c2smsHandler from './messageHandlers/c2sms';
import c2dHandler from './messageHandlers/c2d';
import c2scheduleHandler from './messageHandlers/c2schedule';
import navigateHandler from './messageHandlers/navigate';
import insightlyAuthHandler from './messageHandlers/insightlyAuth';
import ringsenseRefTrackHandler from './messageHandlers/ringsenseRefTrack';


axios.defaults.timeout = 30000; // Set default timeout to 30 seconds, can be overriden with server manifest

window.__ON_RC_POPUP_WINDOW = 1;

checkC2DCollision();
getCustomManifest();
getImplementedInterfaces();

async function getCustomManifest() {
  const customCrmManifest = await getManifest();
  if (customCrmManifest) {
    const { customCrmManifestUrl } = await chrome.storage.local.get({ customCrmManifestUrl: null });
    if (customCrmManifestUrl) {
      await saveManifestUrl({ manifestUrl: customCrmManifestUrl });
    }
    setAuthor(customCrmManifest?.author?.name ?? "");
  }
}

async function getImplementedInterfaces() {
  const platformInfo = await getPlatformInfo();
  if (platformInfo) {
    const manifest = await getManifest();
    const response = await axios.get(`${manifest.serverUrl}/implementedInterfaces?platform=${platformInfo.platformName}`);
    if (response.data) {
      await chrome.storage.local.set({ implementedInterfaces: response.data });
    }
  }
}

// TODO: re-do errors
// let errorLogs = [];
// window.onerror = (event, source, lineno, colno, error) => {
//   errorLogs.push({ event, source, lineno, colno, error })
// };

// Interact with RingCentral Embeddable Voice:
window.addEventListener('message', async (e) => {
  const data = e.data;
  let noShowNotification = false;
  try {
    if (data) {
      switch (data.type) {
        case 'rc-telephony-session-notify':
          await rcTelephonySessionNotifyHandler.onEvent({ data });
          break;
        case 'rc-calling-settings-notify':
          await rcCallingSettingsNotifyHandler.onEvent({ data });
          break;
        case 'rc-region-settings-notify':
          await rcRegionSettingsNotifyHandler.onEvent({ data });
          break;
        case 'rc-adapter-side-drawer-open-notify':
          await rcAdapterSideDrawerOpenNotifyHandler.onEvent({ data });
          break;
        case 'rc-dialer-status-notify':
          await rcDialerStatusNotifyHandler.onEvent({ data });
          break;
        case 'rc-webphone-connection-status-notify':
          await rcWebphoneConnectionStatusNotifyHandler.onEvent({ data });
          break;
        case 'rc-adapter-pushAdapterState':
          await rcAdapterPushAdapterStateHandler.onEvent({ data });
          break;
        case 'rc-login-status-notify':
          await rcLoginStatusNotifyHandler.onEvent({ data });
          break;
        case 'rc-login-popup-notify':
          await rcLoginPopupNotifyHandler.onEvent({ data });
          break;
        case 'rc-call-init-notify':
          await rcCallInitNotifyHandler.onEvent({ data });
          break;
        case 'rc-call-start-notify':
          await rcCallStartNotifyHandler.onEvent({ data });
          break;
        case 'rc-call-end-notify':
          await rcCallEndNotifyHandler.onEvent({ data });
          break;
        case 'rc-ringout-call-notify':
          await rcRingoutCallNotifyHandler.onEvent({ data });
          break;
        case "rc-active-call-notify":
          await rcActiveCallNotifyHandler.onEvent({ data });
          break;
        case 'rc-analytics-track':
          await rcAnalyticsTrackNotifyHandler.onEvent({ data });
          break;
        case 'rc-callLogger-auto-log-notify':
          await rcCallLoggerAutoLogNotifyHandler.onEvent({ data });
          break;
        case 'rc-messageLogger-auto-log-notify':
          await rcMessageLoggerAutoLogNotifyHandler.onEvent({ data });
          break;
        case 'rc-route-changed-notify':
          await rcRouteChangedNotifyHandler.onEvent({ data });
          break;
        case 'rc-adapter-ai-assistant-settings-notify':
          await rcAdapterAiAssistantSettingsNotifyHandler.onEvent({ data });
          break;
        case 'rc-post-message-request':
          await rcPostMessageRequestHandler.onEvent({ data });
          break;
        case "rc-adapter-phone-number-format-settings-notify":
          await rcAdapterPhoneNumberFormatSettingsNotifyHandler.onEvent({ data });
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
                      handleThirdPartyOAuthWindow(authUri);
                    }
                    // Unique: Bullhorn
                    else if (platformName === 'bullhorn') {
                      await tryConnectToBullhorn({ platform });
                    }
                    else {
                      authUri = `${platform.auth.oauth.authUrl}?` +
                        `response_type=code` +
                        `&client_id=${platform.auth.oauth.clientId}` +
                        `${!!platform.auth.oauth.scope && platform.auth.oauth.scope != '' ? `&${platform.auth.oauth.scope}` : ''}` +
                        `&state=${customState === '' ? `platform=${platform.name}` : customState}` +
                        '&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html';
                      handleThirdPartyOAuthWindow(authUri);
                    }
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
                await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: "" });
                await authCore.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
                if (platform.useLicense) {
                  await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl });
                }
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
                case 'editUserMappingPage':
                  if (data.body.formData.searchWord) {
                    const editUserMappingPageRender = editUserMappingPage.renderEditUserMappingPage({
                      userMapping: data.body.formData.userMapping,
                      platformDisplayName: platform.displayName,
                      rcExtensions: data.body.formData.rcExtensions,
                      selectedRcExtensionId: data.body.formData.rcExtensionList
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-register-customized-page',
                      page: editUserMappingPageRender
                    });
                  }
                  break;
                case 'userMappingPage':
                  // Case: user search in userMappingList
                  if (data.body.formData.userSearch) {
                    const userMappingPageRender = userMappingPage.getUserMappingPageRender({
                      userMapping: data.body.formData.allUserMapping,
                      platformDisplayName: platform.displayName,
                      searchWord: data.body.formData.userSearch.search,
                      filter: data.body.formData.userSearch.filter
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-register-customized-page',
                      page: userMappingPageRender
                    });
                  }
                  break;
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
                case 'adminGoogleSheetsPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  if (data.body.keys && data.body.keys.includes('managedToggle')) {
                    const isManaged = data.body.formData.managedToggle || false;
                    if (adminSettings?.userSettings?.googleSheetsName) {
                      adminSettings.userSettings.googleSheetsName.customizable = !isManaged;
                    }
                    if (adminSettings?.userSettings?.googleSheetsUrl) {
                      adminSettings.userSettings.googleSheetsUrl.customizable = !isManaged;
                    }
                    await chrome.storage.local.set({ adminSettings });
                    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                    await userCore.refreshUserSettings({});
                    showNotification({ 
                      level: 'success', 
                      message: `Google Sheets setting ${isManaged ? 'enforced for all users' : 'made customizable for users'}`, 
                      ttl: 3000 
                    });
                  }
                  const updatedAdminGoogleSheetsPage = adminGoogleSheetsPage.getUpdatedAdminGoogleSheetsPage({ page: data.body.page, formData: data.body.formData });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: updatedAdminGoogleSheetsPage
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${updatedAdminGoogleSheetsPage.id}`, // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'contactSearchResultCallLog':
                  let selectedContact = data.body.page.formData.contactInfo.find(c => c.id === data.body.formData.contactList);
                  // Ensure isNewContact is not set for real contacts
                  selectedContact = { ...selectedContact };
                  delete selectedContact.isNewContact;
                  const { cacheLogPageData } = await chrome.storage.local.get("cacheLogPageData");
                  const contactData = cacheLogPageData.contactInfo;
                  if (!contactData.some(c => c.id === selectedContact.id)) {
                    contactData.push(selectedContact);
                  }
                  if (contactData.length > 0) {
                    const cachedSearchContactKey = `rc-crm-search-contact-${data.body.formData?.contactPhoneNumber}`;
                    const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
                    let contactArr = storageObj[cachedSearchContactKey] || [];
                    if (!contactArr.some(c => c.id === selectedContact.id)) {
                      contactArr.push(selectedContact);
                    }
                    await chrome.storage.local.set({ [cachedSearchContactKey]: contactArr });
                  }
                  // First get the initial log page
                  const initialLogPage = logPage.getLogPageRender({
                    ...cacheLogPageData,
                    contactInfo: contactData.map(c => ({ ...c, isNewContact: undefined }))
                  });

                  // Then update it with the selected contact
                  const cachedLogPage = logPage.getUpdatedLogPageRender({
                    manifest,
                    platformName,
                    logType: 'Call',
                    updateData: {
                      page: initialLogPage,
                      formData: {
                        ...initialLogPage.formData,
                        contact: selectedContact.id,
                        contactType: selectedContact.type,
                        contactName: selectedContact.name,
                        contactInfo: contactData.map(c => ({ ...c, isNewContact: undefined })),
                        returnToHistoryPage: true
                      },
                      keys: ['contact']
                    }
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-trigger-contact-match',
                    phoneNumbers: [data.body.formData?.contactPhoneNumber],
                  }, '*');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-update-call-log-page',
                    page: cachedLogPage
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/history`
                  }, '*');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/log/call/${cacheLogPageData.id}`,
                  }, '*');
                  break;
                case 'contactSearchResultMessageLog':
                  if (data.body.keys.some(k => k === "contactInfo")) {
                    let selectedContact = data.body.page.formData.contactInfo.find(c => c.id === data.body.formData.contactList);
                    // Ensure isNewContact is not set for real contacts
                    selectedContact = { ...selectedContact };
                    delete selectedContact.isNewContact;
                    const { cacheLogPageData } = await chrome.storage.local.get("cacheLogPageData");
                    const contactData = cacheLogPageData.contactInfo;
                    if (contactData.length > 0) {
                      const cachedSearchContactKey = `rc-crm-search-contact-${data.body.formData?.contactPhoneNumber}`;
                      const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
                      let contactArr = storageObj[cachedSearchContactKey] || [];
                      if (!contactArr.some(c => c.id === selectedContact.id)) {
                        contactArr.push(selectedContact);
                      }
                      await chrome.storage.local.set({ [cachedSearchContactKey]: contactArr });
                    }
                    if (!contactData.some(c => c.id === selectedContact.id)) {
                      contactData.push(selectedContact);
                    }
                    const initialLogPage = logPage.getLogPageRender({ ...cacheLogPageData, contactInfo: contactData.map(c => ({ ...c, isNewContact: undefined })) });
                    const cachedLogPage = logPage.getUpdatedLogPageRender({
                      manifest,
                      platformName,
                      logType: 'Call',
                      updateData: {
                        page: initialLogPage,
                        formData: {
                          ...initialLogPage.formData,
                          contact: selectedContact.id,
                          contactType: selectedContact.type,
                          contactName: selectedContact.name,
                          contactInfo: contactData.map(c => ({ ...c, isNewContact: undefined })),
                          returnToHistoryPage: true
                        },
                        keys: ['contact']
                      }
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-trigger-contact-match',
                      phoneNumbers: [data.body.formData?.contactPhoneNumber],
                    }, '*');
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-update-messages-log-page',
                      page: cachedLogPage
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-navigate-to',
                      path: `/history`
                    }, '*');
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-navigate-to',
                      path: `/log/messages/${cacheLogPageData.id}`, // page id
                    }, '*');
                  }
                  break;
                case 'reportPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  if (data.body.formData.unloggedCallSummary === 'unloggedCallCount') {
                    const { calls: unloggedCalls } = await RCAdapter.getUnloggedCalls(100, 1);
                    for (const c of unloggedCalls) {
                      const { matched, contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: c.direction === 'Inbound' ? c.from.phoneNumber : c.to.phoneNumber, platformName });
                      c.matched = matched;
                      c.contactInfo = contactInfo;
                      c.phoneNumber = c.direction === 'Inbound' ? c.from.phoneNumber : c.to.phoneNumber;
                    }
                    const unloggedCallPageRender = logPage.getUnloggedCallPageRender({ unloggedCalls });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-register-customized-page',
                      page: unloggedCallPageRender,
                    });
                    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                      type: 'rc-adapter-navigate-to',
                      path: `/customized/${unloggedCallPageRender.id}`, // page id
                    }, '*');
                    await chrome.storage.local.set({ unloggedCallPageDataCache: unloggedCalls });
                  }
                  else {
                    if (userCore.getShowUserReportTabSetting(userSettings).value) {
                      const userReportStats = await getUserReportStats({ dateRange: data.body.formData.dateRangeEnums, customStartDate: data.body.formData.startDate, customEndDate: data.body.formData.endDate });
                      const reportPageRender = reportPage.getReportsPageRender({ userStats: userReportStats, userSettings });
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: reportPageRender,
                      });
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-navigate-to',
                        path: `/customizedTabs/${reportPageRender.id}`, // page id
                      }, '*');
                    }
                  }
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'unloggedCallPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const callLogNote = await logCore.getCachedNote({ sessionId: data.body.formData.record.sessionId });
                  // bring out call log page
                  const callLogDataId = data.body.formData.record;
                  const { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null });
                  const callLogData = unloggedCallPageDataCache.find(c => c.sessionId === callLogDataId);
                  const callLogPageRender = logPage.getLogPageRender({
                    id: callLogData.sessionId,
                    manifest,
                    logType: 'Call',
                    contactInfo: callLogData.contactInfo.map(c => ({ ...c, isNewContact: undefined })),
                    triggerType: 'createLog',
                    platformName,
                    direction: callLogData.direction,
                    logInfo: {
                      note: callLogNote
                    },
                    contactPhoneNumber: callLogData.phoneNumber
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-update-call-log-page',
                    page: callLogPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/log/call/${callLogData.sessionId}`,
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
              }
              switch (data.body?.formData?.section) {
                case 'generalSettings':
                  const generalSettingsPageRender = generalSettingPage.getGeneralSettingPageRender();
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: generalSettingsPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${generalSettingsPageRender.id}`, // page id
                  }, '*');
                  break;
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
                case 'appearance':
                  const appearancePageRender = appearancePage.getAppearancePageRender();
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: appearancePageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${appearancePageRender.id}`, // page id
                  }, '*');
                  break;
                case 'customizeTabs':
                  const customizeTabsSettingPageRender = customizeTabsSettingPage.getCustomizeTabsSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: customizeTabsSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${customizeTabsSettingPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'notificationLevel':
                  const notificationLevelSettingPageRender = notificationLevelSettingPage.getNotificationLevelSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: notificationLevelSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${notificationLevelSettingPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'clickToDialEmbed':
                  const clickToDialEmbedPageRender = clickToDialEmbedPage.getClickToDialEmbedPageRender({ adminUserSettings: adminSettings?.userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: clickToDialEmbedPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${clickToDialEmbedPageRender.id}`, // page id
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
                  const additionalFieldValues = await adminCore.getServerSideLoggingAdditionalFieldValues({ platform });
                  const serverSideLoggingSettingPageRender = serverSideLoggingPage.getServerSideLoggingSettingPageRender({
                    subscriptionLevel,
                    doNotLogNumbers: serverSideLoggingSubscription.doNotLogNumbers,
                    loggingByAdmin: serverSideLoggingSubscription.loggingByAdmin,
                    additionalFields: platform.serverSideLogging?.additionalFields ?? [],
                    additionalFieldValues
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
                case 'googleSheetsAdminConfig':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  adminSettings = await adminCore.refreshAdminSettings().then(result => result.adminSettings);
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings })
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/adminGoogleSheetsPage', // page id
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
                  const customSettingsPageRender = customSettingsPage.getCustomSettingsPageRender({ crmManifest: platform, adminUserSettings: adminSettings?.userSettings, userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: customSettingsPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${customSettingsPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'callLogDetailsSetting':
                  const callLogDetailsSettingPageRender = callLogDetailsSettingPage.getCallLogDetailsSettingPageRender({ adminUserSettings: adminSettings?.userSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: callLogDetailsSettingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${callLogDetailsSettingPageRender.id}`, // page id
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
                case 'userMapping':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const userMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
                  adminSettings.userMappings = userMapping.map(um => ({
                    crmUserId: um.crmUser.id,
                    rcExtensionId: um.rcUser?.extensionId ?? 'none'
                  }));
                  const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping, platformDisplayName: platform.displayName });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: userMappingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${userMappingPageRender.id}`, // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
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
                const cachedSearchContactKey = `rc-crm-search-contact-${data.body.phoneNumbers[0]}`;
                const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
                const cachedContacts = storageObj[cachedSearchContactKey] || [];
                for (const cachedContact of cachedContacts) {
                  if (!formattedMactchContacts.some(c => c.id === cachedContact.id)) {
                    formattedMactchContacts.unshift({
                      id: cachedContact.id,
                      type: platformName,
                      name: cachedContact.name,
                      phoneNumbers: [
                        {
                          phoneNumber: cachedContact.phone,
                          phoneType: 'direct'
                        }
                      ],
                      entityType: platformName,
                      contactType: cachedContact.type,
                      additionalInfo: cachedContact.additionalInfo
                    });
                  }
                }
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
                  const { matched: contactMatched, returnMessage: contactMatchReturnMessage, contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber: !contactPhoneNumber.startsWith('+'), isForceRefresh: true, isToTriggerContactMatch: false });
                  if (contactMatched) {
                    if (!matchedContacts[contactPhoneNumber]) {
                      matchedContacts[contactPhoneNumber] = [];
                    }
                    if (contactInfo.some(c => !c.isNewContact)) {
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
                  if (!data.body.redirect) {
                    responseMessage(data.requestId, { data: 'ok' });
                    break;
                  }
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
                  if (!data.body.redirect) {
                    responseMessage(data.requestId, { data: 'ok' });
                    break;
                  }
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
                  const newContactAdditionalFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
                  for (const f of additionalFields.concat(newContactAdditionalFields)) {
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
                          newContactType: data.body.formData.newContactType,
                          additionalSubmission
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
                          additionalSubmission,
                          returnToHistoryPage: !!data.body.redirect
                        });
                      if (!platform.disableDisposition && !isObjectEmpty(additionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                        await dispositionCore.upsertDisposition({
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          sessionId: data.body.call.sessionId,
                          dispositions: { ...additionalSubmission, note: data.body.formData.note ?? "" }
                        });
                        // update unlogged call page list
                        let { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null });
                        if (unloggedCallPageDataCache) {
                          unloggedCallPageDataCache = unloggedCallPageDataCache.filter(c => c.sessionId !== data.body.call.sessionId);
                          const unloggedCallPageRender = logPage.getUnloggedCallPageRender({ unloggedCalls: unloggedCallPageDataCache });
                          document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                            type: 'rc-adapter-register-customized-page',
                            page: unloggedCallPageRender
                          });
                          await chrome.storage.local.set({ unloggedCallPageDataCache });
                        }
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
                        direction: data.body.call.direction,
                        from: data.body.call.from,
                        to: data.body.call.to,
                        isShowNotification: true
                      });
                      if (!platform.disableDisposition) {
                        await dispositionCore.upsertDisposition({
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          sessionId: data.body.call.sessionId,
                          dispositions: { ...additionalSubmission, note: data.body.formData.note ?? "" }
                        });
                      }
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
                      serverUrl: manifest.serverUrl,
                      dataBody: data.body
                    });
                    if (data.body.call?.recording?.link) {
                      trackUpdateCallRecordingLink({ processState: 'finish' });
                      // remove pending recording link mark from storage
                      await removePendingRecordingSessionId({ sessionId: data.body.call.sessionId });
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
                  const cachedSearchContactKey = `rc-crm-search-contact-${contactPhoneNumber}`;
                  const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
                  const cachedContacts = storageObj[cachedSearchContactKey] || [];
                  if (!callContactMatched) {
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                    // Unique: Google Sheets
                    if (platformName === 'googleSheets') {
                      showNotification({ level: callLogContactMatchMessage?.messageType, message: callLogContactMatchMessage?.message, ttl: callLogContactMatchMessage?.ttl, details: callLogContactMatchMessage?.details });
                    }
                    responseMessage(data.requestId, { data: 'ok' });
                    break;
                  }
                  for (const cachedContact of cachedContacts) {
                    if (!callMatchedContact.some(c => c.id === cachedContact.id)) {
                      callMatchedContact.unshift(cachedContact);
                    }
                  }
                  let defaultingContact = callMatchedContact?.length > 0 ? callMatchedContact[0] : null;
                  if (data.body.call.toNumberEntity) {
                    if (callMatchedContact.some(c => c.id == data.body.call.toNumberEntity)) {
                      const toNumberEntityContact = callMatchedContact.find(c => c.id == data.body.call.toNumberEntity);
                      toNumberEntityContact.toNumberEntity = true;
                      defaultingContact = toNumberEntityContact;
                    }
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
                        // Ensure we get the most recent cached note
                        const cachedNote = await logCore.getCachedNote({ sessionId: data.body.call.sessionId });
                        const noteToUse = cachedNote || logInfo.note || '';

                        await logCore.updateLog({
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          sessionId: data.body.call.sessionId,
                          subject: logInfo.subject,
                          note: noteToUse,
                          aiNote: data.body.aiNote,
                          transcript: data.body.transcript,
                          startTime: data.body.call.startTime,
                          duration: data.body.call.duration,
                          result: data.body.call.result,
                          direction: data.body.call.direction,
                          from: data.body.call.from,
                          to: data.body.call.to,
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
                            contactName: defaultingContact?.name,
                            returnToHistoryPage: !!data.body.redirect
                          });
                        if (!platform.disableDisposition && !isObjectEmpty(autoSelectAdditionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
                          await dispositionCore.upsertDisposition({
                            serverUrl: manifest.serverUrl,
                            logType: 'Call',
                            sessionId: data.body.call.sessionId,
                            dispositions: { ...autoSelectAdditionalSubmission, note: logInfo.note ?? "" }
                          });
                        }
                      }
                    }
                    if (requireManualDisposition) {
                      showNotification({ level: 'warning', message: 'Manual disposition needed. Please edit logged call to disposition.', ttl: 5000 });
                    }
                  }
                  // Case: auto log OFF, open log page
                  else if (data.body.redirect) {
                    let loggedContactId = null;
                    const existingCallLogRecord = await chrome.storage.local.get(`rc-crm-call-log-${data.body.call.sessionId}`);
                    if (existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`]) {
                      loggedContactId = existingCallLogRecord[`rc-crm-call-log-${data.body.call.sessionId}`].contact?.id ?? null;
                    }
                    const cacheLogPageData = {
                      id: data.body.call.sessionId,
                      manifest,
                      logType: 'Call',
                      triggerType: data.body.triggerType,
                      platformName,
                      direction: data.body.call.direction,
                      contactInfo: callMatchedContact ?? [],
                      logInfo,
                      loggedContactId
                    };
                    await chrome.storage.local.set({ cacheLogPageData });
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
                      loggedContactId,
                      contactPhoneNumber
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
              if (data.body.formData.contact === 'searchContact') {
                const contactSearchRender = contactSearch.getCustomContactSearch({ contactSearchAdapterButton: "contactSearchAdapterButtonCallLog", contactPhoneNumber: data.body.formData?.contactPhoneNumber });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-register-customized-page',
                  page: contactSearchRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-navigate-to',
                  path: `/customized/${contactSearchRender.id}`,
                }, '*');
              }
              responseMessage(data.requestId, { data: 'ok' });
              break;
            case '/callLogger/match':
              let callLogMatchData = {};
              let noLocalMatchedSessionIds = [];
              // existingCallLogRecords: call logs in local storage
              const existingCallLogRecords = await chrome.storage.local.get(
                data.body.sessionIds.map(sessionId => `rc-crm-call-log-${sessionId}`)
              );
              for (const sessionId of data.body.sessionIds) {
                // match existing records
                if (existingCallLogRecords[`rc-crm-call-log-${sessionId}`]) {
                  callLogMatchData[sessionId] = [{ id: sessionId, note: '', contact: { id: existingCallLogRecords[`rc-crm-call-log-${sessionId}`].contact?.id } }];
                } else {
                  // register non-existing records to be checked online
                  noLocalMatchedSessionIds.push(sessionId);
                }
              }
              if (noLocalMatchedSessionIds.length > 0) {
                const { successful, callLogs } = await logCore.getLog({ serverUrl: manifest.serverUrl, logType: 'Call', sessionIds: noLocalMatchedSessionIds.toString(), requireDetails: false });
                // Case: no local record, but online DB check says YES
                if (successful) {
                  const newLocalMatchedCallLogRecords = {};
                  for (const sessionId of noLocalMatchedSessionIds) {
                    const correspondingLog = callLogs.find(l => l.sessionId === sessionId);
                    // correspondingLog: if matched => exsiting log record in online DB for this sessionId
                    if (correspondingLog?.matched) {
                      const localNote = await logCore.getCachedNote({ sessionId });
                      if (localNote) {
                        callLogMatchData[sessionId] = [{ id: sessionId, note: localNote }];
                        // update online record with local note
                        await logCore.updateLog({
                          serverUrl: manifest.serverUrl,
                          logType: 'Call',
                          sessionId,
                          note: localNote
                        })
                      }
                      else {
                        callLogMatchData[sessionId] = [{ id: sessionId, note: '' }];
                      }
                      newLocalMatchedCallLogRecords[`rc-crm-call-log-${sessionId}`] = { logId: correspondingLog.logId, contact: { id: correspondingLog.contact?.id } };
                    }
                    else {
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
                        message: 'preparing data...'
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
              const isAutoLogSMS = userSettings.autoLogSMS?.value ?? false;
              const isAutoLogInboundFax = userSettings.autoLogInboundFax?.value ?? false;
              const isAutoLogOutboundFax = userSettings.autoLogOutboundFax?.value ?? false;

              const messageAutoPopup = userCore.getSMSPopSetting(userSettings).value;
              const messageLogPrefId = `rc-crm-conversation-pref-${data.body.conversation.conversationLogId}`;
              const existingConversationLogPref = await chrome.storage.local.get(messageLogPrefId);
              let getContactMatchResult = null;
              let hasConflict = false;
              let autoSelectAdditionalSubmission = {};
              let requireManualDisposition = false;
              // Case: auto log
              if (data.body.triggerType === 'auto' && !messageAutoPopup) {
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
                    contactName: existingConversationLogPref[messageLogPrefId].contact.name,
                    returnToHistoryPage: !!data.body.redirect
                  });
                }
                else {
                  getContactMatchResult = (await contactCore.getContact({
                    serverUrl: manifest.serverUrl,
                    phoneNumber: data.body.conversation.correspondents[0].phoneNumber,
                    platformName
                  })).contactInfo;
                  const getLogConflictInfoResult = await getLogConflictInfo({
                    platform,
                    isAutoLog: isAutoLogSMS,
                    contactInfo: getContactMatchResult,
                    logType: 'messageLog',
                    direction: '',
                    isVoicemail: data.body.conversation.type === 'VoiceMail',
                    isFax: data.body.conversation.type === 'Fax'
                  });
                  hasConflict = getLogConflictInfoResult.hasConflict;
                  autoSelectAdditionalSubmission = getLogConflictInfoResult.autoSelectAdditionalSubmission;
                  requireManualDisposition = getLogConflictInfoResult.requireManualDisposition;
                }
                switch (data.body.conversation.type) {
                  case 'SMS':
                  case 'VoiceMail':
                    if (isAutoLogSMS) {
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
                          contactName: getContactMatchResult[0]?.name,
                          returnToHistoryPage: !!data.body.redirect
                        });
                      }
                      if (requireManualDisposition) {
                        showNotification({ level: 'warning', message: 'Manual disposition needed. Please edit logged message to disposition.', ttl: 5000 });
                      }
                    }
                    break;
                  case 'Fax':
                    const faxMessage = data.body.conversation.messages[0];
                    if (faxMessage.direction === 'Inbound' && isAutoLogInboundFax || faxMessage.direction === 'Outbound' && isAutoLogOutboundFax) {
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
                        showNotification({ level: 'warning', message: `Fax not logged. ${conflictContent.description}.`, ttl: 5000 });
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
                          contactName: getContactMatchResult[0]?.name,
                          returnToHistoryPage: !!data.body.redirect
                        });
                      }
                      if (requireManualDisposition) {
                        showNotification({ level: 'warning', message: 'Manual disposition needed. Please edit logged message to disposition.', ttl: 5000 });
                      }
                    }
                    break;
                }
              }
              // Case: manual log, submit
              else if (data.body.triggerType === 'logForm') {
                let additionalSubmission = {};
                const additionalFields = manifest.platforms[platformName].page?.messageLog?.additionalFields ?? [];
                const newContactAdditionalFields = manifest.platforms[platformName].page?.newContact?.additionalFields ?? [];
                for (const f of additionalFields.concat(newContactAdditionalFields)) {
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
                    newContactType: data.body.formData.newContactType,
                    additionalSubmission
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
                  contactName: data.body.formData.newContactName === '' ? data.body.formData.contactName : data.body.formData.newContactName,
                  returnToHistoryPage: !!data.body.redirect
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
                  const cachedSearchContactKey = `rc-crm-search-contact-${data.body.conversation.correspondents[0].phoneNumber}`;
                  const storageObj = await chrome.storage.local.get(cachedSearchContactKey);
                  const cachedContacts = storageObj[cachedSearchContactKey] || [];

                  for (const cachedContact of cachedContacts) {
                    if (!getContactMatchResult?.contactInfo?.some(c => c.id === cachedContact.id)) {
                      getContactMatchResult?.contactInfo?.unshift(cachedContact);
                    }
                  }
                  // add your codes here to log call to your service
                  const cacheLogPageData = {
                    id: data.body.conversation.conversationId,
                    manifest,
                    logType: 'Message',
                    triggerType: data.body.triggerType,
                    platformName,
                    direction: '',
                    contactInfo: getContactMatchResult.contactInfo ?? []
                  };
                  await chrome.storage.local.set({ cacheLogPageData });
                  let messagePage = logPage.getLogPageRender({
                    id: data.body.conversation.conversationId,
                    manifest,
                    logType: 'Message',
                    triggerType: data.body.triggerType,
                    platformName,
                    direction: '',
                    contactInfo: getContactMatchResult.contactInfo ?? [],
                    contactPhoneNumber: data.body?.conversation?.correspondents[0]?.phoneNumber,
                  });
                  switch (data.body.conversation.type) {
                    case 'SMS':
                      messagePage = await logPageFormDataDefaulting({
                        platform,
                        targetPage: messagePage,
                        caseType: 'message',
                        logType: 'messageLog'
                      });
                      break;
                    case 'Fax':
                      messagePage = await logPageFormDataDefaulting({
                        platform,
                        targetPage: messagePage,
                        caseType: 'fax',
                        logType: 'messageLog'
                      });
                      break;
                    case 'VoiceMail':
                      messagePage = await logPageFormDataDefaulting({
                        platform,
                        targetPage: messagePage,
                        caseType: 'voicemail',
                        logType: 'messageLog'
                      });
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
              if (data.body.formData.contact === 'searchContact') {
                const contactSearchRender = contactSearch.getCustomContactSearch({ contactSearchAdapterButton: "contactSearchAdapterButtonMessageLog", contactPhoneNumber: data.body.formData?.contactPhoneNumber });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-register-customized-page',
                  page: contactSearchRender
                });
                document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                  type: 'rc-adapter-navigate-to',
                  path: `/customized/${contactSearchRender.id}`,
                }, '*');
              }
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
                    if (i?.items !== undefined) {
                      for (const ii of i.items) {
                        changedSettings[ii.id] = { value: ii.value };
                      }
                    } else {
                      changedSettings[i.id] = { value: i.value };
                    }
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
                await chrome.storage.local.set({ developerMode: data.body.setting.value });
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
                case 'editUserMappingPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const { crmUserId, rcExtensionList } = data.body.button.formData;
                  const userMapping = {
                    crmUserId: crmUserId.toString(),
                    rcExtensionId: rcExtensionList
                  };
                  if (adminSettings?.userMappings) {
                    const existingUserMapping = adminSettings.userMappings.find(um => um.crmUserId == userMapping.crmUserId);
                    if (existingUserMapping) {
                      // Case: delete
                      if (userMapping.rcExtensionId === 'none') {
                        adminSettings.userMappings = adminSettings.userMappings.filter(um => um.crmUserId !== existingUserMapping.crmUserId);
                      }
                      // Case: update
                      else {
                        existingUserMapping.rcExtensionId = userMapping.rcExtensionId;
                      }
                    }
                    // case: create
                    else {
                      adminSettings.userMappings.push(
                        userMapping
                      )
                    }
                  }
                  else if (userMapping.rcExtensionId !== 'none') {
                    adminSettings.userMappings = [
                      userMapping
                    ]
                  }
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  const updatedUserMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
                  const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping: updatedUserMapping, platformDisplayName: platform.displayName });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: userMappingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack', // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'callAndSMSLoggingSettingPage':
                case 'contactSettingPage':
                case 'callLogDetailsSettingPage':
                case 'advancedFeaturesSettingPage':
                case 'customSettingsPage':
                case 'customizeTabsSettingPage':
                case 'notificationLevelSettingPage':
                case 'clickToDialEmbedPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const settingDataKeys = Object.keys(data.body.button.formData);
                  for (const k of settingDataKeys) {
                    adminSettings.userSettings[k] = data.body.button.formData[k];
                  }
                  await chrome.storage.local.set({ adminSettings });
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  await userCore.refreshUserSettings({});
                  showNotification({ level: 'success', message: `Settings saved.`, ttl: 3000 });
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack',
                  }, '*');
                  break;
                case 'insightlyGetApiKey':
                  const platformInfo = await chrome.storage.local.get('platform-info');
                  const hostname = platformInfo['platform-info'].hostname;
                  window.open(`https://${hostname}/Users/UserSettings`);
                  break;
                case 'authPage':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const returnedToken = await authCore.apiKeyLogin({ serverUrl: manifest.serverUrl, apiKey: data.body.button.formData.apiKey, formData: data.body.button.formData, useLicense: platform.useLicense });
                  crmAuthed = !!returnedToken;
                  await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: returnedToken });
                  if (crmAuthed) {
                    await chrome.storage.local.set({ crmAuthed });
                    // report tab
                    if (userCore.getShowUserReportTabSetting(userSettings).value) {
                      const userReportStats = await getUserReportStats({ dateRange: 'Last 24 hours' });
                      const reportPageRender = reportPage.getReportsPageRender({ userStats: userReportStats, userSettings });
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: reportPageRender,
                      }, '*');
                    }
                    // admin tab
                    const adminSettingResults = await adminCore.refreshAdminSettings();
                    adminSettings = adminSettingResults.adminSettings;
                    if (adminSettings) {
                      const adminPageRender = adminPage.getAdminPageRender({ platform });
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-register-customized-page',
                        page: adminPageRender,
                      }, '*');
                    }
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
                    await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: "" });
                    await authCore.unAuthorize({ serverUrl: manifest.serverUrl, platformName, rcUnifiedCrmExtJwt });
                    if (platform.useLicense) {
                      await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl });
                    }
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
                  const onlineVerisonResp = await axios.get(`${manifest.serverUrl}/serverVersionInfo`);
                  if (localVersion === onlineVerisonResp?.data?.version) {
                    showNotification({ level: 'success', message: `You are using the latest version (${localVersion})`, ttl: 5000 });
                  }
                  else {
                    showNotification({
                      level: 'warning',
                      message: `New version (${onlineVerisonResp?.data?.version}) is available.`,
                      details: [
                        {
                          title: 'Steps to update',
                          items: [
                            {
                              id: '1',
                              type: 'text',
                              text: '1. Go to chrome://extensions'
                            },
                            {
                              id: '2',
                              type: 'text',
                              text: '2. Click "Update"'
                            },
                            {
                              id: '3',
                              type: 'text',
                              text: `3. After a few seconds, "App Connect" should have latests version "${onlineVerisonResp?.data?.version}" next to its name`
                            }
                          ]
                        }
                      ],
                      ttl: 5000
                    });
                  }
                  break;
                case 'openCommunityPageButton':
                  window.open('https://community.ringcentral.com/groups/app-connect-22', '_blank');
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
                    await userCore.refreshUserSettings({});
                    showNotification({ level: 'success', message: 'Custom manifest file uploaded.', ttl: 5000 });
                  }
                  break;
                case 'saveServerSideLoggingButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  adminSettings.userSettings.serverSideLogging =
                  {
                    enable: data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable',
                    loggingLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging
                  };
                  userSettings = await userCore.refreshUserSettings({
                    changedSettings: {
                      serverSideLogging:
                      {
                        enable: data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable',
                        loggingLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging
                      }
                    }
                  });
                  await chrome.storage.local.set({ adminSettings });
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  if (data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable') {
                    await adminCore.enableServerSideLogging({
                      serverUrl: manifest.serverUrl,
                      platform,
                      subscriptionLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging,
                      loggingByAdmin: data.body.button.formData.activityRecordOwner === 'admin'
                    });
                  }
                  else {
                    await adminCore.disableServerSideLogging({ platform });
                    showNotification({ level: 'success', message: 'Server side logging turned OFF.', ttl: 5000 });
                  }
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-third-party-service',
                    service: (await embeddableServices.getServiceManifest())
                  }, '*');
                  const updateSSCLFieldsResponse = await adminCore.uploadServerSideLoggingAdditionalFieldValues({ platform, formData: data.body.button.formData });
                  if (updateSSCLFieldsResponse) {
                    if (updateSSCLFieldsResponse.successful) {
                      showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
                      document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                        type: 'rc-adapter-navigate-to',
                        path: 'goBack',
                      }, '*');
                    }
                    else {
                      showNotification({ level: updateSSCLFieldsResponse.returnMessage.messageType, message: updateSSCLFieldsResponse.returnMessage.message, ttl: updateSSCLFieldsResponse.returnMessage.ttl });
                    }
                  }
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'doNotLogNumbersSubmitButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  adminSettings.userSettings.serverSideLogging.doNotLogNumbers = data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? "";
                  userSettings = await userCore.refreshUserSettings({
                    changedSettings: {
                      serverSideLogging:
                      {
                        doNotLogNumbers: data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? ""
                      }
                    }
                  });
                  await chrome.storage.local.set({ adminSettings });
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-third-party-service',
                    service: (await embeddableServices.getServiceManifest())
                  }, '*');
                  await adminCore.updateServerSideDoNotLogNumbers({ platform, doNotLogNumbers: data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? "" });
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
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
                case 'adminNewSheetButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const { rcUnifiedCrmExtJwt: adminTokenForNewSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                  const adminNewSheetResponse = await axios.post(`${manifest.serverUrl}/googleSheets/sheet?jwtToken=${adminTokenForNewSheet}`,
                    {
                      name: data.body.button.formData.newSheetName
                    }
                  );
                  if (adminNewSheetResponse.status === 200) {
                    // Set admin settings for Google Sheets
                    const isManaged = data.body.button.formData.managedToggle || false;
                    adminSettings.userSettings.googleSheetsName = {
                      value: adminNewSheetResponse.data.name,
                      customizable: !isManaged
                    };
                    adminSettings.userSettings.googleSheetsUrl = {
                      value: adminNewSheetResponse.data.url,
                      customizable: !isManaged
                    };
                    await chrome.storage.local.set({ adminSettings });
                    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                    await userCore.refreshUserSettings({});
                    showNotification({ 
                      level: 'success', 
                      message: `Admin Google Sheet "${adminNewSheetResponse.data.name}" created successfully${isManaged ? ' and enforced for all users' : ''}`, 
                      ttl: 5000 
                    });
                  }
                  else {
                    showNotification({ level: 'warning', message: 'Failed to create new sheet', ttl: 5000 });
                  }
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings })
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/adminGoogleSheetsPage', // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'adminSelectExistingSheetButton':
                  const { rcUnifiedCrmExtJwt: adminTokenForExistingSheet } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
                  window.open(`${manifest.serverUrl}/googleSheets/filePicker?token=${adminTokenForExistingSheet}&admin=true`, '_blank');
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: 'goBack', // page id
                  }, '*');
                  break;
                case 'adminSheetInfoButton':
                  window.open(data.body.button.formData.sheetUrl, '_blank');
                  break;
                case 'adminRemoveSheetButton':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  // Remove admin Google Sheets settings
                  adminSettings.userSettings.googleSheetsName = {
                    value: '',
                    customizable: true
                  };
                  adminSettings.userSettings.googleSheetsUrl = {
                    value: '',
                    customizable: true
                  };
                  await chrome.storage.local.set({ adminSettings });
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  await userCore.refreshUserSettings({
                    changedSettings: {
                      googleSheetsName: {
                        value: ''
                      },
                      googleSheetsUrl: {
                        value: ''
                      }
                    }
                  });
                  showNotification({ level: 'success', message: 'Admin Google Sheet removed successfully', ttl: 3000 });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: adminGoogleSheetsPage.renderAdminGoogleSheetsPage({ manifest, adminSettings })
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: '/customized/adminGoogleSheetsPage', // page id
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'adminGoogleSheetsPage':
                  // Handle managedToggle updates from admin Google Sheets page
                  if (data.body.keys && data.body.keys.includes('managedToggle')) {
                    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                    const isManaged = data.body.formData.managedToggle || false;
                    if (adminSettings?.userSettings?.googleSheetsName) {
                      adminSettings.userSettings.googleSheetsName.customizable = !isManaged;
                    }
                    if (adminSettings?.userSettings?.googleSheetsUrl) {
                      adminSettings.userSettings.googleSheetsUrl.customizable = !isManaged;
                    }
                    await chrome.storage.local.set({ adminSettings });
                    await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                    await userCore.refreshUserSettings({});
                    showNotification({ 
                      level: 'success', 
                      message: `Google Sheets setting ${isManaged ? 'enforced for all users' : 'made customizable for users'}`, 
                      ttl: 3000 
                    });
                    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  }
                  break;
                case 'contactSearchAdapterButtonCallLog':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const contactToBeSearch = data.body.button.formData.contactNameToSearch;
                  const customContactSearchResponse = await contactSearch.getCustomContactSearchData({ serverUrl: manifest.serverUrl, platform, contactSearch: contactToBeSearch, pageId: "contactSearchResultCallLog", contactPhoneNumber: data.body.button.formData?.contactPhoneNumber });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: customContactSearchResponse
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${customContactSearchResponse.id}`,
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  // console.log({ searchedContact });
                  break;
                case 'contactSearchAdapterButtonMessageLog':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  const contactNameToBeSearch = data.body.button.formData.contactNameToSearch;
                  const customContactSearchRes = await contactSearch.getCustomContactSearchData({ serverUrl: manifest.serverUrl, platform, contactSearch: contactNameToBeSearch, pageId: "contactSearchResultMessageLog", contactPhoneNumber: data.body.button.formData?.contactPhoneNumber });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: customContactSearchRes
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${customContactSearchRes.id}`,
                  }, '*');
                  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
                  break;
                case 'refreshLicense':
                  if (platform.useLicense) {
                    await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl });
                  }
                  break;
              }
              const listButtonActionId = data.body.button.id.split('-')[0];
              const listButtonItemId = data.body.button.id.split('-')[1];
              switch (listButtonActionId) {
                case 'usermappingEdit':
                  const userMappingToEdit = data.body.button.formData.allUserMapping.find(um => um.crmUser.id == listButtonItemId);
                  const rcExtensions = await getRcContactInfo();
                  const editUserMappingPageRender = editUserMappingPage.renderEditUserMappingPage({
                    userMapping: userMappingToEdit,
                    platformDisplayName: platform.displayName,
                    rcExtensions: [...rcExtensions, { id: 'none', name: 'None' }]
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: editUserMappingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${editUserMappingPageRender.id}`, // page id
                  }, '*');
                  break;
                case 'usermappingRemove':
                  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
                  adminSettings.userMappings.find(um => um.crmUserId == listButtonItemId).rcExtensionId = 'none';
                  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
                  const updatedUserMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
                  const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping: updatedUserMapping, platformDisplayName: platform.displayName });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-register-customized-page',
                    page: userMappingPageRender
                  });
                  document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
                    type: 'rc-adapter-navigate-to',
                    path: `/customized/${userMappingPageRender.id}`, // page id
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
    if (e.response && e.response.data && e.response?.status !== 404 && !noShowNotification && typeof e.response.data === 'string') {
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
  try {
    switch (request.type) {
      case 'oauthCallBack':
        await oauthCallBackHandler.onMessage({ request, sendResponse });
        break;
      case 'pipedriveCallbackUri':
        await pipedriveCallbackUriHandler.onMessage({ request, sendResponse });
        break;
      case 'c2sms':
        await c2smsHandler.onMessage({ request, sendResponse });
        break;
      case 'c2d':
        await c2dHandler.onMessage({ request, sendResponse });
        break;
      case 'c2schedule':
        await c2scheduleHandler.onMessage({ request, sendResponse });
        break;
      case 'navigate':
        await navigateHandler.onMessage({ request, sendResponse });
        break;
      case 'insightlyAuth':
        await insightlyAuthHandler.onMessage({ request, sendResponse });
        break;
      case 'ringsenseRefTrack':
        await ringsenseRefTrackHandler.onMessage({ request, sendResponse });
        break;
      default:
        break;
    }
    sendResponse({ result: 'ok' });
  }
  catch (e) {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    console.log(e);
  }
});