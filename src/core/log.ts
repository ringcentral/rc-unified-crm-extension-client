import axios from 'axios';
import { isObjectEmpty, showNotification, getRcAccessToken, getRcCallLogIdentity } from '../lib/util';
import { trackSyncCallLog, trackSyncMessageLog } from '../lib/analytics';
import { t } from '../i18n';
import { renderUrlTemplate } from '../lib/urlTemplate';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
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
  const rcAccessToken = getRcAccessToken();
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
          addLogRes = await axios.post(`${serverUrl}/callLog`, { logInfo, note, aiNote, transcript, additionalSubmission, overridingFormat: overridingPhoneNumberFormat, contactId, contactType, contactName, extensionNumber, hashedExtensionId });
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
          if ((isMain as any) & ((addLogRes.data.logIds.length > 0) as any)) {
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
        // flow) can report the CRM log id back to the widget.
        return {
          successful: !!addLogRes?.data?.successful,
          logId: addLogRes?.data?.logIds?.[0],
          logIds: addLogRes?.data?.logIds,
          messageLogs: addLogRes?.data?.messageLogs,
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
  const query = new URLSearchParams({ conversationId: String(conversationId ?? '') });
  if (Array.isArray(messageIds) && messageIds.length > 0) {
    query.set('messageIds', messageIds.join(','));
  }
  const res = await axios.get(`${serverUrl}/messageLog?${query.toString()}`);
  // The server returns a flat `messageLogs` map (messageId -> CRM logId) and a
  // parallel `logs` array ([{ messageId, matched, logId }]). Prefer the map;
  // fall back to reconstructing it from the matched entries in `logs`.
  let messageLogs = res.data.messageLogs as UnknownRecord | undefined;
  if ((!messageLogs || isObjectEmpty(messageLogs)) && Array.isArray(res.data.logs)) {
    messageLogs = {};
    for (const entry of res.data.logs as UnknownRecord[]) {
      if (entry?.matched && entry.logId && entry.messageId !== undefined && entry.messageId !== null) {
        messageLogs[String(entry.messageId)] = entry.logId;
      }
    }
  }
  return { successful: res.data.successful, messageLogs: messageLogs ?? {} };
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

export async function updateLog({ serverUrl, logType, telephonySessionId, sessionId, recordingLink, recordingDownloadLink, subject, note, startTime, duration, aiNote, transcript, result, direction, from, to, isShowNotification }: UnknownRecord): Promise<void> {
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as UnknownRecord;
  const { rcAdditionalSubmission } = await chrome.storage.local.get({ rcAdditionalSubmission: {} }) as UnknownRecord;
  void rcAdditionalSubmission;
  if (rcUnifiedCrmExtJwt) {
    switch (logType) {
      case 'Call':
        {
          const { extensionNumber, hashedExtensionId } = await getRcCallLogIdentity();
          const patchBody = {
            telephonySessionId,
            sessionId,
            recordingLink,
            recordingDownloadLink,
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
  openLog,
  updateLog,
  cacheCallNote,
  getCachedNote,
  uploadCacheNote,
  getConflictContentFromUnresolvedLog,
};

export default logCore;
