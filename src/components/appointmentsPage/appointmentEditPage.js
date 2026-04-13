import { updateAppointment, updateAppointmentStatus } from '../../service/appointmentService';
import { formatAttendeeNames, normalizeAttendees } from '../../lib/appointmentUtils';

function singularizeAppointmentTitle(title) {
  const t = String(title || '').trim();
  if (!t) return 'Appointment';
  if (/appointments$/i.test(t)) return t.replace(/appointments$/i, 'Appointment');
  if (t.length > 1 && /s$/i.test(t)) return t.slice(0, -1);
  return t;
}

function normalizeStatusKey(s) {
  const v = String(s || '').trim().toLowerCase();
  if (!v) return '';
  return v;
}

function toTitleCaseStatusLabel(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  // Prefer human-provided label when it already looks like a label.
  if (/[A-Z]/.test(raw) || raw.includes(' ')) return raw;
  return raw
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildStatusOneOf(statusConfig) {
  const configured = Array.isArray(statusConfig?.value) ? statusConfig.value : [];
  const values = configured.length > 0 ? configured : ['Scheduled', 'Confirmed', 'Canceled'];

  const seen = new Set();
  const oneOf = [];
  for (const v of values) {
    const key = normalizeStatusKey(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    oneOf.push({ const: key, title: toTitleCaseStatusLabel(v) });
  }
  return oneOf.length > 0 ? oneOf : [{ const: 'scheduled', title: 'Scheduled' }];
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toLocalDateValue(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeValue(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const DURATION_REGEX = /^P(?=\d|T\d)(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?)?$/i;

function durationIsoFromMinutes(totalMinutesRaw) {
  const totalMinutes = Number(totalMinutesRaw);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return 'PT0M';
  const minutesInt = Math.floor(totalMinutes);
  const hours = Math.floor(minutesInt / 60);
  const minutes = minutesInt % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}H`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}M`);
  return `PT${parts.join('')}`;
}

function durationMinutesFromIso(value) {
  if (!value) return NaN;
  const v = String(value).trim();
  if (!v) return NaN;
  const match = v.match(DURATION_REGEX);
  if (!match) return NaN;
  const [, days, hours, minutes] = match;
  const d = Number.parseInt(days ?? '0', 10);
  const h = Number.parseInt(hours ?? '0', 10);
  const m = Number.parseInt(minutes ?? '0', 10);
  if (!Number.isFinite(d) || !Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (d < 0 || h < 0 || m < 0) return NaN;
  return (d * 24 * 60) + (h * 60) + m;
}

function toUtcIsoFromLocalDateTime({ date, time }) {
  if (!date || !time) return undefined;
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizeParticipantNameForSubmit(value) {
  // Accept multi-line input but submit a single-line value.
  return String(value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

function tokenizeParticipantNames(value) {
  return String(value ?? '')
    .split('\n')
    .flatMap((line) => line.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
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

function normalizeContactList(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((c) => ({
      id: String(c?.id ?? '').trim(),
      type: String(c?.type ?? '').trim(),
      name: String(c?.name ?? '').trim(),
    }))
    .filter((c) => c.id);
}

function uniqueIds(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    const s = String(v ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function resolveParticipantsForSubmit(formData) {
  const selectedFromIds = uniqueIds(Array.isArray(formData?.participantContactIds) ? formData.participantContactIds : []);
  const candidates = dedupeContactsByIdType([
    ...normalizeContactList(formData?.participantCandidates),
    ...normalizeContactList(formData?.participantContacts),
    ...(formData?.participantContactId
      ? [{
        id: String(formData?.participantContactId ?? '').trim(),
        type: String(formData?.participantContactType ?? '').trim(),
        name: String(formData?.participantName ?? '').trim(),
      }]
      : []),
  ]);
  const selected = selectedFromIds.length > 0 ? selectedFromIds : uniqueIds(candidates.map((c) => c.id));
  const byId = new Map(candidates.map((c) => [String(c.id), c]));
  const selectedContacts = selected.map((id) => byId.get(id)).filter(Boolean);
  const manualNames = selected.filter((id) => !byId.has(id));

  const participantName = [
    ...selectedContacts.map((c) => c.name).filter(Boolean),
    ...manualNames,
  ].join(', ');

  const primary =
    selectedContacts.find((c) => String(c?.id) === String(formData?.participantContactId ?? '').trim())
    || selectedContacts[0]
    || null;

  return {
    participantName,
    participantContacts: selectedContacts,
    primaryParticipant: primary,
  };
}

function reconcileParticipantContactsForSubmit({ participantName, participantContacts }) {
  const normalizedContacts = dedupeContactsByIdType((participantContacts || [])
    .map((c) => ({
      id: String(c?.id ?? '').trim(),
      type: String(c?.type ?? '').trim(),
      name: String(c?.name ?? '').trim(),
    }))
    .filter((c) => c.id));

  const tokens = tokenizeParticipantNames(participantName);
  if (tokens.length === 0) {
    return [];
  }

  const counts = new Map();
  for (const token of tokens) {
    const key = token.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const matched = [];
  for (const contact of normalizedContacts) {
    const key = String(contact?.name ?? '').trim().toLowerCase();
    const remaining = key ? (counts.get(key) || 0) : 0;
    if (remaining > 0) {
      matched.push(contact);
      counts.set(key, remaining - 1);
    }
  }

  // If names were manually edited into values we cannot map back to ids,
  // don't send stale contacts that were removed from the visible field.
  return matched;
}

function getAppointmentEditPageRender({
  appointment,
  appointmentTitle = 'Appointments',
  titleFieldConfig,
  statusConfig,
  initialFormData,
} = {}) {
  const titleFieldVisible = titleFieldConfig?.isVisible;
  const titleFieldTitle = String(titleFieldConfig?.value || 'Title');

  const source = initialFormData || appointment || {};
  const thirdPartyAppointmentIdRaw = source?.thirdPartyAppointmentId ?? '';
  const thirdPartyAppointmentId =
    thirdPartyAppointmentIdRaw && String(thirdPartyAppointmentIdRaw).toUpperCase() !== 'N/A'
      ? String(thirdPartyAppointmentIdRaw)
      : '';
  const id = thirdPartyAppointmentId || String(source?.id ?? source?.externalId ?? '');

  const statusVisible = statusConfig?.isVisible !== false;
  const statusOneOf = buildStatusOneOf(statusConfig);
  const defaultStatus = statusOneOf?.[0]?.const || 'scheduled';

  const attendees = normalizeAttendees(source?.attendees ?? source?.attendeeIds);
  const participantContactsFromAttendees = dedupeContactsByIdType(attendees.map((a) => ({
    id: String(a?.id ?? '').trim(),
    type: String(a?.type ?? '').trim(),
    name: String(a?.name ?? '').trim(),
  })).filter((c) => c.id));
  const first = participantContactsFromAttendees[0] ?? { id: '', type: '', name: '' };

  const participantContactsFromDraft = Array.isArray(source?.participantContacts)
    ? dedupeContactsByIdType(source.participantContacts
      .map((c) => ({
        id: String(c?.id ?? '').trim(),
        type: String(c?.type ?? '').trim(),
        name: String(c?.name ?? '').trim(),
      }))
      .filter((c) => c.id))
    : [];

  const participantCandidatesFromSource = Array.isArray(source?.participantCandidates)
    ? dedupeContactsByIdType(source.participantCandidates
      .map((c) => ({
        id: String(c?.id ?? '').trim(),
        type: String(c?.type ?? '').trim(),
        name: String(c?.name ?? '').trim(),
      }))
      .filter((c) => c.id))
    : [];

  const participantName =
    (participantContactsFromDraft.length > 0
      ? participantContactsFromDraft.map((c) => c.name).filter(Boolean).join('\n')
      : '') ||
    (participantContactsFromAttendees.length > 0
      ? participantContactsFromAttendees.map((c) => c.name).filter(Boolean).join('\n')
      : '') ||
    String(source?.participantName ?? '').trim() ||
    formatAttendeeNames(attendees) ||
    '';
  const start = source?.startTimeUtc ?? source?.startTime ?? source?.start ?? null;
  const durationMinutes = Number(source?.durationMinutes ?? source?.duration ?? 30) || 30;

  const entityTitle = singularizeAppointmentTitle(appointmentTitle);
  const defaults = {
    thirdPartyAppointmentId: String(id),
    returnTab: String(source?.returnTab ?? 'upcoming'),
    returnSearch: String(source?.returnSearch ?? ''),
    returnFilter: String(source?.returnFilter ?? 'All'),
    ...(titleFieldVisible ? { title: source?.title ?? source?.subject ?? '' } : {}),
    participantCandidates: dedupeContactsByIdType([
      ...participantCandidatesFromSource,
      ...participantContactsFromDraft,
      ...participantContactsFromAttendees,
    ]),
    participantContactIds: uniqueIds(
      Array.isArray(source?.participantContactIds) ? source.participantContactIds : (
        participantContactsFromDraft.length > 0
          ? participantContactsFromDraft.map((c) => c.id)
          : participantContactsFromAttendees.map((c) => c.id)
      ),
    ),
    participantName,
    summary: source?.summary ?? source?.description ?? '',
    appointmentDate: start ? toLocalDateValue(start) : '',
    appointmentTime: start ? toLocalTimeValue(start) : '',
    duration: durationIsoFromMinutes(durationMinutes),
    participantContacts: participantContactsFromDraft.length > 0 ? participantContactsFromDraft : participantContactsFromAttendees,
    participantContactId: String(source?.participantContactId ?? '').trim() || first.id,
    participantContactType: String(source?.participantContactType ?? '').trim() || first.type,
    emailMandatoryInAttendee: source?.emailMandatoryInAttendee,
    ...(statusVisible ? { status: normalizeStatusKey(source?.status) || defaultStatus } : {}),
  };
  const merged = { ...defaults, ...(initialFormData || {}) };
  if (statusVisible) {
    merged.status = normalizeStatusKey(merged.status) || defaultStatus;
  }

  const candidateContacts = dedupeContactsByIdType([
    ...normalizeContactList(merged.participantCandidates),
    ...normalizeContactList(merged.participantContacts),
    ...participantContactsFromAttendees,
  ]);
  const candidateIds = candidateContacts.map((c) => String(c.id));
  const candidateNames = candidateContacts.map((c) => String(c.name || c.id));

  merged.participantContactIds = uniqueIds(
    Array.isArray(merged.participantContactIds) && merged.participantContactIds.length > 0
      ? merged.participantContactIds
      : normalizeContactList(merged.participantContacts).map((c) => c.id),
  );

  return {
    id: 'appointmentEditPage',
    title: `Edit ${entityTitle}`,
    type: 'page',
    schema: {
      type: 'object',
      required: [],
      properties: {
        // Hidden but required for save.
        thirdPartyAppointmentId: { type: 'string', title: '' },
        // Used to return to the same list view after update (no local cache).
        returnTab: { type: 'string', title: '' },
        returnSearch: { type: 'string', title: '' },
        returnFilter: { type: 'string', title: '' },
        emailMandatoryInAttendee: { type: 'boolean', title: '' },
        ...(titleFieldVisible
          ? {
            titleLabel: { type: 'string', title: '', description: titleFieldTitle },
            title: { type: 'string', title: '' },
          }
          : {}),
        appointmentDateLabel: { type: 'string', title: '', description: 'Date' },
        appointmentDate: { type: 'string', title: '', format: 'date' },
        appointmentTimeLabel: { type: 'string', title: '', description: 'Time' },
        appointmentTime: { type: 'string', title: '', format: 'time' },
        durationLabel: { type: 'string', title: '', description: 'Duration' },
        duration: { type: 'string', title: '', format: 'duration' },
        summaryLabel: { type: 'string', title: '', description: 'Summary' },
        summary: { type: 'string', title: '' },
        participantsLabel: { type: 'string', title: '', description: 'Participants' },
        participantContactIds: {
          type: 'array',
          title: '',
          items: {
            type: 'string',
          },
        },
        participantCandidates: { type: 'array', title: '' },
        participantName: { type: 'string', title: '' },
        // Hidden fields: selected contact identity
        participantContactId: { type: 'string', title: '' },
        participantContactType: { type: 'string', title: '' },
        // Hidden field: multi-selected contacts (normalized list)
        participantContacts: { type: 'array', title: '' },
        appointmentSelectParticipantButton: { type: 'string', title: 'Search' },
        ...(statusVisible
          ? {
            statusLabel: { type: 'string', title: '', description: 'Status' },
            status: {
              type: 'string',
              title: '',
              oneOf: statusOneOf,
            },
          }
          : {}),
      },
    },
    uiSchema: {
      // Use the embeddable page header submit button (top-right) like the call log page.
      submitButtonOptions: {
        submitText: 'Update',
      },
      thirdPartyAppointmentId: { 'ui:widget': 'hidden' },
      returnTab: { 'ui:widget': 'hidden' },
      returnSearch: { 'ui:widget': 'hidden' },
      returnFilter: { 'ui:widget': 'hidden' },
      emailMandatoryInAttendee: { 'ui:widget': 'hidden' },
      ...(titleFieldVisible
        ? {
          titleLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
          title: {
            'ui:placeholder': titleFieldTitle,
            'ui:options': { label: false },
          },
        }
        : {}),
      ...(statusVisible
        ? {
          statusLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
          status: { 'ui:widget': 'select', 'ui:options': { label: false } },
        }
        : {}),
      participantCandidates: { 'ui:widget': 'hidden' },
      participantName: { 'ui:widget': 'hidden' },
      participantContactId: { 'ui:widget': 'hidden' },
      participantContactType: { 'ui:widget': 'hidden' },
      participantContacts: { 'ui:widget': 'hidden' },
      participantContactIds: {
        'ui:widget': 'AutocompleteWidget',
        'ui:placeholder': candidateContacts.length > 0 ? 'Select participants...' : 'Use Search to find contacts',
        'ui:options': {
          multiple: true,
          enumOptions: candidateContacts.map((c) => ({ value: String(c.id), label: String(c.name || c.id) })),
          grid: { xs: 8, sm: 9 },
          label: false,
        },
      },
      appointmentSelectParticipantButton: {
        'ui:field': 'button',
        'ui:variant': 'outlined',
        'ui:color': 'primary',
        'ui:fullWidth': false,
        'ui:options': { grid: { xs: 2, sm: 1} },
      },
      summary: {
        'ui:widget': 'textarea',
        'ui:options': { label: false },
      },
      summaryLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
      participantsLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
      'ui:order': [
        'thirdPartyAppointmentId',
        'returnTab',
        'returnSearch',
        'returnFilter',
        'emailMandatoryInAttendee',
        ...(titleFieldVisible ? ['titleLabel', 'title'] : []),
        'appointmentDateLabel',
        'appointmentDate',
        'appointmentTimeLabel',
        'appointmentTime',
        'durationLabel',
        'duration',
        'summaryLabel',
        'summary',
        'participantsLabel',
        'participantContactIds',
        'appointmentSelectParticipantButton',
        'participantCandidates',
        'participantName',
        'participantContactId',
        'participantContactType',
        'participantContacts',
        ...(statusVisible ? ['statusLabel', 'status'] : []),
      ],
      appointmentDateLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
      appointmentDate: { 'ui:widget': 'date', 'ui:options': { label: false } },
      // Render Time + Duration in a single row on desktop.
      appointmentTimeLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
      appointmentTime: {
        'ui:widget': 'time',
        'ui:options': { grid: { xs: 12, sm: 4 }, label: false },
      },
      durationLabel: {
        'ui:field': 'typography',
        'ui:variant': 'caption1',
        'ui:style': { marginBottom: '-8px' },
      },
      duration: {
        'ui:widget': 'duration',
        'ui:options': { grid: { xs: 12, sm: 8 }, label: false },
      },
    },
    formData: merged,
  };
}

async function saveAppointmentEdits({ manifest, jwtToken, formData }) {
  const appointmentId = formData?.thirdPartyAppointmentId;
  if (!appointmentId) return null;

  const startTime = toUtcIsoFromLocalDateTime({
    date: formData?.appointmentDate,
    time: formData?.appointmentTime,
  });
  const durationMinutesTotal = durationMinutesFromIso(formData?.duration);
  const safeDurationMinutes = Number.isFinite(durationMinutesTotal) ? durationMinutesTotal : 60;

  const resolvedFromIds = resolveParticipantsForSubmit(formData);
  const resolvedContacts =
    resolvedFromIds.participantContacts.length > 0
      ? resolvedFromIds.participantContacts
      : reconcileParticipantContactsForSubmit({
        participantName: formData?.participantName,
        participantContacts: Array.isArray(formData?.participantContacts) ? formData.participantContacts : [],
      });
  const primaryParticipant =
    resolvedFromIds.primaryParticipant
    || resolvedContacts.find((c) => String(c?.id) === String(formData?.participantContactId ?? '').trim())
    || resolvedContacts[0]
    || null;

  const participantNameToSubmit =
    resolvedFromIds.participantName
    || normalizeParticipantNameForSubmit(formData?.participantName);

  const patchBase = {
    participantName: participantNameToSubmit,
    summary: formData?.summary ?? '',
    startTime,
    durationMinutes: safeDurationMinutes,
    contactId: primaryParticipant?.id ?? '',
    contactType: primaryParticipant?.type ?? '',
    // Some backends use "attendees" while others use "contacts".
    contacts: resolvedContacts,
    attendees: resolvedContacts,
    attendeeIds: resolvedContacts.map((c) => c.id),
  };
  const title = String(formData?.title ?? '').trim();
  if (title) patchBase.title = title;

  const normalizedStatus = formData?.status ? normalizeStatusKey(formData.status) : '';
  const patchWithStatus = normalizedStatus ? { ...patchBase, status: normalizedStatus } : patchBase;

  // Try to save everything in a single PATCH first.
  const saved = await updateAppointment({
    serverUrl: manifest.serverUrl,
    jwtToken,
    appointmentId,
    patch: patchWithStatus,
  });
  if (saved) return saved;

  // Fallback: some backends may not accept status in PATCH; try splitting the calls.
  if (normalizedStatus) {
    const savedCore = await updateAppointment({
      serverUrl: manifest.serverUrl,
      jwtToken,
      appointmentId,
      patch: patchBase,
    });
    if (!savedCore) return null;
    const statusSaved = await updateAppointmentStatus({
      serverUrl: manifest.serverUrl,
      jwtToken,
      appointmentId,
      status: normalizedStatus,
    });
    return statusSaved || savedCore;
  }

  return null;
}

exports.getAppointmentEditPageRender = getAppointmentEditPageRender;
exports.saveAppointmentEdits = saveAppointmentEdits;
