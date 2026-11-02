import userCore from '../core/user';
import contactCore from '../core/contact';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import logCore from '../core/log';
import logPage from '../components/logPage';
import { logPageFormDataDefaulting, cacheLogPageData } from '../lib/logUtil';
import { responseMessage } from '../lib/util';
import { resolveCallLogReadiness } from '../lib/callLogReadiness';
import { forgetContactWidgets, rememberContactWidgets, shouldProbeContactWidget } from '../lib/contactWidget';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  popupContext: UnknownRecord;
};

// Calls whose contact widget has already been picked up. Later events of the same call reuse it.
const contactWidgetResolvedSessions = new Set<string>();

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
  let { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo, isFromLocalCache } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber });
  // Contact widget: picked up from the first event of the call whose matched contacts carry one, so a lookup
  // that misses early (not matched yet) is retried on later events. A widget from the local matched-contact
  // cache can be days old, and a cached entry may predate widget support, so cached results are refreshed
  // from the server (bypassing the server-side account cache too) once per call (without a widget, at most once a day per platform).
  if (!contactWidgetResolvedSessions.has(data.call.sessionId)) {
    const hasWidget = (list?: UnknownRecord[] | null) => !!list?.some(c => c.widget);
    console.log('[contact widget] check', { phoneNumber: contactPhoneNumber, contacts: contactInfo?.length ?? 0, withWidget: contactInfo?.filter((c: UnknownRecord) => c.widget).length ?? 0, isFromLocalCache: !!isFromLocalCache });
    if (isFromLocalCache && (hasWidget(contactInfo) || await shouldProbeContactWidget({ platformName, contacts: contactInfo }))) {
      contactWidgetResolvedSessions.add(data.call.sessionId);
      const refreshed = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName, isExtensionNumber, isForceRefresh: true, isForceRefreshAccountData: true });
      if (refreshed.contactInfo?.length) {
        ({ matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo } = refreshed);
      }
    }
    if (hasWidget(contactInfo)) {
      contactWidgetResolvedSessions.add(data.call.sessionId);
      console.log(`contact widget found for ${contactPhoneNumber}`);
      rememberContactWidgets({ phoneNumber: contactPhoneNumber, contacts: contactInfo, platformName });
    }
  }
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
      // RingCX calls have their own notes on the disposition page, so skip the quick note button
      if (data.call.source !== 'ringcx') {
        window.postMessage({ type: 'rc-expandable-call-note-open', sessionId: data.call.sessionId }, '*');
      }
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
        source: data.call.source,
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
        forgetContactWidgets(contactPhoneNumber);
        contactWidgetResolvedSessions.delete(data.call.sessionId);
        const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as {
          implementedInterfaces: UnknownRecord | null;
        };
        if (implementedInterfaces?.cacheCallNote) {
          await logCore.uploadCacheNote({ serverUrl: manifest.serverUrl, sessionId: data.call.sessionId });
        }
        // Auto popup only applies to EX calls, not RingCX
        const callAutoPopup = userCore.getCallPopSetting(userSettings).value && data.call.source !== 'ringcx';
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
            source: data.call.source,
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
            path: `/log/call/${data.call.sessionId}?source=${data.call.source}`,
          }, '*');
        }

        const readinessKey = `call-log-data-ready-${data.call.sessionId}`;
        const existingReadiness = await chrome.storage.local.get(readinessKey) as UnknownRecord;
        const readiness = resolveCallLogReadiness({
          call: data.call,
          previousState: existingReadiness[readinessKey],
          explicitlyFinal: false,
          existingAutoDataReady: false,
        });
        await chrome.storage.local.set({ [readinessKey]: readiness });
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
