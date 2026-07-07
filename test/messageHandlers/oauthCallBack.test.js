import authCore from '../../src/core/auth.js';
import userCore from '../../src/core/user.js';
import adminCore from '../../src/core/admin.js';
import reportPage from '../../src/components/reportPage/reportPage.js';
import calldownPage from '../../src/components/calldownPage.js';
import appointmentsPage from '../../src/components/appointmentsPage/appointmentsPage.js';
import adminPage from '../../src/components/admin/adminPage.js';
import { getManifest } from '../../src/service/manifestService.js';
import { getPlatformInfo } from '../../src/service/platformService.js';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/auth.js', () => ({
  default: {
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

vi.mock('../../src/components/appointmentsPage/appointmentsPage.js', () => ({
  default: {
    getAppointmentsPageRender: vi.fn(),
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

async function loadOauthCallbackHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/oauthCallBack.js');
}

function mockManifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
        useLicense: true,
        page: {
          appointment: {
            supported: true,
            title: 'Appointments',
            showConfirm: true,
          },
        },
      },
    },
  };
}

describe('oauthCallBack message handler', () => {
  beforeEach(() => {
    vi.mocked(authCore.onAuthCallback).mockReset();
    vi.mocked(userCore.updateSSCLToken).mockReset();
    vi.mocked(userCore.getShowUserReportTabSetting).mockReset().mockReturnValue({ value: true });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReset().mockReturnValue({ value: true });
    vi.mocked(userCore.getUserReportStats).mockReset().mockResolvedValue({ totalCalls: 2 });
    vi.mocked(userCore.refreshUserSettings).mockReset().mockResolvedValue({});
    vi.mocked(adminCore.refreshAdminSettings).mockReset().mockResolvedValue({ adminSettings: { userSettings: {} } });
    vi.mocked(adminCore.authAppConnectServer).mockReset();
    vi.mocked(reportPage.getReportsPageRender).mockReset().mockReturnValue({ id: 'reportPage' });
    vi.mocked(calldownPage.getCalldownPageWithRecords).mockReset().mockResolvedValue({ id: 'calldownPage' });
    vi.mocked(appointmentsPage.getAppointmentsPageRender).mockReset().mockReturnValue({ id: 'appointmentsPage' });
    vi.mocked(adminPage.getAdminPageRender).mockReset().mockReturnValue({ id: 'adminPage' });
    vi.mocked(getManifest).mockReset().mockResolvedValue(mockManifest());
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
  });

  it('forwards RingCentral callbacks to the widget and clears old CRM JWT state', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'old-jwt' });
    const sendResponse = vi.fn();
    const handler = await loadOauthCallbackHandler();

    await handler.onMessage({
      request: {
        platform: 'rc',
        callbackUri: 'https://callback.example/rc?code=abc',
      },
      sendResponse,
    });

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-authorization-code',
        callbackUri: 'https://callback.example/rc?code=abc',
      },
      targetOrigin: '*',
    });
    expect(readStorage()).not.toHaveProperty('rcUnifiedCrmExtJwt');
    expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
  });

  it('completes third-party auth and registers enabled pages', async () => {
    seedStorage({ userSettings: { showCalldownTab: { value: true } } });
    vi.mocked(authCore.onAuthCallback).mockResolvedValueOnce('crm-jwt');
    const handler = await loadOauthCallbackHandler();

    await handler.onMessage({
      request: {
        platform: 'thirdParty',
        callbackUri: 'https://callback.example/crm?code=crm',
      },
      sendResponse: vi.fn(),
    });

    expect(authCore.onAuthCallback).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      callbackUri: 'https://callback.example/crm?code=crm',
      useLicense: true,
    });
    expect(userCore.updateSSCLToken).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: mockManifest().platforms.salesforce,
      token: 'crm-jwt',
    });
    expect(readStorage().crmAuthed).toBe(true);
    expect(getWidgetPostMessages().map(({ message }) => message.type)).toEqual(expect.arrayContaining([
      'rc-adapter-register-customized-page',
    ]));
    expect(reportPage.getReportsPageRender).toHaveBeenCalledWith({
      userStats: { totalCalls: 2 },
      userSettings: { showCalldownTab: { value: true } },
    });
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalled();
    expect(appointmentsPage.getAppointmentsPageRender).toHaveBeenCalledWith(expect.objectContaining({
      selectedTab: 'upcoming',
      appointmentTitle: 'Appointments',
    }));
    expect(adminCore.authAppConnectServer).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'crm-jwt',
    });
    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({});
  });

  it('reports an error and skips CRM state updates when third-party callback returns no token', async () => {
    vi.mocked(authCore.onAuthCallback).mockResolvedValueOnce(null);
    const sendResponse = vi.fn();
    const handler = await loadOauthCallbackHandler();

    await handler.onMessage({
      request: {
        platform: 'thirdParty',
        callbackUri: 'https://callback.example/crm?error=access_denied',
      },
      sendResponse,
    });

    expect(sendResponse).toHaveBeenNthCalledWith(1, { result: 'error' });
    expect(readStorage()).not.toHaveProperty('crmAuthed');
    expect(userCore.updateSSCLToken).not.toHaveBeenCalled();
    expect(adminCore.refreshAdminSettings).not.toHaveBeenCalled();
  });
});
