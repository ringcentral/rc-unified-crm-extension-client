type UnknownRecord = Record<string, unknown>;

interface RawAttendeeObject extends UnknownRecord {
  id?: unknown;
  const?: unknown;
  name?: unknown;
  title?: unknown;
  type?: unknown;
  contactType?: unknown;
}

type RawAttendee = RawAttendeeObject | string | number | null | undefined;

export interface NormalizedAttendee {
  id: string;
  name: string;
  type: string;
}

interface RawAppointment extends UnknownRecord {
  thirdPartyAppointmentId?: unknown;
  id?: unknown;
  externalId?: unknown;
  attendees?: RawAttendee | RawAttendee[];
  attendeeIds?: RawAttendee | RawAttendee[];
  participantName?: unknown;
  title?: unknown;
  summary?: unknown;
  description?: unknown;
  startTimeUtc?: unknown;
  startTime?: unknown;
  start?: unknown;
  when?: unknown;
  durationMinutes?: unknown;
  duration?: unknown;
  status?: unknown;
}

export interface CanonicalAppointment {
  thirdPartyAppointmentId: string;
  id: string;
  title: string;
  description: string;
  startTimeUtc: unknown;
  durationMinutes: number;
  status: string;
  attendees: NormalizedAttendee[];
  participantName: string;
}

interface AppointmentsListContextPayload {
  body?: {
    button?: {
      page?: {
        formData?: UnknownRecord;
      };
      formData?: UnknownRecord;
    };
    page?: {
      formData?: UnknownRecord;
    };
    formData?: UnknownRecord;
  };
}

function toNonEmptyString(value: unknown): string {
  const s = String(value ?? '').trim();
  return s ? s : '';
}

export function normalizeAttendees(raw?: RawAttendee | RawAttendee[]): NormalizedAttendee[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item): NormalizedAttendee | null => {
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
    .filter((item): item is NormalizedAttendee => Boolean(item));
}

export function formatAttendeeNames(
  attendees?: Array<Partial<NormalizedAttendee> | null | undefined>,
): string {
  const names = (attendees || []).map((a) => toNonEmptyString(a?.name)).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

export function normalizeAppointmentId(appointment?: RawAppointment | null): string {
  const thirdPartyAppointmentIdRaw = appointment?.thirdPartyAppointmentId ?? '';
  const thirdPartyAppointmentId =
    thirdPartyAppointmentIdRaw && String(thirdPartyAppointmentIdRaw).toUpperCase() !== 'N/A'
      ? String(thirdPartyAppointmentIdRaw)
      : '';
  return thirdPartyAppointmentId || String(appointment?.id ?? appointment?.externalId ?? '');
}

export function toCanonicalAppointment(rawAppointment?: RawAppointment | null): CanonicalAppointment {
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

export function extractAppointmentsListContext(data?: AppointmentsListContextPayload | null) {
  const formData =
    data?.body?.button?.page?.formData ??
    data?.body?.page?.formData ??
    data?.body?.formData ??
    data?.body?.button?.formData ??
    {};

  const tab = String(formData?.tab ?? 'upcoming');
  const searchWithFilters = formData?.searchWithFilters && typeof formData.searchWithFilters === 'object'
    ? formData.searchWithFilters as UnknownRecord
    : {};

  return {
    tab,
    searchWithFilters: {
      search: String(searchWithFilters?.search ?? ''),
      filter: String(searchWithFilters?.filter ?? 'All'),
    },
  };
}

const appointmentUtils = {
  normalizeAttendees,
  formatAttendeeNames,
  normalizeAppointmentId,
  toCanonicalAppointment,
  extractAppointmentsListContext,
};

export default appointmentUtils;
