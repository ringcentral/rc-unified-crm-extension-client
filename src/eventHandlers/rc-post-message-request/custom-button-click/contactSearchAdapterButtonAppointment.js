import contactSearch from '../../../core/customContactSearch';

async function onEvent({ data, manifest, platform }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const contactNameToBeSearch = data.body.button.formData.contactNameToSearch;
    const appointmentCreateDraft = data?.body?.button?.formData?.appointmentCreateDraft;
    const appointmentEditDraft = data?.body?.button?.formData?.appointmentEditDraft;
    const draft = appointmentEditDraft ?? appointmentCreateDraft ?? {};
    const res = await contactSearch.getCustomContactSearchData({
      serverUrl: manifest.serverUrl,
      platform,
      contactSearch: contactNameToBeSearch,
      pageId: 'contactSearchResultAppointment',
      contactPhoneNumber: '',
      appointment: true,
      emailMandatoryInAttendee: draft?.emailMandatoryInAttendee,
      formData: {
        ...(appointmentCreateDraft ? { appointmentCreateDraft } : {}),
        ...(appointmentEditDraft ? { appointmentEditDraft } : {}),
      },
    });
    if (!res) {
      return;
    }
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: res,
    }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${res.id}`,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

