import { responseMessage, isObjectEmpty } from '../../../../lib/util';
import logCore from '../../../../core/log';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

// Legacy conversation-level match: given `conversationLogIds`, report which
// conversations (daily buckets) have a saved log record.
async function matchByConversationLogIds(data: UnknownRecord): Promise<void> {
  const localMessageLogs: UnknownRecord = {};
  const savedMessageLogRecords = await chrome.storage.local.get(
    data.body.conversationLogIds.map((conversationLogId: string) => `rc-crm-conversation-log-${conversationLogId}`)
  ) as UnknownRecord;
  const messageMatchResults = data.body.conversationLogIds.map((conversationLogId: string) => {
    return { conversationLogId, savedMessageLogRecord: savedMessageLogRecords[`rc-crm-conversation-log-${conversationLogId}`] };
  });
  messageMatchResults.forEach(({ conversationLogId, savedMessageLogRecord }: UnknownRecord) => {
    if (!!savedMessageLogRecord && !isObjectEmpty(savedMessageLogRecord)) {
      localMessageLogs[conversationLogId] = [{ id: 'dummyId' }];
    }
  });
  responseMessage(data.requestId, { data: localMessageLogs });
}

// Per-message match (granular SMS logging): given a `conversationId` and a set
// of `messageIds`, ask the server which individual messages are already logged
// and to which CRM log record. The server match endpoint is the single
// source of truth; there is no local cache. The widget uses the response to
// render per-message "logged" icons that navigate straight to the CRM entry.
async function matchByMessageIds(data: UnknownRecord, manifest?: UnknownRecord): Promise<void> {
  const conversationId = data.body.conversationId;
  const messageIds: string[] = (Array.isArray(data.body.messageIds) ? data.body.messageIds : []).map((id: unknown) => String(id));

  // The widget's `matchMessagesLogState` reads `data[messageId].logId` (an
  // object per message), unlike the legacy conversationLogIds path which
  // expects an array. Respond with the per-message `{ logId }` object so the
  // widget renders the "logged" icon and can open the CRM record on click.
  const perMessageResult: UnknownRecord = {};
  if (manifest?.serverUrl) {
    try {
      const { messageLogs } = await logCore.getMessageLog({
        serverUrl: manifest.serverUrl,
        conversationId,
        messageIds,
      });
      if (messageLogs && !isObjectEmpty(messageLogs)) {
        for (const messageId of messageIds) {
          const record = (messageLogs as UnknownRecord)[messageId];
          // Server returns a flat map (messageId -> logId string); tolerate an
          // object shape ({ logId }) as well.
          const logId = (record as UnknownRecord)?.logId ?? record;
          if (logId) {
            perMessageResult[messageId] = { logId };
          }
        }
      }
    } catch (e) {
      void e; // best-effort: on failure report nothing logged
    }
  }
  responseMessage(data.requestId, { data: perMessageResult });
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  if (Array.isArray(data.body?.messageIds) && data.body?.conversationId) {
    await matchByMessageIds(data, manifest);
    return;
  }
  await matchByConversationLogIds(data);
}

export default {
  onEvent,
};
