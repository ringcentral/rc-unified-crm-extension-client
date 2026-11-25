import authCore from '../../src/core/auth.ts';
import userCore from '../../src/core/user.ts';
import adminCore from '../../src/core/admin.ts';
import reportPage from '../../src/components/reportPage/reportPage.ts';
import calldownPage from '../../src/components/calldownPage.ts';
import adminPage from '../../src/components/admin/adminPage.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/auth.ts', () => ({
  default: {
    apiKeyLogin: vi.fn(),
    checkAuth: vi.fn(),
    onAuthCallback: vi.fn(),
  },
}));

vi.mock('../../src/core/user.ts', () => ({
  default: {
    updateSSCLToken: vi.fn(),
    getShowUserReportTabSetting: vi.fn(),
    getShowCalldownTabSetting: vi.fn(),
    getUserReportStats: vi.fn(),
    refreshUserSettings: vi.fn(),
  },
}));

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    refreshAdminSettings: vi.fn(),
    authAppConnectServer: vi.fn(),
  },
}));

vi.mock('../../src/components/reportPage/reportPage.ts', () => ({
  default: {
    getReportsPageRender: vi.fn(),
  },
}));

vi.mock('../../src/components/calldownPage.ts', () => ({
  default: {
    getCalldownPageWithRecords: vi.fn(),
  },
}));

vi.mock('../../src/components/admin/adminPage.ts', () => ({
  default: {
    getAdminPageRender: vi.fn(),
  },
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadInsightlyHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/insightlyAuth.ts');
}

const insightlyHostname = 'crm.insightly.com';
const insightlyOrigin = `https://${insightlyHostname}`;
const insightlySender = {
  url: `${insightlyOrigin}/Users/UserSettings`,
  origin: insightlyOrigin,
  frameId: 0,
  tab: { id: 42 },
};

async function startInsightlyImport() {
  const { onEvent } = await import('../../src/eventHandlers/rc-post-message-request/custom-button-click/auth/insightlyGetApiKey.ts');
  vi.mocked(chrome.windows.create).mockResolvedValueOnce({ id: 12, tabs: [insightlySender.tab] });
  await onEvent({ platformInfo: { hostname: insightlyHostname } });
}

describe('CRM-specific callback handlers', () => {
  beforeEach(() => {
    vi.mocked(authCore.apiKeyLogin).mockReset();
    vi.mocked(authCore.checkAuth).mockReset();
    vi.mocked(authCore.onAuthCallback).mockReset();
    vi.mocked(userCore.updateSSCLToken).mockReset();
    vi.mocked(userCore.getShowUserReportTabSetting).mockReset().mockReturnValue({
      value: false,
      readOnly: false,
      readOnlyReason: '',
    });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReset().mockReturnValue({
      value: false,
      readOnly: false,
      readOnlyReason: '',
    });
    vi.mocked(userCore.getUserReportStats).mockReset().mockResolvedValue({});
    vi.mocked(userCore.refreshUserSettings).mockReset().mockResolvedValue({});
    vi.mocked(adminCore.refreshAdminSettings).mockReset().mockResolvedValue({});
    vi.mocked(adminCore.authAppConnectServer).mockReset();
    vi.mocked(reportPage.getReportsPageRender).mockReset().mockReturnValue({ id: 'reportPage' });
    vi.mocked(calldownPage.getCalldownPageWithRecords).mockReset().mockResolvedValue({ id: 'calldownPage' });
    vi.mocked(adminPage.getAdminPageRender).mockReset().mockReturnValue({ id: 'adminPage' });
  });

  it('logs Insightly in with API key credentials and closes the API-key modal', async () => {
    vi.mocked(getManifest).mockReset().mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        insightly: {
          name: 'insightly',
          useLicense: true,
        },
      },
    });
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'insightly', hostname: insightlyHostname });
    vi.mocked(authCore.apiKeyLogin).mockResolvedValueOnce('insightly-token');
    const handler = await loadInsightlyHandler();
    await startInsightlyImport();

    const message = {
      request: { apiKey: 'api-key-1', apiUrl: 'https://api.insightly.com/v3.1' },
      sender: insightlySender,
    };
    await handler.onMessage(message);
    await handler.onMessage(message);

    expect(authCore.apiKeyLogin).toHaveBeenCalledTimes(1);
    expect(authCore.apiKeyLogin).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      apiKey: 'api-key-1',
      formData: {
        apiUrl: 'https://api.insightly.com/v3.1',
      },
      useLicense: true,
    });
    expect(userCore.updateSSCLToken).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: { name: 'insightly', useLicense: true },
      token: 'insightly-token',
    });
    expect(readStorage().crmAuthed).toBe(true);
    expect(window.postMessage).toHaveBeenCalledWith({
      type: 'rc-apiKey-input-modal-close',
      platform: 'insightly',
    }, '*');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'openPopupWindow' });
  });

  it('ignores unsolicited and invalid Insightly imports without changing the existing CRM session', async () => {
    seedStorage({ crmAuthed: true, rcUnifiedCrmExtJwt: 'existing-token' });
    const handler = await loadInsightlyHandler();
    const request = { apiKey: 'test-key', apiUrl: 'https://api.insightly.com' };
    await handler.onMessage({ request, sender: insightlySender });
    await startInsightlyImport();

    for (const sender of [
      { ...insightlySender, tab: { id: 43 } },
      { ...insightlySender, frameId: 1 },
      { ...insightlySender, origin: 'null' },
      { ...insightlySender, url: 'https://other.example.test/Users/UserSettings' },
      { ...insightlySender, url: 'https://another.insightly.com/Users/UserSettings', origin: 'https://another.insightly.com' },
    ]) {
      await handler.onMessage({ request, sender });
    }
    await handler.onMessage({ request: { ...request, apiUrl: 'https://api.example.test' }, sender: insightlySender });

    expect(authCore.apiKeyLogin).not.toHaveBeenCalled();
    expect(userCore.updateSSCLToken).not.toHaveBeenCalled();
    expect(readStorage()).toMatchObject({ crmAuthed: true, rcUnifiedCrmExtJwt: 'existing-token' });
  });

  it('ignores an import after its authorization expires', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
    const handler = await loadInsightlyHandler();
    await startInsightlyImport();
    clock.mockReturnValue(10 * 60 * 1000);

    await handler.onMessage({
      request: { apiKey: 'test-key', apiUrl: 'https://api.insightly.com' },
      sender: insightlySender,
    });

    expect(authCore.apiKeyLogin).not.toHaveBeenCalled();
  });

  it('registers Insightly report, calldown, and admin pages after a successful API-key login', async () => {
    seedStorage({
      userSettings: {
        showReports: { value: true },
      },
    });
    vi.mocked(getManifest).mockReset().mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        insightly: {
          name: 'insightly',
          useLicense: true,
        },
      },
    });
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'insightly', hostname: insightlyHostname });
    vi.mocked(authCore.apiKeyLogin).mockResolvedValueOnce('insightly-token');
    vi.mocked(userCore.getShowUserReportTabSetting).mockReturnValue({
      value: true,
      readOnly: false,
      readOnlyReason: '',
    });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReturnValue({
      value: true,
      readOnly: false,
      readOnlyReason: '',
    });
    vi.mocked(userCore.getUserReportStats).mockResolvedValueOnce({ loggedCalls: 3 });
    vi.mocked(adminCore.refreshAdminSettings).mockResolvedValueOnce({ adminSettings: { enabled: true } });
    const handler = await loadInsightlyHandler();
    await startInsightlyImport();

    await handler.onMessage({
      request: {
        apiKey: 'api-key-2',
        apiUrl: 'https://api.na1.insightly.com/v3.1/',
      },
      sender: insightlySender,
    });

    expect(reportPage.getReportsPageRender).toHaveBeenCalledWith({
      userStats: { loggedCalls: 3 },
      userSettings: {
        showReports: { value: true },
      },
    });
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith({
      manifest: {
        serverUrl: 'https://server.example',
        platforms: {
          insightly: {
            name: 'insightly',
            useLicense: true,
          },
        },
      },
      filterStatus: 'All',
      userSettings: {
        showReports: { value: true },
      },
    });
    expect(adminPage.getAdminPageRender).toHaveBeenCalledWith({
      platform: {
        name: 'insightly',
        useLicense: true,
      },
    });
    expect(adminCore.authAppConnectServer).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'insightly-token',
    });
    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({});
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: { id: 'reportPage' },
        }),
      }),
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: { id: 'calldownPage' },
        }),
      }),
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: { id: 'adminPage' },
        }),
      }),
    ]));
  });
});
