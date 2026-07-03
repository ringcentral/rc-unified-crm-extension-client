import authCore from '../../src/core/auth.js';
import userCore from '../../src/core/user.js';
import adminCore from '../../src/core/admin.js';
import reportPage from '../../src/components/reportPage/reportPage.js';
import calldownPage from '../../src/components/calldownPage.js';
import adminPage from '../../src/components/admin/adminPage.js';
import { getManifest } from '../../src/service/manifestService.js';
import { getPlatformInfo } from '../../src/service/platformService.js';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/auth.js', () => ({
  default: {
    apiKeyLogin: vi.fn(),
    checkAuth: vi.fn(),
    onAuthCallback: vi.fn(),
  },
}));

vi.mock('../../src/core/user.js', () => ({
  default: {
    updateSSCLToken: vi.fn(),
    getShowUserReportTabSetting: vi.fn(),
    getShowCalldownTabSetting: vi.fn(),
    getUserReportStats: vi.fn(),
    refreshUserSettings: vi.fn(),
  },
}));

vi.mock('../../src/core/admin.js', () => ({
  default: {
    refreshAdminSettings: vi.fn(),
    authAppConnectServer: vi.fn(),
  },
}));

vi.mock('../../src/components/reportPage/reportPage.js', () => ({
  default: {
    getReportsPageRender: vi.fn(),
  },
}));

vi.mock('../../src/components/calldownPage.js', () => ({
  default: {
    getCalldownPageWithRecords: vi.fn(),
  },
}));

vi.mock('../../src/components/admin/adminPage.js', () => ({
  default: {
    getAdminPageRender: vi.fn(),
  },
}));

vi.mock('../../src/service/manifestService.js', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.js', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadInsightlyHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/insightlyAuth.js');
}

async function loadPipedriveHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/pipedriveCallbackUri.js');
}

describe('CRM-specific callback handlers', () => {
  beforeEach(() => {
    vi.mocked(authCore.apiKeyLogin).mockReset();
    vi.mocked(authCore.checkAuth).mockReset();
    vi.mocked(authCore.onAuthCallback).mockReset();
    vi.mocked(userCore.updateSSCLToken).mockReset();
    vi.mocked(userCore.getShowUserReportTabSetting).mockReset().mockReturnValue({ value: false });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReset().mockReturnValue({ value: false });
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
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'insightly' });
    vi.mocked(authCore.apiKeyLogin).mockResolvedValueOnce('insightly-token');
    const handler = await loadInsightlyHandler();

    await handler.onMessage({
      request: {
        apiKey: 'api-key-1',
        apiUrl: 'https://insightly.example',
      },
      sendResponse: vi.fn(),
    });

    expect(authCore.apiKeyLogin).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      apiKey: 'api-key-1',
      formData: {
        apiUrl: 'https://insightly.example',
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
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'insightly' });
    vi.mocked(authCore.apiKeyLogin).mockResolvedValueOnce('insightly-token');
    vi.mocked(userCore.getShowUserReportTabSetting).mockReturnValue({ value: true });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReturnValue({ value: true });
    vi.mocked(userCore.getUserReportStats).mockResolvedValueOnce({ loggedCalls: 3 });
    vi.mocked(adminCore.refreshAdminSettings).mockResolvedValueOnce({ adminSettings: { enabled: true } });
    const handler = await loadInsightlyHandler();

    await handler.onMessage({
      request: {
        apiKey: 'api-key-2',
        apiUrl: 'https://insightly.example',
      },
      sendResponse: vi.fn(),
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

  it('short-circuits Pipedrive callback forwarding when CRM is already authenticated', async () => {
    vi.mocked(authCore.checkAuth).mockResolvedValueOnce(true);
    const sendResponse = vi.fn();
    const handler = await loadPipedriveHandler();

    await handler.onMessage({
      request: { pipedriveCallbackUri: 'https://pipedrive.example/callback?code=abc' },
      sendResponse,
    });

    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    expect(authCore.onAuthCallback).not.toHaveBeenCalled();
  });

  it('forwards Pipedrive callback URI with platform state and notifies the runtime', async () => {
    seedStorage({ userSettings: {} });
    vi.mocked(authCore.checkAuth).mockResolvedValueOnce(false);
    vi.mocked(authCore.onAuthCallback).mockResolvedValueOnce('pipedrive-token');
    vi.mocked(getManifest).mockReset().mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        pipedrive: {
          name: 'pipedrive',
          useLicense: false,
        },
      },
    });
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'pipedrive' });
    const handler = await loadPipedriveHandler();

    await handler.onMessage({
      request: { pipedriveCallbackUri: 'https://pipedrive.example/callback?code=abc' },
      sendResponse: vi.fn(),
    });

    expect(authCore.onAuthCallback).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      callbackUri: 'https://pipedrive.example/callback?code=abc&state=platform=pipedrive',
      useLicense: false,
    });
    expect(userCore.updateSSCLToken).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: { name: 'pipedrive', useLicense: false },
      token: 'pipedrive-token',
    });
    expect(readStorage().crmAuthed).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'pipedriveAltAuthDone' });
  });

  it('registers Pipedrive report, calldown, and admin pages after callback auth', async () => {
    const pipedriveManifest = {
      serverUrl: 'https://server.example',
      platforms: {
        pipedrive: {
          name: 'pipedrive',
          useLicense: false,
        },
      },
    };
    seedStorage({
      userSettings: {
        showReports: { value: true },
      },
    });
    vi.mocked(authCore.checkAuth).mockResolvedValueOnce(false);
    vi.mocked(authCore.onAuthCallback).mockResolvedValueOnce('pipedrive-token-2');
    vi.mocked(getManifest).mockReset().mockResolvedValue(pipedriveManifest);
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'pipedrive' });
    vi.mocked(userCore.getShowUserReportTabSetting).mockReturnValue({ value: true });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReturnValue({ value: true });
    vi.mocked(userCore.getUserReportStats).mockResolvedValueOnce({ loggedCalls: 5 });
    vi.mocked(adminCore.refreshAdminSettings).mockResolvedValueOnce({
      adminSettings: { enabled: true },
    });
    const handler = await loadPipedriveHandler();

    await handler.onMessage({
      request: { pipedriveCallbackUri: 'https://pipedrive.example/callback?code=def' },
      sendResponse: vi.fn(),
    });

    expect(reportPage.getReportsPageRender).toHaveBeenCalledWith({
      userStats: { loggedCalls: 5 },
      userSettings: {
        showReports: { value: true },
      },
    });
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith({
      manifest: pipedriveManifest,
      filterStatus: 'All',
      userSettings: {
        showReports: { value: true },
      },
    });
    expect(adminPage.getAdminPageRender).toHaveBeenCalledWith({
      platform: {
        name: 'pipedrive',
        useLicense: false,
      },
    });
    expect(adminCore.authAppConnectServer).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'pipedrive-token-2',
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
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'pipedriveAltAuthDone' });
  });

  it('continues Pipedrive callback flow when SSCL update and calldown registration fail', async () => {
    const ssclError = new Error('sscl failed');
    seedStorage({ userSettings: {} });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(authCore.checkAuth).mockResolvedValueOnce(false);
    vi.mocked(authCore.onAuthCallback).mockResolvedValueOnce('pipedrive-token-3');
    vi.mocked(getManifest).mockReset().mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        pipedrive: {
          name: 'pipedrive',
          useLicense: true,
        },
      },
    });
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'pipedrive' });
    vi.mocked(userCore.updateSSCLToken).mockRejectedValueOnce(ssclError);
    vi.mocked(userCore.getShowCalldownTabSetting).mockReturnValue({ value: true });
    vi.mocked(calldownPage.getCalldownPageWithRecords).mockRejectedValueOnce(new Error('calldown failed'));
    const handler = await loadPipedriveHandler();

    await expect(handler.onMessage({
      request: { pipedriveCallbackUri: 'https://pipedrive.example/callback?code=ghi' },
      sendResponse: vi.fn(),
    })).resolves.toBeUndefined();

    expect(console.log).toHaveBeenCalledWith(ssclError);
    expect(readStorage().crmAuthed).toBe(true);
    expect(adminCore.refreshAdminSettings).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'pipedriveAltAuthDone' });
  });
});
