import adminCore from '../../src/core/admin.ts';
import authPage from '../../src/components/authPage.ts';
import managedAuthUserEditPage from '../../src/components/admin/managedAuthUserEditPage.ts';
import { getRcContactInfo, showNotification } from '../../src/lib/util.ts';
import handler from '../../src/eventHandlers/rc-post-message-request/custom-button-click/adminSettings/managedAuthOptions.ts';
import { seedStorage } from '../setup/storageHelpers';
import {
  clearManagedAuthOptionsCache,
  getCachedManagedAuthOptions,
  getManagedAuthOptionsContextKey,
  refreshManagedAuthUserOptions,
  setCachedManagedAuthOptions,
} from '../../src/service/managedAuthOptionsService.ts';

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    getManagedAuthOptions: vi.fn(),
  },
}));

vi.mock('../../src/components/authPage.ts', () => ({
  default: {
    getAuthPageRender: vi.fn(() => ({ id: 'authPage' })),
  },
}));

vi.mock('../../src/components/admin/managedAuthUserEditPage.ts', () => ({
  default: {
    getManagedAuthUserEditPageRender: vi.fn(() => ({ id: 'managedAuthUserEditPage' })),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcContactInfo: vi.fn(async () => []),
  showNotification: vi.fn(),
}));

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        auth: {
          apiKey: {
            page: {
              content: [
                { const: 'companyId', managed: true, managedScope: 'account' },
                {
                  const: 'crmUserId',
                  managed: true,
                  managedScope: 'user',
                  managedFieldType: 'dynamic',
                },
              ],
            },
          },
        },
      },
    },
  };
}

function data(formData: Record<string, any>) {
  return {
    body: {
      button: { formData },
    },
  };
}

describe('managed auth dynamic option button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearManagedAuthOptionsCache();
    seedStorage({
      'platform-info': {
        platformName: 'salesforce',
        connectorId: 'connector-1',
      },
    });
  });

  it('loads first-login options with transient account values and preserves form data', async () => {
    vi.mocked(adminCore.getManagedAuthOptions).mockResolvedValue([
      { value: 'crm-101', label: 'Ada Lovelace' },
    ]);
    const formData = { companyId: 'company-123', crmUserId: '' };

    await handler.onEvent({
      data: data(formData),
      manifest: manifest(),
      platformName: 'salesforce',
      fieldConst: 'crmUserId',
      mode: 'auth',
    });

    expect(adminCore.getManagedAuthOptions).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      fieldConst: 'crmUserId',
      accountValues: { companyId: 'company-123' },
    });
    expect(authPage.getAuthPageRender).toHaveBeenCalledWith(expect.objectContaining({
      formData,
      dynamicOptions: {
        crmUserId: [{ value: 'crm-101', label: 'Ada Lovelace' }],
      },
    }));
  });

  it('uses stored account values for the post-login user editor', async () => {
    seedStorage({
      'platform-info': { platformName: 'salesforce', connectorId: 'connector-1' },
      managedAuthSettings: { userFields: [], userValues: [] },
    });
    vi.mocked(getRcContactInfo).mockResolvedValue([
      { id: 'ext-1', name: 'Jane Smith', type: 'User' },
    ] as any);
    vi.mocked(adminCore.getManagedAuthOptions).mockResolvedValue([]);

    await handler.onEvent({
      data: data({ rcExtensionId: 'ext-1' }),
      manifest: manifest(),
      platformName: 'salesforce',
      fieldConst: 'crmUserId',
      mode: 'user',
    });

    expect(adminCore.getManagedAuthOptions).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      fieldConst: 'crmUserId',
    });
    expect(managedAuthUserEditPage.getManagedAuthUserEditPageRender).toHaveBeenCalledWith(
      expect.objectContaining({
        rcExtension: expect.objectContaining({ id: 'ext-1' }),
        dynamicOptions: { crmUserId: [] },
      }),
    );
  });

  it('shows connector errors without replacing the current page', async () => {
    vi.mocked(adminCore.getManagedAuthOptions).mockRejectedValue({
      response: { data: { error: 'CRM user list unavailable' } },
    });

    await handler.onEvent({
      data: data({ companyId: 'company-123' }),
      manifest: manifest(),
      platformName: 'salesforce',
      fieldConst: 'crmUserId',
      mode: 'auth',
    });

    expect(showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'CRM user list unavailable',
      ttl: 5000,
    });
    expect(authPage.getAuthPageRender).not.toHaveBeenCalled();
  });

  it('refreshes and caches every dynamic user field when user managed auth is opened', async () => {
    vi.mocked(adminCore.getManagedAuthOptions)
      .mockResolvedValueOnce([{ value: 'crm-101', label: 'Ada Lovelace' }])
      .mockResolvedValueOnce([{ value: 'team-1', label: 'Sales' }]);

    const result = await refreshManagedAuthUserOptions({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      connectorId: 'connector-1',
      userFields: [
        { const: 'apiKey', managed: true, managedScope: 'user', managedFieldType: 'input' },
        { const: 'crmUserId', managed: true, managedScope: 'user', managedFieldType: 'dynamic' },
        { const: 'teamId', managed: true, managedScope: 'user', managedFieldType: 'dynamic' },
      ],
    });

    expect(adminCore.getManagedAuthOptions).toHaveBeenCalledTimes(2);
    expect(adminCore.getManagedAuthOptions).toHaveBeenNthCalledWith(1, {
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      fieldConst: 'crmUserId',
    });
    expect(result).toEqual({
      dynamicOptions: {
        crmUserId: [{ value: 'crm-101', label: 'Ada Lovelace' }],
        teamId: [{ value: 'team-1', label: 'Sales' }],
      },
      errors: [],
    });
  });

  it('keeps the previous field list when an automatic refresh fails', async () => {
    const contextKey = getManagedAuthOptionsContextKey({
      platformName: 'salesforce',
      connectorId: 'connector-1',
      mode: 'user',
    });
    setCachedManagedAuthOptions(contextKey, {
      crmUserId: [{ value: 'crm-old', label: 'Previous user' }],
    });
    vi.mocked(adminCore.getManagedAuthOptions).mockRejectedValue(new Error('CRM unavailable'));

    const result = await refreshManagedAuthUserOptions({
      serverUrl: 'https://server.example',
      platformName: 'salesforce',
      connectorId: 'connector-1',
      userFields: [{
        const: 'crmUserId',
        managed: true,
        managedScope: 'user',
        managedFieldType: 'dynamic',
      }],
    });

    expect(result.errors).toHaveLength(1);
    expect(getCachedManagedAuthOptions(contextKey)).toEqual({
      crmUserId: [{ value: 'crm-old', label: 'Previous user' }],
    });
  });
});
