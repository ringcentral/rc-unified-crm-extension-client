import appointmentEditPage from '../../../components/appointmentsPage/appointmentEditPage';

async function onEvent({ data, manifest, listButtonItemId }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { appointmentsListCache = [] } = await chrome.storage.local.get('appointmentsListCache');
    const appt = (appointmentsListCache || []).find(a => String(a.thirdPartyAppointmentId ?? a.id ?? a.externalId ?? '') === String(listButtonItemId));
    if (!appt) {
      return;
    }
    await chrome.storage.local.set({ appointmentEditCache: appt });
    const editPage = appointmentEditPage.getAppointmentEditPageRender({ appointment: appt });
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

