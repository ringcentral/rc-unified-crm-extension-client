import axios from 'axios';

type AppointmentRecord = Record<string, unknown>;
type AppointmentListResponse =
  | AppointmentRecord[]
  | {
    items?: AppointmentRecord[];
    appointments?: AppointmentRecord[];
    data?: AppointmentRecord[] | {
      items?: AppointmentRecord[];
      appointments?: AppointmentRecord[];
    };
    records?: AppointmentRecord[];
  }
  | null
  | undefined;

interface AppointmentRequestBase {
  serverUrl: string;
  jwtToken: string;
}

interface ListAppointmentsOptions extends AppointmentRequestBase {
  range?: string;
  mineOnly?: boolean;
  forceSync?: boolean;
}

interface AppointmentIdOptions extends AppointmentRequestBase {
  appointmentId: string;
}

interface UpdateAppointmentStatusOptions extends AppointmentIdOptions {
  status: string;
}

interface UpdateAppointmentOptions extends AppointmentIdOptions {
  patch: AppointmentRecord;
}

interface CreateAppointmentOptions extends AppointmentRequestBase {
  payload: AppointmentRecord;
}

// Lightweight client for the (future) Scheduling backend.
// Keep all API shape assumptions centralized here so UI code stays stable.
function normalizeAppointmentsResponse(data: AppointmentListResponse): AppointmentRecord[] {
  // Backend response shapes we've seen/expect:
  // - { items: [...] }
  // - { appointments: [...] }
  // - { data: [...] }
  // - [...] (array)
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.records)) return data.records;
  // Some backends wrap again: { data: { items: [...] } }
  if (!Array.isArray(data?.data) && Array.isArray(data?.data?.items)) return data.data.items;
  if (!Array.isArray(data?.data) && Array.isArray(data?.data?.appointments)) return data.data.appointments;
  return [];
}

export async function listAppointments({
  serverUrl,
  jwtToken,
  range = 'upcoming',
  mineOnly = true,
  forceSync = false,
}: ListAppointmentsOptions): Promise<AppointmentRecord[]> {
  try {
    const { data } = await axios.get(`${serverUrl}/appointments`, {
      params: {
        jwtToken,
        range,
        mineOnly: mineOnly ? 'true' : 'false',
        forceSync: forceSync ? 'true' : 'false',
      },
    });
    return normalizeAppointmentsResponse(data);
  } catch (e) {
    return [];
  }
}

export async function updateAppointmentStatus({
  serverUrl,
  jwtToken,
  appointmentId,
  status,
}: UpdateAppointmentStatusOptions): Promise<unknown | null> {
  // Expect backend to accept either /confirm|/cancel or a generic status endpoint.
  // We try the canonical paths first; if they don't exist yet, fallback to a generic post.
  const normalized = String(status || '').toLowerCase();
  try {
    if (normalized === 'confirmed') {
      const { data } = await axios.post(`${serverUrl}/appointments/${appointmentId}/confirm`, null, { params: { jwtToken } });
      return data;
    }
    if (normalized === 'canceled' || normalized === 'cancelled') {
      const { data } = await axios.post(`${serverUrl}/appointments/${appointmentId}/cancel`, null, { params: { jwtToken } });
      return data;
    }
  } catch (e) {
    // continue to fallback
  }
  try {
    const { data } = await axios.post(`${serverUrl}/appointments/${appointmentId}/status`, { status: normalized }, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

export async function updateAppointment({
  serverUrl,
  jwtToken,
  appointmentId,
  patch,
}: UpdateAppointmentOptions): Promise<unknown | null> {
  try {
    const { data } = await axios.patch(`${serverUrl}/appointments/${appointmentId}`, patch, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

export async function refreshAppointment({
  serverUrl,
  jwtToken,
  appointmentId,
}: AppointmentIdOptions): Promise<unknown | null> {
  console.log('refreshAppointment', serverUrl, jwtToken, appointmentId);
  try {
    const { data } = await axios.get(`${serverUrl}/appointments/${appointmentId}/refresh`, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

export async function createAppointment({
  serverUrl,
  jwtToken,
  payload,
}: CreateAppointmentOptions): Promise<unknown | null> {
  try {
    const { data } = await axios.post(`${serverUrl}/appointments`, payload, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

const appointmentService = {
  listAppointments,
  updateAppointmentStatus,
  updateAppointment,
  refreshAppointment,
  createAppointment,
};

export default appointmentService;
