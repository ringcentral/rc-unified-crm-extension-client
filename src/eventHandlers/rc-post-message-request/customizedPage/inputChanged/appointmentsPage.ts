import { createDebounceHandler, responseMessage } from '../../../../lib/util';
import appointmentsPage from '../../../../components/appointmentsPage/appointmentsPage';
import userCore from '../../../../core/user';

const debounceAppointmentsSearch = createDebounceHandler('appointmentsSearch', 300);

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function onEvent({ data, manifest }: UnknownRecord) {
  const keys = Array.isArray(data?.body?.keys) ? data.body.keys : [];
  const hasTabKey = keys.some(k => k === 'tab');
  const hasSearchWithFiltersKey = keys.some(k => k === 'searchWithFilters');

  // Only refresh list when user changes top filters. Clicking list rows or the "..." menu
  // can emit inputChanged with other keys (e.g. "appointments") and should be ignored.
  if (!hasTabKey && !hasSearchWithFiltersKey) {
    return;
  }

  const { userSettings } = await chrome.storage.local.get('userSettings') as { userSettings: UnknownRecord };
  if (!userCore.getShowAppointmentsTabSetting(userSettings).value) {
    return;
  }

  const tab = data?.body?.formData?.tab ?? 'upcoming';
  const searchWithFilters = data?.body?.formData?.searchWithFilters ?? {};
  const currentSearch = String(searchWithFilters?.search ?? '');
  const currentFilter = String(searchWithFilters?.filter ?? 'All');

  // Compare against last state so we can distinguish typing vs filter dropdown changes.
  const { appointmentsLastState } = await chrome.storage.local.get({
    appointmentsLastState: { tab: 'upcoming', search: '', filter: 'All' },
  }) as { appointmentsLastState: UnknownRecord };
  const lastTab = appointmentsLastState?.tab ?? 'upcoming';
  const lastSearch = appointmentsLastState?.search ?? '';
  const lastFilter = appointmentsLastState?.filter ?? 'All';

  const tabChanged = tab !== lastTab;
  const searchChanged = currentSearch !== lastSearch;
  const filterChanged = currentFilter !== lastFilter;

  // If only search changed (typing), debounce and avoid spinner (prevents characters jumping).
  if (hasSearchWithFiltersKey && searchChanged && !filterChanged && !hasTabKey && !tabChanged) {
    // Acknowledge immediately; the UI update is handled asynchronously by debounce.
    responseMessage(data.requestId, { data: 'ok' });
    debounceAppointmentsSearch(data.requestId, async () => {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      const updated = await appointmentsPage.getAppointmentsPageWithRecords({
        manifest,
        jwtToken: rcUnifiedCrmExtJwt,
        tab,
        searchWithFilters,
        forceSync: false,
        userSettings,
      });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-register-customized-page',
        page: updated,
      }, '*');

      await chrome.storage.local.set({
        appointmentsLastState: { tab, search: currentSearch, filter: currentFilter },
      });
    });
    return;
  }

  // Tab change or filter change: immediate with spinner
  const shouldShowSpinner = hasTabKey || tabChanged || filterChanged;
  if (shouldShowSpinner) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  }

  try {
    // Update state early so subsequent events detect changes correctly.
    await chrome.storage.local.set({
      appointmentsLastState: { tab, search: currentSearch, filter: currentFilter },
    });

    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab,
      searchWithFilters,
      forceSync: false,
      userSettings,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customizedTabs/${updated.id}`,
    }, '*');
    responseMessage(data.requestId, { data: 'ok' });
  } catch (e) {
    responseMessage(data.requestId, { error: e?.message ?? String(e) });
  } finally {
    if (shouldShowSpinner) {
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
  }
}

export { onEvent };
export default {
  onEvent,
};
