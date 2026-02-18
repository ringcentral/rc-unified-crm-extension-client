import { updateAppointment } from '../../service/appointmentService';

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

function getAppointmentEditPageRender({ appointment, appointmentTitle = 'Appointments' } = {}) {
  const thirdPartyAppointmentIdRaw = appointment?.thirdPartyAppointmentId ?? '';
  const thirdPartyAppointmentId =
    thirdPartyAppointmentIdRaw && String(thirdPartyAppointmentIdRaw).toUpperCase() !== 'N/A'
      ? String(thirdPartyAppointmentIdRaw)
      : '';
  const id = thirdPartyAppointmentId || String(appointment?.id ?? appointment?.externalId ?? '');
  const participantName =
    appointment?.participantName ??
    appointment?.customerName ??
    appointment?.attendeeName ??
    appointment?.contactName ??
    'Unknown';
  const start = appointment?.startTimeUtc ?? appointment?.startTime ?? appointment?.start ?? null;
  const durationMinutes = Number(appointment?.durationMinutes ?? appointment?.duration ?? 30) || 30;
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainderMinutes = durationMinutes % 60;
  const roundedMinutes = [0, 15, 30, 45].includes(durationRemainderMinutes) ? durationRemainderMinutes : 0;

  const entityTitle = singularizeAppointmentTitle(appointmentTitle);
  return {
    id: 'appointmentEditPage',
    title: `Edit ${entityTitle}`,
    type: 'page',
    schema: {
      type: 'object',
      required: [],
      properties: {
        participantName: { type: 'string', title: 'Participant' },
        summary: { type: 'string', title: 'Summary' },
        appointmentDate: { type: 'string', title: 'Date', format: 'date' },
        appointmentTime: { type: 'string', title: 'Time', format: 'time' },
        durationHours: { type: 'string', title: 'Duration', oneOf: buildDurationOptionsHours(8) },
        durationMinutes: { type: 'string', title: ' ', oneOf: buildDurationOptionsMinutes() },
      },
    },
    uiSchema: {
      // Use the embeddable page header submit button (top-right) like the call log page.
      submitButtonOptions: {
        submitText: 'Update',
      },
      participantName: { 'ui:readonly': true },
      'ui:order': [
        'thirdPartyAppointmentId',
        'participantName',
        'appointmentDate',
        'appointmentTime',
        'durationHours',
        'durationMinutes',
        'summary',
      ],
      appointmentDate: { 'ui:widget': 'date' },
      appointmentTime: { 'ui:widget': 'time' },
      durationHours: { 'ui:widget': 'select' },
      durationMinutes: { 'ui:widget': 'select' },
    },
    formData: {
      thirdPartyAppointmentId: String(id),
      participantName,
      summary: appointment?.summary ?? appointment?.description ?? '',
      appointmentDate: start ? toLocalDateValue(start) : '',
      appointmentTime: start ? toLocalTimeValue(start) : '',
      durationHours: String(durationHours),
      durationMinutes: String(roundedMinutes),
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
  const durationMinutesTotal =
    (Number(formData?.durationHours ?? 0) * 60) + (Number(formData?.durationMinutes ?? 0));
  const patch = {
    participantName: formData?.participantName ?? '',
    summary: formData?.summary ?? '',
    startTime,
    durationMinutes: Number.isFinite(durationMinutesTotal) ? durationMinutesTotal : 60,
  };
  return await updateAppointment({
    serverUrl: manifest.serverUrl,
    jwtToken,
    appointmentId,
    patch,
  });
}

exports.getAppointmentEditPageRender = getAppointmentEditPageRender;
exports.saveAppointmentEdits = saveAppointmentEdits;

