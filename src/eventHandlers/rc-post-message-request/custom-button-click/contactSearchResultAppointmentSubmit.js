import { showNotification } from '../../../lib/util';
import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';

function normalizeSelectedIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
  return [String(raw)].filter(Boolean);
}

function buildParticipantNameDisplay(contacts) {
  const names = (contacts || []).map((c) => String(c?.name || '').trim()).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

async function onEvent({ data, manifest, platformName }) {
  const selectedIds = normalizeSelectedIds(data?.body?.button?.formData?.contactList);
  const contactInfo = data?.body?.button?.formData?.contactInfo ?? data?.body?.page?.formData?.contactInfo ?? [];
  const appointmentCreateDraft =
    data?.body?.button?.formData?.appointmentCreateDraft ??
    data?.body?.page?.formData?.appointmentCreateDraft ??
    {};

  const selectedContacts = (contactInfo || [])
    .filter((c) => selectedIds.includes(String(c?.id)));

  if (selectedContacts.length === 0) {
    showNotification({ level: 'warning', message: 'Please select at least one contact.', ttl: 3000 });
    return;
  }

  const participantContacts = selectedContacts.map((c) => ({
    id: String(c?.id ?? ''),
    type: String(c?.type ?? ''),
    name: String(c?.name ?? ''),
  })).filter((c) => c.id);

  const first = participantContacts[0] ?? { id: '', type: '', name: '' };
  const participantName = buildParticipantNameDisplay(participantContacts);

  const updatedDraft = {
    ...appointmentCreateDraft,
    participantContacts,
    participantName,
    participantContactId: first.id,
    participantContactType: first.type,
  };

  const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
  const appointmentTitle = apptCfg?.title ?? 'Appointments';
  const page = appointmentCreatePage.getAppointmentCreatePageRender({
    initialFormData: updatedDraft,
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

