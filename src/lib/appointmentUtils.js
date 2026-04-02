function toNonEmptyString(value) {
  const s = String(value ?? '').trim();
  return s ? s : '';
}

function normalizeAttendees(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'object') {
        const id = toNonEmptyString(item?.id ?? item?.const);
        if (!id) return null;
        return {
          id,
          name: toNonEmptyString(item?.name ?? item?.title),
          type: toNonEmptyString(item?.type ?? item?.contactType),
        };
      }
      const id = toNonEmptyString(item);
      if (!id) return null;
      return { id, name: '', type: '' };
    })
    .filter(Boolean);
}

function formatAttendeeNames(attendees) {
  const names = (attendees || []).map((a) => toNonEmptyString(a?.name)).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

function normalizeAppointmentId(appointment) {
  const thirdPartyAppointmentIdRaw = appointment?.thirdPartyAppointmentId ?? '';
  const thirdPartyAppointmentId =
    thirdPartyAppointmentIdRaw && String(thirdPartyAppointmentIdRaw).toUpperCase() !== 'N/A'
      ? String(thirdPartyAppointmentIdRaw)
      : '';
  return thirdPartyAppointmentId || String(appointment?.id ?? appointment?.externalId ?? '');
}

function toCanonicalAppointment(rawAppointment) {
  const appointmentId = normalizeAppointmentId(rawAppointment);
  const attendees = normalizeAttendees(rawAppointment?.attendees ?? rawAppointment?.attendeeIds);
  const participantName =
    toNonEmptyString(rawAppointment?.participantName) ||
    formatAttendeeNames(attendees) ||
    '';

  return {
    thirdPartyAppointmentId: String(appointmentId),
    id: String(appointmentId),
    title: toNonEmptyString(rawAppointment?.title ?? rawAppointment?.summary),
    description: toNonEmptyString(rawAppointment?.description),
    startTimeUtc: rawAppointment?.startTimeUtc ?? rawAppointment?.startTime ?? rawAppointment?.start ?? rawAppointment?.when ?? null,
    durationMinutes: Number(rawAppointment?.durationMinutes ?? rawAppointment?.duration ?? 0) || 0,
    status: toNonEmptyString(rawAppointment?.status) || 'scheduled',
    attendees,
    participantName,
  };
}

exports.normalizeAttendees = normalizeAttendees;
exports.formatAttendeeNames = formatAttendeeNames;
exports.normalizeAppointmentId = normalizeAppointmentId;
exports.toCanonicalAppointment = toCanonicalAppointment;

function extractAppointmentsListContext(data) {
  const formData =
    data?.body?.button?.page?.formData ??
    data?.body?.page?.formData ??
    data?.body?.formData ??
    data?.body?.button?.formData ??
    {};

  const tab = String(formData?.tab ?? 'upcoming');
  const searchWithFilters = formData?.searchWithFilters ?? {};

  return {
    tab,
    searchWithFilters: {
      search: String(searchWithFilters?.search ?? ''),
      filter: String(searchWithFilters?.filter ?? 'All'),
    },
  };
}

exports.extractAppointmentsListContext = extractAppointmentsListContext;
