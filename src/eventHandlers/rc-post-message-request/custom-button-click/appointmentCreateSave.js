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
    if (!created) {
      showNotification({ level: 'error', message: 'Failed to create appointment.', ttl: 3000 });
      return;
    }
    showNotification({ level: 'success', message: 'Appointment created.', ttl: 3000 });

    // Return to list
    const { appointmentsListState = { tab: 'upcoming', searchWithFilters: { search: '', filter: 'All' } } } = await chrome.storage.local.get('appointmentsListState');
    const updatedList = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab: appointmentsListState.tab,
      searchWithFilters: appointmentsListState.searchWithFilters ?? {},
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

