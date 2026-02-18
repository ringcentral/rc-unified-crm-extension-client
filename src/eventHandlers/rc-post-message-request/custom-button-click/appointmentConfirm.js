import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';
import { updateAppointmentStatus } from '../../../service/appointmentService';

async function onEvent({ data, manifest, listButtonItemId }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const appointmentId = listButtonItemId ?? data?.body?.button?.additionalInfo?.thirdPartyAppointmentId ?? '';
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    if (appointmentId) {
      await updateAppointmentStatus({ serverUrl: manifest.serverUrl, jwtToken: rcUnifiedCrmExtJwt, appointmentId, status: 'confirmed' });
    }
    const { appointmentsListState = { tab: 'upcoming', searchWithFilters: { search: '', filter: 'All' } } } = await chrome.storage.local.get('appointmentsListState');
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab: appointmentsListState.tab,
      searchWithFilters: appointmentsListState.searchWithFilters ?? {},
      forceSync: false,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

