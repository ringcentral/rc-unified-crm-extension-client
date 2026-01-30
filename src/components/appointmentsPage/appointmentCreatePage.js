import { createAppointment } from '../../service/appointmentService';

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

function getAppointmentCreatePageRender() {
  const nowPlus30 = Date.now() + 30 * 60 * 1000;
  return {
    id: 'appointmentCreatePage',
    title: 'Create appointment',
    type: 'page',
    schema: {
      type: 'object',
      required: [],
      properties: {
        appointmentDate: { type: 'string', title: 'Date', format: 'date' },
        appointmentTime: { type: 'string', title: 'Time', format: 'time' },
        durationHours: { type: 'string', title: 'Duration', oneOf: buildDurationOptionsHours(8) },
        durationMinutes: { type: 'string', title: ' ', oneOf: buildDurationOptionsMinutes() },
        participantName: { type: 'string', title: 'Participant name' },
        summary: { type: 'string', title: 'Summary/Description' },
        status: {
          type: 'string',
          title: 'Status',
          oneOf: [
            { const: 'scheduled', title: 'Scheduled' },
            { const: 'confirmed', title: 'Confirmed' },
            { const: 'canceled', title: 'Canceled' },
          ],
        },
        appointmentCreateSaveButton: { type: 'string', title: 'Create' },
      },
    },
    uiSchema: {
      // keep date/time at top like Meetings
      'ui:order': [
        'appointmentDate',
        'appointmentTime',
        'durationHours',
        'durationMinutes',
        'participantName',
        'summary',
        'status',
        'appointmentCreateSaveButton',
      ],
      appointmentDate: { 'ui:widget': 'date' },
      appointmentTime: { 'ui:widget': 'time' },
      durationHours: { 'ui:widget': 'select' },
      durationMinutes: { 'ui:widget': 'select' },
      appointmentCreateSaveButton: { 'ui:field': 'button', 'ui:variant': 'contained', 'ui:fullWidth': true },
    },
    formData: {
      appointmentDate: toLocalDateValue(nowPlus30),
      appointmentTime: toLocalTimeValue(nowPlus30),
      durationHours: '1',
      durationMinutes: '0',
      participantName: '',
      summary: '',
      status: 'scheduled',
    },
  };
}

async function submitAppointmentCreate({ manifest, jwtToken, formData }) {
  const startTimeUtc = toUtcIsoFromLocalDateTime({
    date: formData?.appointmentDate,
    time: formData?.appointmentTime,
  });
  const durationMinutesTotal =
    (Number(formData?.durationHours ?? 0) * 60) + (Number(formData?.durationMinutes ?? 0));
  const payload = {
    participantName: formData?.participantName ?? '',
    summary: formData?.summary ?? '',
    startTimeUtc,
    durationMinutes: Number.isFinite(durationMinutesTotal) ? durationMinutesTotal : 60,
    status: formData?.status ?? 'scheduled',
  };
  return await createAppointment({
    serverUrl: manifest.serverUrl,
    jwtToken,
    payload,
  });
}

exports.getAppointmentCreatePageRender = getAppointmentCreatePageRender;
exports.submitAppointmentCreate = submitAppointmentCreate;

