import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';
import { extractAppointmentsListContext } from '../../../lib/appointmentUtils';

async function onEvent({ data, manifest, platformName }) {
  const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
  const appointmentTitle = apptCfg?.title ?? 'Appointments';
  const { tab, searchWithFilters } = extractAppointmentsListContext(data);
  const page = appointmentCreatePage.getAppointmentCreatePageRender({
    initialFormData: {
      returnTab: tab,
      returnSearch: String(searchWithFilters?.search ?? ''),
      returnFilter: String(searchWithFilters?.filter ?? 'All'),
      emailMandatoryInAttendee: apptCfg?.emailMandatoryInAttendee,
    },
    appointmentTitle,
    statusConfig: apptCfg?.status,
    titleFieldConfig: apptCfg?.titleField,
  });
  document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  }, '*');
  document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${page.id}`,
  }, '*');
}

exports.onEvent = onEvent;

