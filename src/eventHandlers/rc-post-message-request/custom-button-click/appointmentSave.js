import { showNotification } from '../../../lib/util';
import appointmentEditPage from '../../../components/appointmentsPage/appointmentEditPage';
import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';

async function onEvent({ data, manifest }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const saved = await appointmentEditPage.saveAppointmentEdits({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      formData: data.body.button.formData,
    });
    if (!saved) {
      showNotification({ level: 'error', message: 'Failed to save appointment.', ttl: 3000 });
      return;
    }
    showNotification({ level: 'success', message: 'Appointment updated.', ttl: 3000 });

    // After save, refresh list and go back to tab
    const returnTab = data?.body?.button?.formData?.returnTab ?? 'upcoming';
    const returnSearch = data?.body?.button?.formData?.returnSearch ?? '';
    const returnFilter = data?.body?.button?.formData?.returnFilter ?? 'All';
    const updatedList = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab: returnTab,
      searchWithFilters: { search: returnSearch, filter: returnFilter },
      forceSync: false,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updatedList,
    }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customizedTabs/${updatedList.id}`,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

