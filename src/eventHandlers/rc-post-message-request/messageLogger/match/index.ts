import { responseMessage, isObjectEmpty } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
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
  responseMessage(
    data.requestId,
    {
      data: localMessageLogs,
    }
  );
}

export default {
  onEvent,
};
