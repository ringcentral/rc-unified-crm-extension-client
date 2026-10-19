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
  const btn = data.body.button || {};
  const { calldownListCache } = await chrome.storage.local.get({ calldownListCache: [] }) as { calldownListCache?: UnknownRecord[] };
  const rowId = (btn.formData && (btn.formData.recordId || btn.formData.records)) || listButtonItemId || btn?.additionalInfo?.recordId || btn?.listItem?.const || btn?.value || '';
  const item = (calldownListCache || []).find(i => i.id === rowId) || { phoneNumber: btn?.additionalInfo?.phoneNumber };
  if (item?.phoneNumber) {
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-new-call',
      phoneNumber: item.phoneNumber,
      toCall: true,
    }, '*');
    // Mark this calldown item as called
    const rcUserInfo = (await chrome.storage.local.get('rcUserInfo') as { rcUserInfo?: UnknownRecord }).rcUserInfo;
    const rcAccountId = rcUserInfo?.rcAccountId ?? '';
    await axios.patch(`${manifest.serverUrl}/calldown/${rowId}${rcAccountId ? `?rcAccountId=${rcAccountId}` : ''}`,
      { status: 'called', lastCallAt: new Date().toISOString() });
    // Refresh Call Back list and pill (preserve current filter)
    // Get current filter from form data to preserve user's view
    const currentFilter = data.body?.page?.formData?.searchWithFilters?.filter ||
      data.body?.formData?.searchWithFilters?.filter ||
      data.body?.formData?.filterStatus || 'All';
    const currentSearch = data.body?.page?.formData?.searchWithFilters?.search ||
      data.body?.formData?.searchWithFilters?.search || '';

    const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings?: UnknownRecord };
    const refreshed = await calldownPage.getCalldownPageWithRecords({
      manifest,
      filterStatus: currentFilter,
      searchWithFilters: {
        search: currentSearch,
        filter: currentFilter,
      },
      userSettings,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: refreshed,
    }, '*');
  }
}

export default {
  onEvent,
};
