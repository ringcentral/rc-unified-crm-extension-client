import adminCore from '../../src/core/admin.ts';
import { showNotification } from '../../src/lib/util.ts';
import refreshAccountData from '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/refreshAccountData.ts';

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    getAccountData: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(),
}));

describe('refresh account data handler', () => {
  beforeEach(() => {
    vi.mocked(adminCore.getAccountData).mockReset();
    vi.mocked(showNotification).mockReset();
  });

  it('force refreshes each unique manifest account data key', async () => {
    vi.mocked(adminCore.getAccountData).mockResolvedValue({
      activityTypes: [{ const: 'call', title: 'Call' }],
    });

    await refreshAccountData.onEvent({
      manifest: { serverUrl: 'https://server.example' },
      platform: {
        adminSettings: [
          { accountDataKey: 'activityTypes' },
          { accountDataKey: 'activityTypes' },
          { accountDataKey: 'users' },
          { type: 'inputField' },
        ],
        page: {
          callLog: {
            additionalFields: [{
              accountDataKey: 'bullhornData',
              accountDataProperty: 'commentActionList',
            }],
          },
          newContact: {
            additionalFields: [{
              accountDataKey: 'bullhornData',
              accountDataPropertyByContactType: {
                Lead: 'leadStatuses',
                Candidate: 'candidateStatuses',
                Contact: 'contactStatuses',
              },
            }],
          },
        },
      },
    });

    expect(adminCore.getAccountData).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      keys: [
        'activityTypes',
        'users',
        'bullhornData',
      ],
      forceRefresh: true,
    });
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Account data refreshed.',
      ttl: 3000,
    });
  });

  it('reports when the platform has no account data to refresh', async () => {
    await refreshAccountData.onEvent({
      manifest: { serverUrl: 'https://server.example' },
      platform: { adminSettings: [{ type: 'inputField' }] },
    });

    expect(adminCore.getAccountData).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith({
      level: 'info',
      message: 'No account data to refresh for this platform.',
      ttl: 3000,
    });
  });

  it('shows an error notification when refresh fails', async () => {
    vi.mocked(adminCore.getAccountData).mockRejectedValue(new Error('CRM unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await refreshAccountData.onEvent({
      manifest: { serverUrl: 'https://server.example' },
      platform: { adminSettings: [{ accountDataKey: 'activityTypes' }] },
    });

    expect(consoleError).toHaveBeenCalledWith('Error refreshing account data:', expect.any(Error));
    expect(showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Failed to refresh account data. Please try again.',
      ttl: 3000,
    });
  });
});
