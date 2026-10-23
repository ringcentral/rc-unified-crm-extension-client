import axios from 'axios';
import { isObjectEmpty, showNotification, getRcAccessToken, getRcCallLogIdentity } from '../lib/util';
import { trackSyncCallLog, trackSyncMessageLog } from '../lib/analytics';
import { t } from '../i18n';
import { renderUrlTemplate } from '../lib/urlTemplate';
import { resolveVoicemailRecording } from '../lib/voicemail';

type UnknownRecord = Record<string, any>;

const MESSAGE_LOG_MATCH_BATCH_SIZE = 100;
const MESSAGE_LOG_MATCH_MAX_CONCURRENCY = 3;

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

function normalizeMessageIds(messageIds: unknown): string[] {
  if (!Array.isArray(messageIds)) {
    return [];
  }
  return messageIds.map((id) => String(id).trim()).filter(Boolean);
}

function extractMessageLogs(data: UnknownRecord): UnknownRecord {
  // The server returns a flat `messageLogs` map (messageId -> CRM logId) and a
  // parallel `logs` array ([{ messageId, matched, logId }]). Prefer the map;
  // fall back to reconstructing it from the matched entries in `logs`.
  let messageLogs = data.messageLogs as UnknownRecord | undefined;
  if ((!messageLogs || isObjectEmpty(messageLogs)) && Array.isArray(data.logs)) {
    messageLogs = {};
    for (const entry of data.logs as UnknownRecord[]) {
      if (entry?.matched && entry.logId && entry.messageId !== undefined && entry.messageId !== null) {
        messageLogs[String(entry.messageId)] = entry.logId;
      }
    }
  }
  return messageLogs ?? {};
}

async function mapWithConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(maxConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

// Input {id} = sessionId from RC
export async function addLog({
  serverUrl,
  logType,
  logInfo,
  isMain,
  subject,
  note,
  aiNote,
  transcript,
  contactId,
  contactType,
  contactName,
  additionalSubmission,
  selectedMessageIds,
  activityCompletionReady,
  isShowNotification = true,
}: UnknownRecord): Promise<any> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as UnknownRecord;
  const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} }) as UnknownRecord;
  // eslint-disable-next-line no-param-reassign
  additionalSubmission = { ...additionalSubmission, ...rcAdditionalSubmission };
  const overridingPhoneNumberFormat = [];
  if (userSettings?.overridingPhoneNumberFormat?.value) {
    overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat.value);
  }
  if (userSettings?.overridingPhoneNumberFormat2?.value) {
    overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat2.value);
  }
  if (userSettings?.overridingPhoneNumberFormat3?.value) {
    overridingPhoneNumberFormat.push(userSettings.overridingPhoneNumberFormat3.value);
  }

  if (subject) {
    // eslint-disable-next-line no-param-reassign
    logInfo['customSubject'] = subject;
  }
  let addLogRes: any;
  const rcAccessToken = await getRcAccessToken();
  if (rcUnifiedCrmExtJwt) {
    switch (logType) {
      case 'Call':
        {
          const { extensionNumber, hashedExtensionId } = await getRcCallLogIdentity();
          // case: if call is recorded and recording is ready
          if (logInfo.recording) {
            // eslint-disable-next-line no-param-reassign
            logInfo.recording.downloadUrl = `${logInfo.recording.contentUri}?accessToken=${rcAccessToken}`;
          }
          else {
            // case: if call is recorded but recording isn't ready, use '(pending...)' as temporary placeholder
            const hasRecording = await chrome.storage.local.get(`rec-link-${logInfo.sessionId}`) as UnknownRecord;
            if (hasRecording[`rec-link-${logInfo.sessionId}`]) {
              // eslint-disable-next-line no-param-reassign
              logInfo.recording = hasRecording[`rec-link-${logInfo.sessionId}`];
            }
          }
          const voicemailRecording = await resolveVoicemailRecording(logInfo);
          addLogRes = await axios.post(`${serverUrl}/callLog`, { logInfo, note, aiNote, transcript, ...voicemailRecording, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName, extensionNumber, hashedExtensionId, activityCompletionReady });
          if (addLogRes.data.successful) {
            trackSyncCallLog({ hasNote: note !== '' });
            if (isShowNotification) {
              showNotification({ level: addLogRes.data.returnMessage?.messageType ?? 'success', message: addLogRes.data.returnMessage?.message ?? t('notifications.success.callLogAdded'), ttl: addLogRes.data.returnMessage?.ttl ?? 3000, details: addLogRes.data.returnMessage?.details });
            }
            await chrome.storage.local.set({
              [`rc-crm-call-log-${logInfo.sessionId}`]: {
                contact: { id: contactId },
                logId: addLogRes.data.logId,
              },
            });
          }
          else {
            if (isShowNotification) {
              showNotification({ level: addLogRes.data.returnMessage?.messageType ?? 'warning', message: addLogRes.data.returnMessage?.message ?? t('notifications.warning.callLogFailed'), ttl: addLogRes.data.returnMessage?.ttl ?? 3000, details: addLogRes.data.returnMessage?.details });
            }
          }
          // force call log matcher check
          getWidgetFrameWindow().postMessage({
            type: 'rc-adapter-trigger-call-logger-match',
            sessionIds: [logInfo.sessionId],
          }, '*');
        }
        break;
      case 'Message':
        if (logInfo.type === 'Fax' || (logInfo.type === 'SMS' && logInfo.messages.some((m: UnknownRecord) => m.attachments.some((a: UnknownRecord) => a.type === 'MmsAttachment')))) {
          // eslint-disable-next-line no-param-reassign
          logInfo.rcAccessToken = rcAccessToken;
        }
        {
          // Granular SMS logging: when the user selected specific messages,
          // forward their RingCentral ids as a top-level `selectedMessageIds`
          // array. The server keeps the full `logInfo.messages` for content and
          // composes a single CRM entry from exactly the selected ids. Absent/
          // empty selection keeps the existing daily-digest/auto behavior.
          const messageLogBody: UnknownRecord = { logInfo, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName };
          if (Array.isArray(selectedMessageIds) && selectedMessageIds.length > 0) {
            messageLogBody.selectedMessageIds = selectedMessageIds.map((id: unknown) => String(id));
          }
          addLogRes = await axios.post(`${serverUrl}/messageLog`, messageLogBody);
        }
        if (addLogRes.data.successful) {
          if ((isMain as any) & (((addLogRes.data.logIds?.length ?? 0) > 0) as any)) {
            trackSyncMessageLog();
            const messageLogPrefCache: UnknownRecord = {};
            messageLogPrefCache[`rc-crm-conversation-pref-${logInfo.conversationLogId}`] = {
              contact: {
                id: contactId,
                type: contactType,
                name: contactName,
              },
              additionalSubmission: rcAdditionalSubmission,
            };
            await chrome.storage.local.set(messageLogPrefCache);
          }
          if (addLogRes.data.logIds?.length > 0 && isShowNotification) {
            showNotification({ level: addLogRes.data.returnMessage?.messageType ?? 'success', message: addLogRes.data.returnMessage?.message ?? t('notifications.success.messageLogAdded'), ttl: addLogRes.data.returnMessage?.ttl ?? 3000, details: addLogRes.data.returnMessage?.details });
          }
          await chrome.storage.local.set({ [`rc-crm-conversation-log-${logInfo.conversationLogId}`]: { logged: true } });
        }
        // Return the log result so callers (e.g. the selected-message logging
        // flow) can report the CRM log id back to the widget. Prefer the id the
        // server assigns to this write. logIds[0] can be an older CRM entry
        // when the response map includes previously logged messages.
        const responseMessageLogs = addLogRes?.data?.messageLogs;
        const selectedLogId = Array.isArray(selectedMessageIds)
          ? selectedMessageIds.map((id: unknown) => responseMessageLogs?.[String(id)]).find(Boolean)
          : undefined;
        return {
          successful: !!addLogRes?.data?.successful,
          logId: addLogRes?.data?.logId ?? selectedLogId,
          logIds: addLogRes?.data?.logIds,
          messageLogs: responseMessageLogs,
        };
    }
  }
  else {
    showNotification({ level: 'warning', message: t('notifications.warning.connectToCrm'), ttl: 3000 });
  }
}

export async function getLog({ serverUrl, logType, sessionIds, requireDetails }: UnknownRecord): Promise<any> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  if (rcUnifiedCrmExtJwt) {
    switch (logType) {
      case 'Call':
        {
          const { extensionNumber, hashedExtensionId } = await getRcCallLogIdentity();
          // check if axios default has jwtToken in bearer, if not, add it
          const commonHeaders = axios.defaults.headers.common as UnknownRecord;
          if (!commonHeaders.Authorization?.startsWith('Bearer ')) {
            commonHeaders.Authorization = `Bearer ${rcUnifiedCrmExtJwt}`;
          }
          const query = new URLSearchParams({
            sessionIds,
            requireDetails: requireDetails ? 'true' : 'false',
            extensionNumber,
            hashedExtensionId,
          });
          const callLogRes = await axios.get(`${serverUrl}/callLog?${query.toString()}`);
          showNotification({ level: callLogRes.data.returnMessage?.messageType, message: callLogRes.data.returnMessage?.message, ttl: callLogRes.data.returnMessage?.ttl, details: callLogRes.data.returnMessage?.details });
          return { successful: callLogRes.data.successful, callLogs: callLogRes.data.logs };
        }
    }
  }
  else {
    return { successful: false, message: t('notifications.warning.connectToCrm') };
  }
}

// Fetch which individual messages in a conversation are already logged, and to
// which CRM log record. Used to hydrate the per-message "logged" state (icons)
// when a thread loads. Returns a map of messageId -> { logId } (plus any extra
// fields the server includes). Degrades to an empty map without CRM auth.
export async function getMessageLog({ serverUrl, conversationId, messageIds }: UnknownRecord): Promise<any> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  if (!rcUnifiedCrmExtJwt) {
    return { successful: false, messageLogs: {} };
  }

  const ids = normalizeMessageIds(messageIds);
  const batches = ids.length > 0
    ? Array.from({ length: Math.ceil(ids.length / MESSAGE_LOG_MATCH_BATCH_SIZE) }, (_, index) => (
      ids.slice(index * MESSAGE_LOG_MATCH_BATCH_SIZE, (index + 1) * MESSAGE_LOG_MATCH_BATCH_SIZE)
    ))
    : [[]];

  // A failed batch must not discard the logged state already returned by the
  // other batches, so each batch settles independently.
  const responses = await mapWithConcurrency(batches, MESSAGE_LOG_MATCH_MAX_CONCURRENCY, async (batch) => {
    const body: UnknownRecord = { conversationId: String(conversationId ?? '') };
    if (batch.length > 0) {
      body.messageIds = batch;
    }
    try {
      return (await axios.post(`${serverUrl}/messageLog/match`, body)).data as UnknownRecord;
    }
    catch (error) {
      console.debug('Message log match batch failed', error);
      return null;
    }
  });

  return responses.reduce((result, data) => ({
    successful: result.successful && data !== null && data?.successful !== false,
    messageLogs: {
      ...result.messageLogs,
      ...(data ? extractMessageLogs(data) : {}),
    },
  }), { successful: true, messageLogs: {} as UnknownRecord });
}

export async function resolveMessageLogContactId({
  serverUrl,
  logId,
  conversationId,
  messageId,
}: UnknownRecord): Promise<string | number | undefined> {
  if (messageId == null || conversationId == null) {
    return undefined;
  }
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  if (!rcUnifiedCrmExtJwt) {
    return undefined;
  }
  let response: UnknownRecord;
  try {
    response = await axios.post(`${serverUrl}/messageLog/match`, {
      conversationId: String(conversationId),
      messageIds: [String(messageId)],
    });
  }
  catch (error) {
    console.debug('Message log contact lookup failed', error);
    return undefined;
  }
  const match = (Array.isArray(response.data?.logs) ? response.data.logs : []).find(
    (entry: UnknownRecord) =>
      entry?.matched
      && String(entry.messageId) === String(messageId)
      && String(entry.logId) === String(logId),
  );
  return match?.contactId;
}

// Opens the CRM record behind a message's "logged" icon. CRMs whose log page
// URL is keyed by contact (e.g. Clio) cannot be opened without the contact id,
// so report that instead of opening a broken `.../contacts/undefined` URL.
export async function openMessageLog({
  manifest,
  platformName,
  hostname,
  logId,
  conversationId,
  messageId,
  userSettings,
}: UnknownRecord): Promise<boolean> {
  const contactId = await resolveMessageLogContactId({
    serverUrl: manifest.serverUrl,
    logId,
    conversationId,
    messageId,
  });
  const template = manifest.platforms?.[platformName]?.logPageUrl;
  if (contactId == null && typeof template === 'string' && template.includes('{contactId}')) {
    showNotification({ level: 'warning', message: 'Could not open the logged record. Please try again later.', ttl: 3000 });
    return false;
  }
  openLog({
    manifest,
    platformName,
    hostname,
    logId,
    contactId,
    userSettings,
  });
  return true;
}

export function openLog({ manifest, platformName, hostname, logId, contactType, contactId, userSettings }: UnknownRecord): void {
  const logPageUrl = renderUrlTemplate({
    template: manifest.platforms[platformName].logPageUrl,
    values: {
      hostname,
      logId,
      contactId,
      contactType,
    },
    userSettings,
  }).url as string;
  window.open(logPageUrl);
}

export async function updateLog({ serverUrl, logType, telephonySessionId, sessionId, recordingLink, recordingDownloadLink, voicemailLink, voicemailMessageId, call, subject, note, startTime, duration, aiNote, transcript, result, direction, from, to, activityCompletionReady, isShowNotification }: UnknownRecord): Promise<void> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} }) as UnknownRecord;
  void rcAdditionalSubmission;
  if (rcUnifiedCrmExtJwt) {
    switch (logType) {
      case 'Call':
        {
          const { extensionNumber, hashedExtensionId } = await getRcCallLogIdentity();
          const voicemailRecording = voicemailLink || !call
            ? { voicemailLink, voicemailMessageId }
            : await resolveVoicemailRecording(call);
          const patchBody = {
            telephonySessionId,
            sessionId,
            recordingLink,
            recordingDownloadLink,
            voicemailLink: voicemailRecording.voicemailLink,
            voicemailMessageId: voicemailRecording.voicemailMessageId,
            subject,
            note,
            startTime,
            duration,
            aiNote,
            transcript,
            result,
            direction,
            from,
            to,
            extensionNumber,
            hashedExtensionId,
            activityCompletionReady,
          };
          const callLogRes = await axios.patch(`${serverUrl}/callLog`, patchBody);
          if (isShowNotification) {
            showNotification({ level: callLogRes.data.returnMessage?.messageType ?? 'warning', message: callLogRes.data.returnMessage?.message ?? t('notifications.warning.callLogUpdateFailed'), ttl: callLogRes.data.returnMessage?.ttl ?? 3000, details: callLogRes.data.returnMessage?.details });
          }
        }
    }
  }
}

export async function cacheCallNote({ sessionId, note }: UnknownRecord): Promise<void> {
  const noteToCache: UnknownRecord = {};
  noteToCache[sessionId] = note;
  await chrome.storage.local.set(noteToCache);
}

export async function getCachedNote({ sessionId }: UnknownRecord): Promise<any> {
  const cachedNote = await chrome.storage.local.get(sessionId) as UnknownRecord;
  if (isObjectEmpty(cachedNote)) {
    return '';
  }
  else {
    return cachedNote[sessionId];
  }
}

export async function uploadCacheNote({ serverUrl, sessionId }: UnknownRecord): Promise<void> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  const cachedNote = await chrome.storage.local.get(sessionId) as UnknownRecord;
  if (rcUnifiedCrmExtJwt && cachedNote[sessionId]) {
    const postBody = {
      sessionId,
      note: cachedNote[sessionId],
    };
    const postRes = await axios.post(`${serverUrl}/callLog/cacheNote`, postBody);
    void postRes;
  }
}

export function getConflictContentFromUnresolvedLog(log: UnknownRecord): UnknownRecord {
  const isMultipleContact = log.contactInfo?.filter((c: UnknownRecord) => !c.isNewContact)?.length > 1;
  const isNoContact = log.contactInfo?.filter((c: UnknownRecord) => !c.isNewContact)?.length === 0 && log.contactInfo?.some((c: UnknownRecord) => c.isNewContact);
  const contactName = isMultipleContact ? t('conflicts.multipleContacts') : log.contactInfo.find((c: UnknownRecord) => !c.isNewContact)?.name;
  if (isMultipleContact || isNoContact) {
    return {
      title: contactName ? `${contactName} ${log?.phoneNumber ? `(${log?.phoneNumber})` : ''}` : log?.phoneNumber,
      description: isNoContact ? t('conflicts.noMatchedContact') : t('conflicts.multipleMatchedContacts'),
    };
  }
  else {
    const multiplAssociations = [];
    const targetContact = log.contactInfo.find((c: UnknownRecord) => !c.isNewContact);
    for (const association of Object.keys(targetContact.additionalInfo)) {
      if (Array.isArray(targetContact.additionalInfo[association]) || targetContact.additionalInfo[association].length > 1) {
        const associationPascalCaseWithSpace = association
          // insert a space before all caps
          .replace(/([A-Z])/g, ' $1')
          // uppercase the first character
          .replace(/^./, function (str) { return str.toUpperCase(); });
        multiplAssociations.push(associationPascalCaseWithSpace);
      }
    }
    return {
      title: `${contactName} ${log?.phoneNumber ? `(${log?.phoneNumber})` : ''}`,
      description: t('conflicts.multipleAssociations', { associations: multiplAssociations.toString() }),
      type: log.type,
    };
  }
}

const logCore = {
  addLog,
  getLog,
  getMessageLog,
  resolveMessageLogContactId,
  openLog,
  openMessageLog,
  updateLog,
  cacheCallNote,
  getCachedNote,
  uploadCacheNote,
  getConflictContentFromUnresolvedLog,
};

export default logCore;
