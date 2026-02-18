import appointmentCreatePage from '../../../../components/appointmentsPage/appointmentCreatePage';

async function onEvent({ data }) {
  const selectedId = data?.body?.formData?.contactList;
  const contactInfo = data?.body?.page?.formData?.contactInfo ?? [];
  const selected = (contactInfo || []).find((c) => String(c.id) === String(selectedId));
  if (!selected) return;

  const { appointmentCreateDraft = {} } = await chrome.storage.local.get({ appointmentCreateDraft: {} });
  const updatedDraft = {
    ...appointmentCreateDraft,
    participantName: selected.name ?? '',
    participantContactId: selected.id ?? '',
    participantContactType: selected.type ?? '',
  };
  await chrome.storage.local.set({ appointmentCreateDraft: updatedDraft });

  const page = appointmentCreatePage.getAppointmentCreatePageRender({ initialFormData: updatedDraft });
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

