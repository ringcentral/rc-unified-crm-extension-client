import axios from 'axios';
import { RcAPI } from '../../src/lib/rcAPI.js';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('RcAPI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gets user info hashes and interop codes', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { hashedExtensionId: 'hash-1' } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { code: 'interop-code' } });
    const rcAPI = new RcAPI();

    await expect(rcAPI.getUserInfo({
      serverUrl: 'https://server.example',
      extensionId: 'extension-1',
      accountId: 'account-1',
    })).resolves.toEqual({ hashedExtensionId: 'hash-1' });
    await expect(rcAPI.getInteropCode({
      rcAccessToken: 'access-token',
      rcClientId: 'client-1',
    })).resolves.toBe('interop-code');

    expect(axios.get).toHaveBeenCalledWith('https://server.example/userInfoHash?extensionId=extension-1&accountId=account-1');
    expect(axios.post).toHaveBeenCalledWith('https://platform.ringcentral.com/restapi/v1.0/interop/generate-code', {
      clientId: 'client-1',
    }, {
      headers: {
        Authorization: 'Bearer access-token',
      },
    });
  });

  it('paginates call logs and supports custom date ranges', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 'call-1' }], navigation: { nextPage: true } } })
      .mockResolvedValueOnce({ data: { records: [{ id: 'call-2' }], navigation: {} } })
      .mockResolvedValueOnce({ data: { records: [{ id: 'call-3' }], navigation: {} } });
    const rcAPI = new RcAPI();

    await expect(rcAPI.getRcCallLog({
      rcAccessToken: 'access-token',
      dateRange: 'Last 24 hours',
    })).resolves.toEqual({
      records: [{ id: 'call-1' }, { id: 'call-2' }],
    });
    await expect(rcAPI.getRcCallLog({
      rcAccessToken: 'access-token',
      dateRange: 'Select date range...',
      customStartDate: '2026-07-01T00:00:00Z',
      customEndDate: '2026-07-02T00:00:00Z',
    })).resolves.toEqual({
      records: [{ id: 'call-3' }],
    });

    expect(axios.get.mock.calls[0][0]).toContain('dateFrom=2026-07-02T12:00:00.000Z');
    expect(axios.get.mock.calls[2][0]).toContain('dateFrom=2026-07-01T00:00:00Z&dateTo=2026-07-02T00:00:00Z');
  });

  it('paginates SMS logs for supported date ranges', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 'sms-1' }], navigation: { nextPage: true } } })
      .mockResolvedValueOnce({ data: { records: [{ id: 'sms-2' }], navigation: {} } });
    const rcAPI = new RcAPI();

    await expect(rcAPI.getRcSMSLog({
      rcAccessToken: 'access-token',
      dateRange: 'Last 7 days',
    })).resolves.toEqual({
      records: [{ id: 'sms-1' }, { id: 'sms-2' }],
    });

    expect(axios.get.mock.calls[0][0]).toContain('message-store?dateFrom=2026-06-26T12:00:00.000Z');
    expect(axios.get.mock.calls[1][0]).toContain('page=2');
  });

  it('loads, normalizes, and caches RingCentral user extensions', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: {
          records: [
            { id: 'user-1', type: 'User', name: 'Direct Name', extensionNumber: '101', contact: { email: 'user1@example.test' } },
          ],
          navigation: { nextPageUrl: 'next' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          records: [
            { id: 'user-2', type: 'User', contact: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.test' } },
            { id: 'site-1', type: 'Site', name: 'Site' },
          ],
          navigation: {},
        },
      });
    const rcAPI = new RcAPI();

    await expect(rcAPI.getRcExtensionList({ rcAccessToken: 'access-token' })).resolves.toEqual([
      { id: 'user-1', name: 'Direct Name', extensionNumber: '101', email: 'user1@example.test' },
      { id: 'user-2', name: 'Jane Doe', extensionNumber: '', email: 'jane@example.test' },
    ]);
    await expect(rcAPI.getRcExtensionList({ rcAccessToken: 'access-token' })).resolves.toHaveLength(2);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
