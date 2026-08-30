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
// record in a new tab. The widget sends the `logId` it received from the
// per-message match; optional contact fields are used by URL templates that
// need them.
export async function onEvent({ data, manifest, platformInfo, platformName }: EventOptions): Promise<void> {
  const { userSettings } = await chrome.storage.local.get({ userSettings: {} }) as UnknownRecord;
  const logId = data.body?.logId;
  if (logId) {
    logCore.openLog({
      manifest,
      platformName,
      hostname: platformInfo?.hostname,
      logId,
      contactId: data.body?.contactId,
      contactType: data.body?.contactType,
      userSettings,
    });
  }
  responseMessage(data.requestId, { data: 'ok' });
}

export default {
  onEvent,
};
