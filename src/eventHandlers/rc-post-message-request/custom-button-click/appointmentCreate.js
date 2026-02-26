import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';

async function onEvent({ manifest, platformName }) {
  const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
  const appointmentTitle = apptCfg?.title ?? 'Appointments';
  const page = appointmentCreatePage.getAppointmentCreatePageRender({
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

