import authCore from '../../src/core/auth.ts';
import userCore from '../../src/core/user.ts';
import adminCore from '../../src/core/admin.ts';
import reportPage from '../../src/components/reportPage/reportPage.ts';
import calldownPage from '../../src/components/calldownPage.ts';
import appointmentsPage from '../../src/components/appointmentsPage/appointmentsPage.ts';
import adminPage from '../../src/components/admin/adminPage.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/auth.ts', () => ({
  default: {
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

vi.mock('../../src/components/appointmentsPage/appointmentsPage.ts', () => ({
  default: {
    getAppointmentsPageRender: vi.fn(),
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

async function loadOauthCallbackHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/oauthCallBack.ts');
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
    vi.mocked(userCore.getShowUserReportTabSetting).mockReset().mockReturnValue({
      value: true,
      readOnly: false,
      readOnlyReason: '',
    });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReset().mockReturnValue({
      value: true,
      readOnly: false,
      readOnlyReason: '',
    });
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

  it('forwards RingCentral callbacks to the widget without clearing CRM JWT state', async () => {
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
    expect(readStorage().rcUnifiedCrmExtJwt).toBe('old-jwt');
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
