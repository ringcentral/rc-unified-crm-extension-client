import { showNotification, responseMessage } from '../../../../lib/util';

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
  const isExtensionNumber = data.body?.resource?.direction === 'Inbound'
    ? !!data.body?.resource?.from.extensionNumber
    : !!data.body?.resource?.to.extensionNumber;
  if (isExtensionNumber) {
    showNotification({ level: 'warning', message: 'Extension numbers cannot be scheduled', ttl: 3000 });
    responseMessage(data.requestId, { data: 'ok' });
    return;
  }
  let number = undefined;
  if (data.body?.resource?.direction === 'Inbound') {
    number = data.body?.resource?.from?.phoneNumber;
  }
  else {
    number = data.body?.resource?.to?.phoneNumber;
  }
  if (!number) {
    return;
  }
  //try { window.postMessage({ type: 'rc-log-modal-loading-on' }, '*'); } catch (e) { /* ignore */ }
  chrome.runtime.sendMessage({ type: 'c2schedule', phoneNumber: number });
}

export default {
  onEvent,
};
