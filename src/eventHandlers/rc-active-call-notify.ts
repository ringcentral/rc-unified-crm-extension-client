import userCore from '../core/user';
import contactCore from '../core/contact';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import logCore from '../core/log';
import logPage from '../components/logPage';
import { logPageFormDataDefaulting, cacheLogPageData } from '../lib/logUtil';
import { responseMessage } from '../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  popupContext: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, popupContext }: EventOptions): Promise<void> {
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';
  const platform = manifest?.platforms[platformName];
  if (data.call.queueCall) {
    await chrome.storage.local.set({
      [`is-call-queue-${data.call.sessionId}`]: {
        isQueue: true,
        expiry: new Date().getTime() + 60000 * 60 * 24 * 30, // 30 days
      },
    });
  }
  const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
  let isExtensionNumber = data.call.direction === 'Inbound' ?
    ((!!data.call.from.extensionNumber && !data.call.from.phoneNumber) || (data.call.from.phoneNumber && data.call.from.phoneNumber.length <= 6)) :
    ((!!data.call.to.extensionNumber && !data.call.to.phoneNumber) || (data.call.to.phoneNumber && data.call.to.phoneNumber.length <= 6));
  const allowExtensionNumberLogging = userSettings?.allowExtensionNumberLogging?.value ?? false;
  if (allowExtensionNumberLogging) {
    isExtensionNumber = false;
  }
  const contactPhoneNumber = data.call.direction === 'Inbound' ?
    (data.call.from.phoneNumber ?? data.call.from.extensionNumber) :
    (data.call.to.phoneNumber ?? data.call.to.extensionNumber);
  const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
  void callContactMatched;
  void callLogContactMatchMessage;
  const callMatchedContact = contactInfo ?? [];
  const callLogSubject = data.call.direction === 'Inbound' ?
    `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
    `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
  const incomingCallMessagePayload = {
    callId: data.call.telephonySessionId ?? data.call.sessionId,
    telephonySessionId: data.call.telephonySessionId,
    sessionId: data.call.sessionId,
    phoneNumber: contactPhoneNumber,
    callerName: callMatchedContact[0]?.name,
  };
  switch (data.call.telephonyStatus) {
    case 'CallConnected':
      window.postMessage({ type: 'rc-expandable-call-note-open', sessionId: data.call.sessionId }, '*');
      switch (data.call.direction) {
        case 'Inbound':
          chrome.runtime.sendMessage({
            type: 'incomingCallResolved',
            ...incomingCallMessagePayload,
          });
          chrome.runtime.sendMessage({
            type: 'openPopupWindow',
          });
          if (userCore.getIncomingCallPop(userSettings).value === 'onAnswer') {
            if (popupContext.transferOnHold === data.call.telephonySessionId) {
              // eslint-disable-next-line no-param-reassign
              popupContext.transferOnHold = '';
              break;
            }
            await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.call.from.phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
          }
          break;
        case 'Outbound':
          if (userCore.getOutgoingCallPop(userSettings).value === 'onAnswer') {
            if (popupContext.transferOnHold === data.call.telephonySessionId) {
              // eslint-disable-next-line no-param-reassign
              popupContext.transferOnHold = '';
              break;
            }
            await contactCore.openContactPage({ manifest, platformName, phoneNumber: data.call.to.phoneNumber, multiContactMatchBehavior: userCore.getCallPopMultiMatchBehavior(userSettings).value, fromCallPop: true });
          }
          break;
      }
      await cacheLogPageData({
        id: data.call.sessionId,
        manifest,
        logType: 'Call',
        triggerType: 'createLog',
        platformName,
        direction: data.call.direction,
        contactInfo: callMatchedContact ?? [],
        logInfo: {
          subject: callLogSubject,
          note: '',
        },
      });
      break;
    case 'NoCall':
      if (data.call.terminationType === 'final') {
        if (data.call.direction === 'Inbound') {
          chrome.runtime.sendMessage({
            type: 'incomingCallResolved',
            ...incomingCallMessagePayload,
          });
        }
        window.postMessage({ type: 'rc-expandable-call-note-terminate' }, '*');
        const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as {
          implementedInterfaces: UnknownRecord | null;
        };
        if (implementedInterfaces?.cacheCallNote) {
          await logCore.uploadCacheNote({ serverUrl: manifest.serverUrl, sessionId: data.call.sessionId });
        }
        const callAutoPopup = userCore.getCallPopSetting(userSettings).value;
        if (callAutoPopup) {
          if (isExtensionNumber && !allowExtensionNumberLogging) {
            responseMessage(data.requestId, { data: 'ok' });
            return;
          }

          const note = await logCore.getCachedNote({ sessionId: data.call.sessionId });
          const logInfo = {
            note,
            subject: callLogSubject,
          };
          await cacheLogPageData({
            id: data.call.sessionId,
            manifest,
            logType: 'Call',
            triggerType: 'createLog',
            platformName,
            direction: data.call.direction,
            contactInfo: callMatchedContact ?? [],
            logInfo,
            loggedContactId: null,
            isUnresolved: undefined,
          });
          const useContactSearch = implementedInterfaces?.findContactWithName;
          let callPage = logPage.getLogPageRender({ id: data.call.sessionId, manifest, logType: 'Call', triggerType: 'createLog', platformName, direction: data.call.direction, contactInfo: callMatchedContact ?? [], logInfo, loggedContactId: null, contactPhoneNumber, useContactSearch });
          // default form value from user settings
          if (data.call.direction === 'Inbound') {
            callPage = await logPageFormDataDefaulting({
              platform,
              targetPage: callPage,
              caseType: 'inboundCall',
              logType: 'callLog',
            });
          }
          if (data.call.direction === 'Outbound') {
            callPage = await logPageFormDataDefaulting({
              platform,
              targetPage: callPage,
              caseType: 'outboundCall',
              logType: 'callLog',
            });
          }
          getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-update-call-log-page',
            page: callPage,
          }, '*');

          // navigate to call log page
          getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-navigate-to',
            path: `/log/call/${data.call.sessionId}`,
          }, '*');
        }

        await chrome.storage.local.set({
          [`call-log-data-ready-${data.call.sessionId}`]: {
            isReady: false,
            expiry: new Date().getTime() + 60000 * 60 * 24 * 30, // 30 days
          },
        });
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-trigger-call-logger-match',
          sessionIds: [data.call.sessionId],
        }, '*');
      }
      break;
    case 'Ringing':
      await chrome.storage.local.set({ hasOngoingCall: true });
      switch (data.call.direction) {
        case 'Inbound':
          chrome.runtime.sendMessage({
            type: 'incomingCallRinging',
            ...incomingCallMessagePayload,
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
}

export default {
  onEvent,
};
