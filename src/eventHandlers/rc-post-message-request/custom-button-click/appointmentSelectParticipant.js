import contactSearch from '../../../core/customContactSearch';

async function onEvent({ data }) {
  // Persist current create-appointment draft so we can restore it after contact selection.
  const draft = data?.body?.button?.formData ?? {};
  await chrome.storage.local.set({ appointmentCreateDraft: draft });

  const page = contactSearch.getCustomContactSearch({
    contactSearchAdapterButton: 'contactSearchAdapterButtonAppointment',
    contactPhoneNumber: '',
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

