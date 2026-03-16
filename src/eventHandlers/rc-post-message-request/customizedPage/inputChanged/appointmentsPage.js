import { createDebounceHandler, responseMessage } from '../../../../lib/util';
import appointmentsPage from '../../../../components/appointmentsPage/appointmentsPage';

const debounceAppointmentsSearch = createDebounceHandler('appointmentsSearch', 300);

async function onEvent({ data, manifest }) {
  const keys = data?.body?.keys ?? [];
  const isTabChange = Array.isArray(keys) && keys.some(k => k === 'tab');
  const isSearchChange = Array.isArray(keys) && keys.some(k => k === 'searchWithFilters');

  try {
    // Only refresh list when user changes top filters. Clicking list rows or the "..." menu
    // can emit inputChanged with other keys (e.g. "appointments") and should be ignored.
    if (!isTabChange && !isSearchChange) {
      return;
    }

    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const tab = data?.body?.formData?.tab ?? 'upcoming';
    const searchWithFilters = data?.body?.formData?.searchWithFilters ?? {};

    // Search typing: debounce and avoid spinner (prevents characters jumping).
    if (isSearchChange && !isTabChange) {
      debounceAppointmentsSearch(data.requestId, async (requestId) => {
        const updated = await appointmentsPage.getAppointmentsPageWithRecords({
          manifest,
          jwtToken: rcUnifiedCrmExtJwt,
          tab,
          searchWithFilters,
          forceSync: false,
        });
        document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
          type: 'rc-adapter-register-customized-page',
          page: updated,
        }, '*');
        responseMessage(requestId, { data: 'ok' });
      });
      return;
    }

    // Tab change or filter change: immediate with spinner
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab,
      searchWithFilters,
      forceSync: false,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customizedTabs/${updated.id}`,
    }, '*');
  } finally {
    if (isTabChange || isSearchChange) {
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
    responseMessage(data.requestId, { data: 'ok' });
  }
}

exports.onEvent = onEvent;

