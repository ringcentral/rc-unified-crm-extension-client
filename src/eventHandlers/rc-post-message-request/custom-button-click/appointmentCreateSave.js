import { showNotification } from '../../../lib/util';
import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';
import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';

async function onEvent({ data, manifest }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const created = await appointmentCreatePage.submitAppointmentCreate({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      formData: data.body.button.formData,
    });
    if (!created?.successful) {

      showNotification({ level: created?.returnMessage?.messageType, message: created?.returnMessage?.message, ttl: created?.returnMessage?.ttl ?? 3000, details: created?.returnMessage?.details });
      return;
    }
    showNotification({ level: 'success', message: 'Appointment created.', ttl: 3000 });

    // Return to list
    const returnTab = data?.body?.button?.formData?.returnTab ?? 'upcoming';
    const returnSearch = data?.body?.button?.formData?.returnSearch ?? '';
    const returnFilter = data?.body?.button?.formData?.returnFilter ?? 'All';
    const updatedList = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab: returnTab,
      searchWithFilters: { search: returnSearch, filter: returnFilter },
      forceSync: true,
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

