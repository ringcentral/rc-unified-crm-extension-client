import { responseMessage, isObjectEmpty } from '../../../../lib/util';

async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
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
}

exports.onEvent = onEvent;