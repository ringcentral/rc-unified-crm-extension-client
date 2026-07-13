import axios from 'axios';
import { loadModule } from '../helpers/loadModule';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

async function loadAppointmentService() {
  vi.resetModules();
  return loadModule('../../src/service/appointmentService.ts');
}

describe('appointmentService', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.patch).mockReset();
  });

  it('lists appointments with normalized query params and response shapes', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { items: [{ id: 'item-1' }] } })
      .mockResolvedValueOnce({ data: { data: { appointments: [{ id: 'appt-1' }] } } })
      .mockRejectedValueOnce(new Error('network'));
    const service = await loadAppointmentService();

    await expect(service.listAppointments({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      range: 'past',
      mineOnly: false,
      forceSync: true,
    })).resolves.toEqual([{ id: 'item-1' }]);
    await expect(service.listAppointments({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
    })).resolves.toEqual([{ id: 'appt-1' }]);
    await expect(service.listAppointments({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
    })).resolves.toEqual([]);

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://server.example/appointments', {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
      params: {
        range: 'past',
        mineOnly: 'false',
        forceSync: 'true',
      },
    });
  });

  it('normalizes additional appointment list response shapes and optional auth', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: [{ id: 'array-1' }] })
      .mockResolvedValueOnce({ data: { appointments: [{ id: 'appointments-1' }] } })
      .mockResolvedValueOnce({ data: { data: [{ id: 'data-array-1' }] } })
      .mockResolvedValueOnce({ data: { records: [{ id: 'records-1' }] } })
      .mockResolvedValueOnce({ data: { data: { items: [{ id: 'nested-items-1' }] } } })
      .mockResolvedValueOnce({ data: { data: { appointments: [{ id: 'nested-appointments-1' }] } } })
      .mockResolvedValueOnce({ data: null });
    const service = await loadAppointmentService();

    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([{ id: 'array-1' }]);
    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([{ id: 'appointments-1' }]);
    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([{ id: 'data-array-1' }]);
    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([{ id: 'records-1' }]);
    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([{ id: 'nested-items-1' }]);
    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([{ id: 'nested-appointments-1' }]);
    await expect(service.listAppointments({ serverUrl: 'https://server.example' })).resolves.toEqual([]);

    expect(axios.get).toHaveBeenNthCalledWith(1, 'https://server.example/appointments', {
      params: {
        range: 'upcoming',
        mineOnly: 'true',
        forceSync: 'false',
      },
    });
  });

  it('uses confirm and cancel endpoints before generic status fallback', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { status: 'confirmed' } })
      .mockResolvedValueOnce({ data: { status: 'canceled' } })
      .mockResolvedValueOnce({ data: { status: 'tentative' } });
    const service = await loadAppointmentService();

    await expect(service.updateAppointmentStatus({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
      status: 'confirmed',
    })).resolves.toEqual({ status: 'confirmed' });
    await expect(service.updateAppointmentStatus({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
      status: 'cancelled',
    })).resolves.toEqual({ status: 'canceled' });
    await expect(service.updateAppointmentStatus({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
      status: 'tentative',
    })).resolves.toEqual({ status: 'tentative' });

    expect(axios.post).toHaveBeenNthCalledWith(1, 'https://server.example/appointments/appt-1/confirm', null, {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
    expect(axios.post).toHaveBeenNthCalledWith(2, 'https://server.example/appointments/appt-1/cancel', null, {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
    expect(axios.post).toHaveBeenNthCalledWith(3, 'https://server.example/appointments/appt-1/status', { status: 'tentative' }, {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
  });

  it('falls back from canonical status routes to generic status updates', async () => {
    vi.mocked(axios.post)
      .mockRejectedValueOnce(new Error('confirm unavailable'))
      .mockResolvedValueOnce({ data: { status: 'confirmed-via-generic' } })
      .mockRejectedValueOnce(new Error('generic unavailable'));
    const service = await loadAppointmentService();

    await expect(service.updateAppointmentStatus({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
      status: 'confirmed',
    })).resolves.toEqual({ status: 'confirmed-via-generic' });
    await expect(service.updateAppointmentStatus({
      serverUrl: 'https://server.example',
      appointmentId: 'appt-1',
      status: '',
    })).resolves.toBeNull();

    expect(axios.post).toHaveBeenNthCalledWith(2, 'https://server.example/appointments/appt-1/status', { status: 'confirmed' }, {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
    expect(axios.post).toHaveBeenNthCalledWith(3, 'https://server.example/appointments/appt-1/status', { status: '' }, {});
  });

  it('updates, refreshes, and creates appointments with null-on-error behavior', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(axios.patch).mockResolvedValueOnce({ data: { id: 'updated' } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { id: 'refreshed' } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { id: 'created' } }).mockRejectedValueOnce(new Error('network'));
    const service = await loadAppointmentService();

    await expect(service.updateAppointment({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
      patch: { title: 'Updated' },
    })).resolves.toEqual({ id: 'updated' });
    await expect(service.refreshAppointment({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appt-1',
    })).resolves.toEqual({ id: 'refreshed' });
    await expect(service.createAppointment({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      payload: { title: 'New' },
    })).resolves.toEqual({ id: 'created' });
    await expect(service.createAppointment({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      payload: { title: 'New' },
    })).resolves.toBeNull();

    expect(axios.patch).toHaveBeenCalledWith('https://server.example/appointments/appt-1', { title: 'Updated' }, {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
    expect(axios.get).toHaveBeenCalledWith('https://server.example/appointments/appt-1/refresh', {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
    expect(axios.post).toHaveBeenNthCalledWith(1, 'https://server.example/appointments', { title: 'New' }, {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
    });
  });
});
