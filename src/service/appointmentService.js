import axios from 'axios';

// Lightweight client for the (future) Scheduling backend.
// Keep all API shape assumptions centralized here so UI code stays stable.

function normalizeAppointmentsResponse(data) {
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
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.appointments)) return data.data.appointments;
  return [];
}

async function listAppointments({ serverUrl, jwtToken, range = 'upcoming', mineOnly = true, forceSync = false }) {
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

async function updateAppointmentStatus({ serverUrl, jwtToken, appointmentId, status }) {
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

async function updateAppointment({ serverUrl, jwtToken, appointmentId, patch }) {
  try {
    const { data } = await axios.patch(`${serverUrl}/appointments/${appointmentId}`, patch, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

async function refreshAppointment({ serverUrl, jwtToken, appointmentId }) {
  try {
    const { data } = await axios.post(`${serverUrl}/appointments/${appointmentId}/refresh`, null, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

async function createAppointment({ serverUrl, jwtToken, payload }) {
  try {
    const { data } = await axios.post(`${serverUrl}/appointments`, payload, { params: { jwtToken } });
    return data;
  } catch (e) {
    return null;
  }
}

exports.listAppointments = listAppointments;
exports.updateAppointmentStatus = updateAppointmentStatus;
exports.updateAppointment = updateAppointment;
exports.refreshAppointment = refreshAppointment;
exports.createAppointment = createAppointment;

