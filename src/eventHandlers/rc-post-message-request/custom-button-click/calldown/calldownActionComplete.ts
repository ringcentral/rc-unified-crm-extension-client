import axios from 'axios';
import calldownPage from '../../../../components/calldownPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
  listButtonItemId?: unknown;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings?: UnknownRecord };
  const btn = data.body.button || {};
  const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
  const rcUserInfo = (await chrome.storage.local.get('rcUserInfo') as { rcUserInfo?: UnknownRecord }).rcUserInfo;
  const rcAccountId = rcUserInfo?.rcAccountId ?? '';
  await axios.patch(`${manifest.serverUrl}/calldown/${rowId}${rcAccountId ? `?rcAccountId=${rcAccountId}` : ''}`, { status: 'called', lastCallAt: new Date().toISOString() });
  const refreshed = await calldownPage.getCalldownPageWithRecords({
    manifest,
    searchWithFilters: data.body?.button?.formData?.searchWithFilters,
    filterStatus: data.body?.button?.formData?.searchWithFilters?.filter || 'All',
    userSettings,
  });
  getWidgetFrameWindow().postMessage({ type: 'rc-adapter-register-customized-page', page: refreshed }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
