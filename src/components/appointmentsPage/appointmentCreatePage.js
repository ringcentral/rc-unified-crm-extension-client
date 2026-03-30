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
    duration: 'PT1H',
    // Used to return to the same list view after create (no local cache).
    returnTab: 'upcoming',
    returnSearch: '',
    returnFilter: 'All',
    // Used by appointment participant search to optionally filter to contacts with email.
    emailMandatoryInAttendee: undefined,
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
    'duration',
    'participantName',
    'summary',
    ...(statusVisible ? ['status'] : []),
  ];

  const properties = {
    ...(titleFieldVisible ? { title: { type: 'string', title: titleFieldTitle } } : {}),
    appointmentDate: { type: 'string', title: 'Date', format: 'date' },
    appointmentTime: { type: 'string', title: 'Time', format: 'time' },
    duration: { type: 'string', title: 'Duration', format: 'duration' },
    returnTab: { type: 'string', title: '' },
    returnSearch: { type: 'string', title: '' },
    returnFilter: { type: 'string', title: '' },
    emailMandatoryInAttendee: { type: 'boolean', title: '' },
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
    'duration',
    'summary',
    'participantName',
    'appointmentSelectParticipantButton',
    'returnTab',
    'returnSearch',
    'returnFilter',
    'emailMandatoryInAttendee',
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
      // Render Time + Duration in a single row on desktop.
      appointmentTime: {
        'ui:widget': 'time',
        'ui:options': { grid: { xs: 12, sm: 4 } },
      },
      duration: {
        'ui:widget': 'duration',
        'ui:options': { grid: { xs: 12, sm: 8 } },
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
      emailMandatoryInAttendee: { 'ui:widget': 'hidden' },
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
  const durationMinutesTotal = durationMinutesFromIso(formData?.duration);
  const safeDurationMinutes = Number.isFinite(durationMinutesTotal) ? durationMinutesTotal : 60;

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

