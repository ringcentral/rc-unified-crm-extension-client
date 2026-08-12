import userCore from '../core/user';
import logCore from '../core/log';
import dispositionCore from '../core/disposition';
import contactCore from '../core/contact';
import { showNotification, isObjectEmpty, getRcAccessToken } from '../lib/util';
import logUtil from '../lib/logUtil';
import { resolveVoicemailRecording } from '../lib/voicemail';

type UnknownRecord = Record<string, unknown>;

interface ManifestLike {
  serverUrl: string;
  [key: string]: unknown;
}

interface RetroAutoCallLogOptions {
  manifest: ManifestLike;
  platformName: string;
  platform: UnknownRecord;
}

interface PhoneParty {
  phoneNumber: string;
  [key: string]: unknown;
}

interface UnloggedCall extends UnknownRecord {
  sessionId: string;
  direction: string;
  from: PhoneParty;
  to: PhoneParty;
  aiNote?: unknown;
  transcript?: unknown;
  message?: LinkedMessage;
  legs?: Array<{ message?: LinkedMessage }>;
}

interface LinkedMessage {
  id?: string | number;
  type?: string;
  uri?: string;
}

interface UnloggedCallsResponse {
  calls: UnloggedCall[];
  hasMore: boolean;
}

interface SyncCallDataOptions {
  serverUrl: string;
  dataBody: {
    call: UnloggedCall & {
      telephonySessionId?: string;
      recording?: {
        link?: string;
        contentUri?: string;
      };
      startTime?: unknown;
      duration?: unknown;
      result?: unknown;
    };
    aiNote?: unknown;
    transcript?: unknown;
  };
}

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function retroAutoCallLog({
  manifest,
  platformName,
  platform,
}: RetroAutoCallLogOptions): Promise<void> {
  const { isAdmin } = await chrome.storage.local.get({ isAdmin: false }) as { isAdmin: boolean };
  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as { userSettings: UnknownRecord };
  const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} }) as { rcAdditionalSubmission: UnknownRecord };
  if (!userCore.getEnableRetroCallLogSync(userSettings).value) {
    return;
  }
  let retroLoggedCount = 0;
  const effectiveTotal = 10;
  let effectiveCount = 0;
  const itemsPerPage = 50;
  const pageNumber = 1;
  const { calls } = await RCAdapter.getUnloggedCalls(itemsPerPage, pageNumber) as UnloggedCallsResponse;
  const isAutoLog = userCore.getAutoLogCallSetting(userSettings, isAdmin).value;
  if (!isAutoLog || calls.length === 0) {
    return;
  }
  for (const c of calls) {
    if (effectiveCount >= effectiveTotal) {
      break;
    }
    const contactPhoneNumber = c.direction === 'Inbound' ? c.from.phoneNumber : c.to.phoneNumber;
    const { matched: callContactMatched, returnMessage: callLogContactMatchMessage, contactInfo: callMatchedContact } = await contactCore.getContact({ serverUrl: manifest.serverUrl, phoneNumber: contactPhoneNumber, platformName });
    void callLogContactMatchMessage;
    if (!callContactMatched) {
      continue;
    }
    const { hasConflict, autoSelectAdditionalSubmission } = await logUtil.getLogConflictInfo({
      platform,
      isAutoLog,
      contactInfo: callMatchedContact,
      logType: 'callLog',
      direction: c.direction,
      isVoicemail: false,
    });
    if (!hasConflict) {
      const callLogSubject = c.direction === 'Inbound' ?
        `Inbound Call from ${callMatchedContact[0]?.name ?? ''}` :
        `Outbound Call to ${callMatchedContact[0]?.name ?? ''}`;
      const note = await logCore.getCachedNote({ sessionId: c.sessionId });
      const exsitingLog = await logCore.getLog({
        serverUrl: manifest.serverUrl,
        logType: 'Call',
        sessionIds: c.sessionId,
        requireDetails: false,
      });
      if (!!exsitingLog?.callLogs[0] && !exsitingLog.callLogs[0].matched) {
        await logCore.addLog(
          {
            serverUrl: manifest.serverUrl,
            logType: 'Call',
            logInfo: c,
            isMain: true,
            note,
            aiNote: c.aiNote,
            transcript: c.transcript,
            subject: callLogSubject,
            additionalSubmission: autoSelectAdditionalSubmission,
            contactId: callMatchedContact[0]?.id,
            contactType: callMatchedContact[0]?.type,
            contactName: callMatchedContact[0]?.name,
            isShowNotification: false,
          });
        const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as {
          implementedInterfaces: { upsertCallDisposition?: boolean } | null;
        };
        const supportDisposition = implementedInterfaces?.upsertCallDisposition;
        if (supportDisposition && !isObjectEmpty(autoSelectAdditionalSubmission) && !userCore.getOneTimeLogSetting(userSettings).value) {
          await dispositionCore.upsertDisposition({
            serverUrl: manifest.serverUrl,
            logType: 'Call',
            sessionId: c.sessionId,
            dispositions: { ...autoSelectAdditionalSubmission, note },
            rcAdditionalSubmission,
          });
        }
        retroLoggedCount++;
        effectiveCount++;
      }
      else {
        // force call log matcher check
        getWidgetFrameWindow().postMessage({
          type: 'rc-adapter-trigger-call-logger-match',
          sessionIds: [exsitingLog.callLogs[0].sessionId],
        }, '*');
      }
    }
  }
  if (retroLoggedCount > 0) {
    showNotification({ level: 'success', message: `Historical call syncing finished. ${retroLoggedCount} call(s) synced.`, ttl: 5000 });
  }
}

export async function forceCallLogMatcherCheck(): Promise<void> {
  const { crmAuthed } = await chrome.storage.local.get({ crmAuthed: false }) as { crmAuthed: boolean };
  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as { userSettings: { serverSideLogging?: { enable?: boolean } } };
  if (!!userSettings?.serverSideLogging?.enable && crmAuthed) {
    // To help with performance, we only check the first 10 calls
    const { calls, hasMore } = await RCAdapter.getUnloggedCalls(10, 1) as UnloggedCallsResponse;
    void hasMore;
    const sessionIds = calls.map(c => c.sessionId);
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-trigger-call-logger-match',
      sessionIds: sessionIds,
    }, '*');
  }
}

export async function syncCallData({
  serverUrl,
  dataBody,
}: SyncCallDataOptions): Promise<void> {
  const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} }) as { rcAdditionalSubmission: UnknownRecord };
  const rcAccessToken = getRcAccessToken();
  const recordingLink = dataBody?.call?.recording?.link;
  const voicemailRecording = await resolveVoicemailRecording(dataBody.call);

  // Get the cached note for this call
  const note = await logCore.getCachedNote({ sessionId: dataBody.call.sessionId });

  // case: with recording link ready, definitely recorded, update with link
  if (recordingLink) {
    console.log('call recording updating...');
    await logCore.updateLog(
      {
        serverUrl,
        logType: 'Call',
        rcAdditionalSubmission,
        telephonySessionId: dataBody.call.telephonySessionId,
        sessionId: dataBody.call.sessionId,
        recordingLink: dataBody.call.recording.link,
        recordingDownloadLink: `${dataBody.call.recording.contentUri}?accessToken=${rcAccessToken}`,
        ...voicemailRecording,
        note,
        aiNote: dataBody.aiNote,
        transcript: dataBody.transcript,
        startTime: dataBody.call.startTime,
        duration: dataBody.call.duration,
        result: dataBody.call.result,
        direction: dataBody.call.direction,
        from: dataBody.call.from,
        to: dataBody.call.to,
      });
  }
  // case: no recording link
  else {
    await logCore.updateLog(
      {
        serverUrl,
        logType: 'Call',
        rcAdditionalSubmission,
        sessionId: dataBody.call.sessionId,
        ...voicemailRecording,
        note,
        aiNote: dataBody.aiNote,
        transcript: dataBody.transcript,
        startTime: dataBody.call.startTime,
        duration: dataBody.call.duration,
        result: dataBody.call.result,
        direction: dataBody.call.direction,
        from: dataBody.call.from,
        to: dataBody.call.to,
      });
  }
}

const logService = {
  retroAutoCallLog,
  forceCallLogMatcherCheck,
  syncCallData,
};

export default logService;
