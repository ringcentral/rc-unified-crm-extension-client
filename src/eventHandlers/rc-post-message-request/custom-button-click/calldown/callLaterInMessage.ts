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
  let number = undefined;
  if (data.body?.resource?.direction === 'Inbound') {
    number = data.body?.resource?.from?.phoneNumber;
  } else {
    number = data.body?.resource?.to?.phoneNumber || data.body?.resource?.to?.length > 0 ? data.body?.resource?.to?.[0]?.phoneNumber : undefined;
  }
  if (!number) {
    return;
  }
  // try { window.postMessage({ type: 'rc-log-modal-loading-on' }, '*'); } catch (e) { /* ignore */ }
  chrome.runtime.sendMessage({ type: 'c2schedule', phoneNumber: number });
}

export default {
  onEvent,
};
