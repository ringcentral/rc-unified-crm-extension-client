import logCore from '../../../../core/log';
import { responseMessage } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
};

// Handle a click on a message's "logged" icon: open the corresponding CRM log
// record in a new tab. The widget sends log/message identity but no contact
// data; contactId is resolved from the server's message-log database.
export async function onEvent({ data, manifest, platformInfo, platformName }: EventOptions): Promise<void> {
  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as UnknownRecord;
  const logId = data.body?.logId;
  if (logId) {
    const contactId = await logCore.resolveMessageLogContactId({
      serverUrl: manifest.serverUrl,
      logId,
      conversationId: data.body?.conversationId,
      messageId: data.body?.messageId,
    });
    logCore.openLog({
      manifest,
      platformName,
      hostname: platformInfo?.hostname,
      logId,
      contactId,
      userSettings,
    });
  }
  responseMessage(data.requestId, { data: 'ok' });
}

export default {
  onEvent,
};
