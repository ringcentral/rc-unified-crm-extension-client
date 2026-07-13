import logCore from '../../../../../core/log';
import logPage from '../../../../../components/logPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const callLogNote = await logCore.getCachedNote({ sessionId: data.body.formData.record.sessionId });
  // bring out call log page
  const callLogDataId = data.body.formData.record;
  const { unloggedCallPageDataCache } = await chrome.storage.local.get({ unloggedCallPageDataCache: null }) as { unloggedCallPageDataCache?: UnknownRecord[] | null };
  const callLogData = unloggedCallPageDataCache!.find(c => c.sessionId === callLogDataId)!;
  const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as { implementedInterfaces?: UnknownRecord | null };
  const useContactSearch = implementedInterfaces?.findContactWithName;
  const callLogPageRender = logPage.getLogPageRender({
    id: callLogData.sessionId,
    manifest,
    logType: 'Call',
    contactInfo: callLogData.contactInfo,
    triggerType: 'createLog',
    platformName,
    direction: callLogData.direction,
    logInfo: {
      note: callLogNote,
    },
    contactPhoneNumber: callLogData.phoneNumber,
    useContactSearch,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-update-call-log-page',
    page: callLogPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/log/call/${callLogData.sessionId}`,
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
