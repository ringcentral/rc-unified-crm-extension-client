import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';

async function onEvent() {
  const page = appointmentCreatePage.getAppointmentCreatePageRender();
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

