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
  if (v === 'cancelled') return 'canceled';
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

function buildDurationOptionsHours(maxHours = 8) {
  const opts = [];
  for (let h = 0; h <= maxHours; h += 1) {
    opts.push({ const: String(h), title: `${pad2(h)} hr` });
  }
  return opts;
}

function buildDurationOptionsMinutes() {
  return [
    { const: '0', title: '00 min' },
    { const: '15', title: '15 min' },
    { const: '30', title: '30 min' },
    { const: '45', title: '45 min' },
  ];
}

function toUtcIsoFromLocalDateTime({ date, time }) {
  if (!date || !time) return undefined;
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
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
    appointmentDate: toLocalDateValue(nowPlus30),
    appointmentTime: toLocalTimeValue(nowPlus30),
    durationHours: '1',
    durationMinutes: '0',
    // Used to return to the same list view after create (no local cache).
    returnTab: 'upcoming',
    returnSearch: '',
    returnFilter: 'All',
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
  const entityTitle = singularizeAppointmentTitle(appointmentTitle);

  const required = [
    ...(titleFieldVisible ? ['title'] : []),
    'appointmentDate',
    'appointmentTime',
    'durationHours',
    'durationMinutes',
    'participantName',
    'summary',
    ...(statusVisible ? ['status'] : []),
  ];

  const properties = {
    ...(titleFieldVisible ? { title: { type: 'string', title: titleFieldTitle } } : {}),
    appointmentDate: { type: 'string', title: 'Date', format: 'date' },
    appointmentTime: { type: 'string', title: 'Time', format: 'time' },
    durationHours: { type: 'string', title: 'Duration', oneOf: buildDurationOptionsHours(8) },
    durationMinutes: { type: 'string', title: ' ', oneOf: buildDurationOptionsMinutes() },
    returnTab: { type: 'string', title: '' },
    returnSearch: { type: 'string', title: '' },
    returnFilter: { type: 'string', title: '' },
    participantName: { type: 'string', title: 'Participant' },
    // Hidden fields: selected contact identity
    participantContactId: { type: 'string', title: '' },
    participantContactType: { type: 'string', title: '' },
    // Hidden field: multi-selected contacts (normalized list)
    participantContacts: { type: 'array', title: '' },
    appointmentSelectParticipantButton: { type: 'string', title: 'Search' },
    summary: { type: 'string', title: 'Summary/Description' },
    ...(statusVisible
      ? {
        status: {
          type: 'string',
          title: 'Status',
          oneOf: statusOneOf,
        },
      }
      : {}),
  };

  const uiOrder = [
    ...(titleFieldVisible ? ['title'] : []),
    'appointmentDate',
    'appointmentTime',
    'durationHours',
    'durationMinutes',
    'summary',
    'participantName',
    'appointmentSelectParticipantButton',
    'returnTab',
    'returnSearch',
    'returnFilter',
    'participantContactId',
    'participantContactType',
    'participantContacts',
    ...(statusVisible ? ['status'] : []),
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
      appointmentDate: { 'ui:widget': 'date' },
      appointmentTime: { 'ui:widget': 'time' },
      durationHours: {
        'ui:widget': 'select',
        'ui:options': { grid: { xs: 6, sm: 6 } },
      },
      durationMinutes: {
        'ui:widget': 'select',
        'ui:label': false,
        'ui:options': { grid: { xs: 6, sm: 6 } },
      },
      ...(titleFieldVisible
        ? {
          title: {
            'ui:placeholder': titleFieldTitle,
          },
        }
        : {}),
      ...(statusVisible
        ? {
          status: { 'ui:widget': 'select' },
        }
        : {}),
      returnTab: { 'ui:widget': 'hidden' },
      returnSearch: { 'ui:widget': 'hidden' },
      returnFilter: { 'ui:widget': 'hidden' },
      participantContactId: { 'ui:widget': 'hidden' },
      participantContactType: { 'ui:widget': 'hidden' },
      participantContacts: { 'ui:widget': 'hidden' },
      // Try to render a compact "Search" button inline to the right of Participant.
      // If the embeddable build ignores grid hints, it will still render as a smaller button.
      participantName: {
        'ui:readonly': true,
        'ui:placeholder': 'Select a contact',
        'ui:options': { grid: { xs: 8, sm: 8 } },
      },
      appointmentSelectParticipantButton: {
        'ui:field': 'button',
        'ui:variant': 'plain',
        'ui:fullWidth': false,
        'ui:options': { grid: { xs: 4, sm: 4 } },
      },
      summary: {
        'ui:widget': 'textarea',
        'ui:help': 'Description',
      },
    },
    formData: merged,
  };
}

async function submitAppointmentCreate({ manifest, jwtToken, formData }) {
  const startTimeUtc = toUtcIsoFromLocalDateTime({
    date: formData?.appointmentDate,
    time: formData?.appointmentTime,
  });
  const durationMinutesTotal =
    (Number(formData?.durationHours ?? 0) * 60) + (Number(formData?.durationMinutes ?? 0));

  const participantContactsRaw = Array.isArray(formData?.participantContacts)
    ? formData.participantContacts
    : [];
  const participantContacts = participantContactsRaw
    .map((c) => ({
      id: String(c?.id ?? '').trim(),
      type: String(c?.type ?? '').trim(),
      name: String(c?.name ?? '').trim(),
    }))
    .filter((c) => c.id);

  const payload = {
    participantName: formData?.participantName ?? '',
    contactId: formData?.participantContactId ?? '',
    contactType: formData?.participantContactType ?? '',
    // Always pass contacts as an array (even when only one is selected).
    contacts: participantContacts.length > 0
      ? participantContacts
      : (formData?.participantContactId
        ? [{
          id: String(formData?.participantContactId ?? ''),
          type: String(formData?.participantContactType ?? ''),
          name: String(formData?.participantName ?? ''),
        }]
        : []),
    summary: formData?.summary ?? '',
    startTimeUtc,
    durationMinutes: Number.isFinite(durationMinutesTotal) ? durationMinutesTotal : 60,
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

