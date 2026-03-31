import contactSearch from '../../../core/customContactSearch';

async function onEvent({ data }) {
  const draft = data?.body?.button?.formData ?? {};
  const isEdit = !!draft.thirdPartyAppointmentId;
  const draftKey = isEdit ? 'appointmentEditDraft' : 'appointmentCreateDraft';

  const page = contactSearch.getCustomContactSearch({
    contactSearchAdapterButton: 'contactSearchAdapterButtonAppointment',
    contactPhoneNumber: '',
    appointment: true,
    formData: {
      [draftKey]: draft,
    },
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

