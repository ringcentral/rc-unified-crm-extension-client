import { updateAppointment } from '../../service/appointmentService';
import { formatAttendeeNames, normalizeAttendees } from '../../lib/appointmentUtils';

function singularizeAppointmentTitle(title) {
  const t = String(title || '').trim();
  if (!t) return 'Appointment';
  if (/appointments$/i.test(t)) return t.replace(/appointments$/i, 'Appointment');
  if (t.length > 1 && /s$/i.test(t)) return t.slice(0, -1);
  return t;
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

function getAppointmentEditPageRender({
  appointment,
  appointmentTitle = 'Appointments',
  titleFieldConfig,
} = {}) {
  const thirdPartyAppointmentIdRaw = appointment?.thirdPartyAppointmentId ?? '';
  const thirdPartyAppointmentId =
    thirdPartyAppointmentIdRaw && String(thirdPartyAppointmentIdRaw).toUpperCase() !== 'N/A'
      ? String(thirdPartyAppointmentIdRaw)
      : '';
  const id = thirdPartyAppointmentId || String(appointment?.id ?? appointment?.externalId ?? '');
  const titleFieldVisible = titleFieldConfig?.isVisible;
  const titleFieldTitle = String(titleFieldConfig?.value || 'Title');
  const attendees = normalizeAttendees(appointment?.attendees ?? appointment?.attendeeIds);
  const participantName =
    String(appointment?.participantName ?? '').trim() ||
    formatAttendeeNames(attendees) ||
    '';
  const start = appointment?.startTimeUtc ?? appointment?.startTime ?? appointment?.start ?? null;
  const durationMinutes = Number(appointment?.durationMinutes ?? appointment?.duration ?? 30) || 30;

  const entityTitle = singularizeAppointmentTitle(appointmentTitle);
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
        ...(titleFieldVisible ? { title: { type: 'string', title: titleFieldTitle } } : {}),
        participantName: { type: 'string', title: 'Participant' },
        summary: { type: 'string', title: 'Summary' },
        appointmentDate: { type: 'string', title: 'Date', format: 'date' },
        appointmentTime: { type: 'string', title: 'Time', format: 'time' },
        duration: { type: 'string', title: 'Duration', format: 'duration' },
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
      ...(titleFieldVisible
        ? {
          title: {
            'ui:placeholder': titleFieldTitle,
          },
        }
        : {}),
      participantName: { 'ui:readonly': true },
      summary: {
        'ui:widget': 'textarea',
      },
      'ui:order': [
        'thirdPartyAppointmentId',
        'returnTab',
        'returnSearch',
        'returnFilter',
        ...(titleFieldVisible ? ['title'] : []),
        'appointmentDate',
        'appointmentTime',
        'duration',
        'summary',
        'participantName',
      ],
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
    },
    formData: {
      thirdPartyAppointmentId: String(id),
      returnTab: String(appointment?.returnTab ?? 'upcoming'),
      returnSearch: String(appointment?.returnSearch ?? ''),
      returnFilter: String(appointment?.returnFilter ?? 'All'),
      ...(titleFieldVisible ? { title: appointment?.title ?? appointment?.subject ?? '' } : {}),
      participantName,
      summary: appointment?.summary ?? appointment?.description ?? '',
      appointmentDate: start ? toLocalDateValue(start) : '',
      appointmentTime: start ? toLocalTimeValue(start) : '',
      duration: durationIsoFromMinutes(durationMinutes),
    },
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
  const patch = {
    participantName: formData?.participantName ?? '',
    summary: formData?.summary ?? '',
    startTime,
    durationMinutes: safeDurationMinutes,
  };
  const title = String(formData?.title ?? '').trim();
  if (title) patch.title = title;
  return await updateAppointment({
    serverUrl: manifest.serverUrl,
    jwtToken,
    appointmentId,
    patch,
  });
}

exports.getAppointmentEditPageRender = getAppointmentEditPageRender;
exports.saveAppointmentEdits = saveAppointmentEdits;

