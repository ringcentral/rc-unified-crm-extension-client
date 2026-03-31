import appointmentEditPage from '../../../components/appointmentsPage/appointmentEditPage';
import { listAppointments } from '../../../service/appointmentService';
import { extractAppointmentsListContext, normalizeAppointmentId, toCanonicalAppointment } from '../../../lib/appointmentUtils';

async function onEvent({ data, manifest, platformName, listButtonItemId }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { tab, searchWithFilters } = extractAppointmentsListContext(data);

    const items = await listAppointments({
      serverUrl: manifest.serverUrl,
      jwtToken: rcUnifiedCrmExtJwt,
      range: tab,
      mineOnly: false,
      forceSync: false,
    });

    const appointment = (items || []).find((item) => String(normalizeAppointmentId(item)) === String(listButtonItemId));
    if (!appointment) {
      return;
    }
    const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
    const appointmentTitle = apptCfg?.title ?? 'Appointments';
    const editPage = appointmentEditPage.getAppointmentEditPageRender({
      appointment: {
        ...toCanonicalAppointment(appointment),
        returnTab: tab,
        returnSearch: String(searchWithFilters?.search ?? ''),
        returnFilter: String(searchWithFilters?.filter ?? 'All'),
        emailMandatoryInAttendee: apptCfg?.emailMandatoryInAttendee,
      },
      appointmentTitle,
      titleFieldConfig: apptCfg?.titleField,
      statusConfig: apptCfg?.status,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: editPage,
    }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${editPage.id}`,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

