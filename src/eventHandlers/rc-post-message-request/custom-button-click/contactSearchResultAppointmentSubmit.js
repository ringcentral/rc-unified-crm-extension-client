import { showNotification } from '../../../lib/util';
import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';
import appointmentEditPage from '../../../components/appointmentsPage/appointmentEditPage';

function normalizeSelectedIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
  return [String(raw)].filter(Boolean);
}

function buildParticipantNameDisplay(contacts) {
  const names = (contacts || []).map((c) => String(c?.name || '').trim()).filter(Boolean);
  if (names.length === 0) return '';
  // Multi-line display in the appointment form (also editable by user).
  return names.join('\n');
}

function dedupeContactsByIdType(contacts) {
  const map = new Map();
  for (const c of contacts || []) {
    const id = String(c?.id ?? '').trim();
    const type = String(c?.type ?? '').trim();
    const name = String(c?.name ?? '').trim();
    if (!id) continue;
    // Treat the same contact as unique by id (type is sometimes missing/unstable).
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { id, type, name });
      continue;
    }
    if (!existing.type && type) existing.type = type;
    if (!existing.name && name) existing.name = name;
  }
  return Array.from(map.values());
}

function hasContactEmail(contact) {
  const directEmail = String(
    contact?.email ??
    ''
  ).trim();
  if (directEmail) return true;
  return false;
}

async function onEvent({ data, manifest, platformName }) {
  const selectedIds = normalizeSelectedIds(data?.body?.button?.formData?.contactList);
  const contactInfo = data?.body?.button?.formData?.contactInfo ?? data?.body?.page?.formData?.contactInfo ?? [];
  const appointmentCreateDraft =
    data?.body?.button?.formData?.appointmentCreateDraft ??
    data?.body?.page?.formData?.appointmentCreateDraft;
  const appointmentEditDraft =
    data?.body?.button?.formData?.appointmentEditDraft ??
    data?.body?.page?.formData?.appointmentEditDraft;
  const draft = appointmentEditDraft ?? appointmentCreateDraft ?? {};
  const requiresEmail = draft?.emailMandatoryInAttendee !== false;

  const selectedContactsRaw = (contactInfo || [])
    .filter((c) => selectedIds.includes(String(c?.id)));
  const selectedContacts = requiresEmail
    ? selectedContactsRaw.filter((c) => hasContactEmail(c))
    : selectedContactsRaw;
  const skippedContacts = requiresEmail
    ? selectedContactsRaw.filter((c) => !hasContactEmail(c))
    : [];

  if (selectedContacts.length === 0) {
    showNotification({
      level: 'warning',
      message: skippedContacts.length > 0
        ? 'Only contacts with an email address can be added to this appointment.'
        : 'Please select at least one contact.',
      ttl: 3000,
    });
    return;
  }

  if (skippedContacts.length > 0) {
    showNotification({
      level: 'warning',
      message: 'Some selected contacts were skipped because they do not have an email address.',
      ttl: 3000,
    });
  }

  const participantContacts = selectedContacts.map((c) => ({
    id: String(c?.id ?? ''),
    type: String(c?.type ?? ''),
    name: String(c?.name ?? ''),
  })).filter((c) => c.id);

  const existing = Array.isArray(draft?.participantContacts) ? draft.participantContacts : [];
  const mergedContacts = appointmentEditDraft
    ? dedupeContactsByIdType([...(existing || []), ...(participantContacts || [])])
    : dedupeContactsByIdType(participantContacts);

  const first = mergedContacts[0] ?? { id: '', type: '', name: '' };
  const participantName = buildParticipantNameDisplay(mergedContacts);

  const updatedDraft = {
    ...draft,
    participantContacts: mergedContacts,
    participantName,
    // Preserve current primary contact if it's still present; otherwise fallback to first selected.
    participantContactId: (appointmentEditDraft && mergedContacts.some((c) => String(c?.id) === String(draft?.participantContactId)))
      ? draft.participantContactId
      : first.id,
    participantContactType: (appointmentEditDraft && mergedContacts.some((c) => String(c?.id) === String(draft?.participantContactId)))
      ? draft.participantContactType
      : first.type,
  };

  const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
  const appointmentTitle = apptCfg?.title ?? 'Appointments';
  const page = appointmentEditDraft
    ? appointmentEditPage.getAppointmentEditPageRender({
      initialFormData: updatedDraft,
      appointmentTitle,
      statusConfig: apptCfg?.status,
      titleFieldConfig: apptCfg?.titleField,
    })
    : appointmentCreatePage.getAppointmentCreatePageRender({
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
