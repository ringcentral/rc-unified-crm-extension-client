import { createAppointment } from '../../service/appointmentService';

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

function toLocalDateTimeValue(dt) {
  const date = toLocalDateValue(dt);
  const time = toLocalTimeValue(dt);
  if (!date || !time) return '';
  return `${date}T${time}`;
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

function toUtcIsoFromLocalDateTimeValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  const d = new Date(v);
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

function dedupeContactsByIdType(contacts) {
  const map = new Map();
  for (const c of contacts || []) {
    const id = String(c?.id ?? '').trim();
    const type = String(c?.type ?? '').trim();
    const name = String(c?.name ?? '').trim();
    const email = String(c?.email ?? '').trim();
    const emailChecked = c?.emailChecked === true;
    if (!id) continue;
    // Treat the same contact as unique by id (type is sometimes missing/unstable).
    const existing = map.get(id);
    if (!existing) {
      map.set(id, {
        id, type, name,
        ...(email ? { email } : {}),
        ...(emailChecked ? { emailChecked: true } : {}),
      });
      continue;
    }
    if (!existing.type && type) existing.type = type;
    if (!existing.name && name) existing.name = name;
    if (!existing.email && email) existing.email = email;
    if (emailChecked) existing.emailChecked = true;
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
      ...(c?.email ? { email: String(c.email).trim() } : {}),
      ...(c?.emailChecked ? { emailChecked: true } : {}),
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
    || null;

  return {
    participantName,
    participantContacts: selectedContacts,
    primaryParticipant: primary,
  };
}

function getAppointmentCreatePageRender({
  initialFormData = {},
  appointmentTitle = 'Appointments',
  statusConfig,
  titleFieldConfig,
} = {}) {
  const statusVisible = statusConfig?.isVisible !== false;
  const statusOneOf = buildStatusOneOf(statusConfig);
  const defaultStatus = statusOneOf?.[0]?.const || 'scheduled';
  const titleFieldVisible = titleFieldConfig?.isVisible;
  const titleFieldTitle = String(titleFieldConfig?.value || 'Title');

  const nowPlus30 = Date.now() + 30 * 60 * 1000;
  const defaults = {
    ...(titleFieldVisible ? { title: '' } : {}),
    dateTime: toLocalDateTimeValue(nowPlus30),
    endDateTime: toLocalDateTimeValue(nowPlus30 + 60 * 60 * 1000),
    duration: 'PT1H',
    // Used to return to the same list view after create (no local cache).
    returnTab: 'upcoming',
    returnSearch: '',
    returnFilter: 'All',
    // Used by appointment participant search to optionally filter to contacts with email.
    emailMandatoryInAttendee: undefined,
    // Hidden: candidates for the autocomplete dropdown (populated by inline search).
    participantCandidates: [],
    // Visible: selected participant contact ids (autocomplete, freeSolo for search).
    participantContactIds: [],
    participantName: '',
    participantContactId: '',
    participantContactType: '',
    summary: '',
    ...(statusVisible ? { status: defaultStatus } : {}),
  };
  const merged = { ...defaults, ...(initialFormData || {}) };
  if (statusVisible) {
    const normalized = normalizeStatusKey(merged.status);
    merged.status = normalized || defaultStatus;
  }
  // Backward-compat: callers may still provide appointmentDate + appointmentTime.
  if (!merged.dateTime && merged.appointmentDate && merged.appointmentTime) {
    merged.dateTime = `${merged.appointmentDate}T${merged.appointmentTime}`;
  }
  const entityTitle = singularizeAppointmentTitle(appointmentTitle);

  const candidateContacts = dedupeContactsByIdType([
    ...normalizeContactList(merged.participantCandidates),
    ...normalizeContactList(merged.participantContacts),
  ]);
  const candidateIds = candidateContacts.map((c) => String(c.id));
  const candidateNames = candidateContacts.map((c) => String(c.name || c.id));

  const selectedIds = uniqueIds(
    Array.isArray(merged.participantContactIds) && merged.participantContactIds.length > 0
      ? merged.participantContactIds
      : normalizeContactList(merged.participantContacts).map((c) => c.id),
  );
  merged.participantContactIds = selectedIds;

  const required = [
    ...(titleFieldVisible ? ['title'] : []),
    'dateTime',
    'endDateTime',
    'participantContactIds',
    ...(statusVisible ? ['status'] : []),
  ];

  const properties = {
    ...(titleFieldVisible
      ? {
        titleLabel: { type: 'string', title: '', description: titleFieldTitle },
        title: { type: 'string', title: '' },
      }
      : {}),
    dateTime: { type: 'string', format: 'date-time', title: 'Start Date and Time' },
    endDateTime: { type: 'string', format: 'date-time', title: 'End Date and Time' },
    durationLabel: { type: 'string', title: '', description: 'Duration' },
    duration: { type: 'string', title: '', format: 'duration' },
    returnTab: { type: 'string', title: '' },
    returnSearch: { type: 'string', title: '' },
    returnFilter: { type: 'string', title: '' },
    emailMandatoryInAttendee: { type: 'boolean', title: '' },
    participantsLabel: { type: 'string', title: '', description: 'Participants' },
    // Visible: participants list (AutocompleteWidget with freeSolo search + multi-select).
    participantContactIds: {
      type: 'array',
      title: '',
      minItems: 1,
      items: {
        type: 'string',
      },
    },
    summaryLabel: { type: 'string', title: '', description: 'Summary/Description' },
    // Hidden: keep participantName for backward compatibility / payload.
    participantName: { type: 'string', title: '' },
    // Hidden fields: selected contact identity
    participantContactId: { type: 'string', title: '' },
    participantContactType: { type: 'string', title: '' },
    // Hidden field: multi-selected contacts (normalized list)
    participantContacts: { type: 'array', title: '' },
    // Hidden field: all candidates to keep autocomplete options around.
    participantCandidates: { type: 'array', title: '' },
    summary: { type: 'string', title: '' },
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
  };

  const uiOrder = [
    ...(titleFieldVisible ? ['titleLabel', 'title'] : []),
    'dateTime',
    'endDateTime',
    'durationLabel',
    'duration',
    'summaryLabel',
    'summary',
    'participantsLabel',
    'participantContactIds',
    'returnTab',
    'returnSearch',
    'returnFilter',
    'emailMandatoryInAttendee',
    'participantCandidates',
    'participantName',
    'participantContactId',
    'participantContactType',
    'participantContacts',
    ...(statusVisible ? ['statusLabel', 'status'] : []),
  ];

  return {
    id: 'appointmentCreatePage',
    title: `Create ${entityTitle}`,
    type: 'page',
    schema: {
      type: 'object',
      // Required fields so "Create" stays disabled until form is complete.
      required,
      properties,
    },
    uiSchema: {
      // Use the embeddable page header submit button so it can be disabled until required fields are filled.
      submitButtonOptions: {
        submitText: 'Create',
      },
      // keep date/time at top like Meetings
      'ui:order': uiOrder,
      dateTime: {
        'ui:options': { grid: { xs: 12, sm: 12 } },
      },
      endDateTime: {
        'ui:options': { grid: { xs: 12, sm: 12 } },
      },
      durationLabel: {
        'ui:field': 'typography',
        'ui:variant': 'caption1',
        'ui:style': { marginBottom: '-8px' },
      },
      duration: {
        'ui:widget': 'duration',
        'ui:readonly': true,
        'ui:disabled': true,
        'ui:options': { grid: { xs: 12, sm: 12 }, label: false },
      },
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
      returnTab: { 'ui:widget': 'hidden' },
      returnSearch: { 'ui:widget': 'hidden' },
      returnFilter: { 'ui:widget': 'hidden' },
      emailMandatoryInAttendee: { 'ui:widget': 'hidden' },
      participantCandidates: { 'ui:widget': 'hidden' },
      participantName: { 'ui:widget': 'hidden' },
      participantContactId: { 'ui:widget': 'hidden' },
      participantContactType: { 'ui:widget': 'hidden' },
      participantContacts: { 'ui:widget': 'hidden' },
      participantContactIds: {
        'ui:widget': 'AutocompleteWidget',
        'ui:placeholder': 'Type a name and press Enter to search...',
        'ui:options': {
          multiple: true,
          freeSolo: true,
          enumOptions: candidateContacts.map((c) => {
            const noEmail = merged.emailMandatoryInAttendee && c.emailChecked && !c.email;
            return {
              value: String(c.id),
              label: noEmail
                ? `${String(c.name || c.id)} — No email address`
                : String(c.name || c.id),
            };
          }),
          grid: { xs: 12, sm: 12 },
          label: false,
        },
      },
      summary: {
        'ui:widget': 'textarea',
        'ui:options': { label: false },
        'ui:help': '',
      },
      summaryLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
      participantsLabel: { 'ui:field': 'typography', 'ui:variant': 'caption1', 'ui:style': { marginBottom: '-8px' } },
    },
    formData: merged,
  };
}

async function submitAppointmentCreate({ manifest, jwtToken, formData }) {
  const startTimeUtc = toUtcIsoFromLocalDateTimeValue(formData?.dateTime);
  const durationMinutesTotal = durationMinutesFromIso(formData?.duration);
  const safeDurationMinutes = Number.isFinite(durationMinutesTotal) ? durationMinutesTotal : 60;

  const { participantName, participantContacts, primaryParticipant } = resolveParticipantsForSubmit(formData);
  const uniqueParticipantContacts = dedupeContactsByIdType(participantContacts);

  const payload = {
    participantName: normalizeParticipantNameForSubmit(participantName || formData?.participantName),
    contactId: primaryParticipant?.id ?? '',
    contactType: primaryParticipant?.type ?? '',
    // Always pass contacts as an array (even when only one is selected).
    contacts: uniqueParticipantContacts.length > 0
      ? uniqueParticipantContacts
      : (formData?.participantContactId
        ? [{
          id: String(formData?.participantContactId ?? ''),
          type: String(formData?.participantContactType ?? ''),
          name: String(formData?.participantName ?? ''),
        }]
        : []),
    summary: formData?.summary ?? '',
    startTimeUtc,
    durationMinutes: safeDurationMinutes,
    status: formData?.status ?? 'scheduled',
  };
  const title = String(formData?.title ?? '').trim();
  if (title) payload.title = title;
  return await createAppointment({
    serverUrl: manifest.serverUrl,
    jwtToken,
    payload,
  });
}

exports.getAppointmentCreatePageRender = getAppointmentCreatePageRender;
exports.submitAppointmentCreate = submitAppointmentCreate;

