type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
  listButtonItemId?: unknown;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  const btn = data.body.button || {};
  const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] }) as { calldownListCache?: UnknownRecord[] };
  const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
  const item = (calldownListCache || []).find(i => i.id === rowId || String(i.contactId) === String(rowId)) || { phoneNumber: btn?.additionalInfo?.phoneNumber };

  if (item?.phoneNumber) {
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-new-sms',
      phoneNumber: item.phoneNumber,
      conversation: true,
    }, '*');
  }
}

export default {
  onEvent,
};
