import axios from 'axios';
import authCore from '../../src/core/auth.ts';
import userCore from '../../src/core/user.ts';
import adminCore from '../../src/core/admin.ts';
import reportPage from '../../src/components/reportPage/reportPage.ts';
import calldownPage from '../../src/components/calldownPage.ts';
import appointmentsPage from '../../src/components/appointmentsPage/appointmentsPage.ts';
import releaseNotesPage from '../../src/components/releaseNotesPage.ts';
import pluginService from '../../src/service/pluginService.ts';
import logService from '../../src/service/logService.ts';
import { getManifest, getPlatformList } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { getRcInfo, setRcAdditionalSubmission, showNotification } from '../../src/lib/util.ts';
import { reset, identify, group, trackRcLogin, trackRcLogout } from '../../src/lib/analytics.ts';
import { RcAPI } from '../../src/lib/rcAPI.ts';
import { bullhornHeartbeat } from '../../src/misc/bullhorn.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const rcApiMocks = vi.hoisted(() => {
  const getUserInfo = vi.fn();
  return {
    getUserInfo,
    RcAPI: vi.fn(function RcAPI() {
      this.getUserInfo = getUserInfo;
    }),
  };
});

const axiosMock = vi.hoisted(() => ({
  defaults: {
    headers: {
      common: {},
    },
  },
}));

vi.mock('axios', () => ({
  default: axiosMock,
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
  getPlatformList: vi.fn(),
}));

vi.mock('../../src/core/auth.ts', () => ({
  default: {
    checkAndOpenPlatformSelectionPage: vi.fn(),
    apiKeyLogin: vi.fn(),
    setAuth: vi.fn(),
    isAdminManagedOAuthEnabled: vi.fn(),
    checkManagedOAuthBeforeCrmVisible: vi.fn(),
  },
}));

vi.mock('../../src/core/user.ts', () => ({
  default: {
    updateSSCLToken: vi.fn(),
    getShowUserReportTabSetting: vi.fn(),
    getShowCalldownTabSetting: vi.fn(),
    getUserReportStats: vi.fn(),
    refreshUserSettings: vi.fn(),
    refreshUserInfo: vi.fn(),
    preloadUserSettingsFromAdmin: vi.fn(),
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

vi.mock('../../src/components/releaseNotesPage.ts', () => ({
  default: {
    getReleaseNotesPageRender: vi.fn(),
  },
}));

vi.mock('../../src/lib/logUtil.ts', () => ({
  triggerPendingRecordingCheck: vi.fn(),
}));

vi.mock('../../src/misc/bullhorn.ts', () => ({
  bullhornHeartbeat: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(),
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
  getRcInfo: vi.fn(),
  setRcAdditionalSubmission: vi.fn(),
}));

vi.mock('../../src/lib/analytics.ts', () => ({
  reset: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
  trackRcLogin: vi.fn(),
  trackRcLogout: vi.fn(),
}));

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    refreshAdminSettings: vi.fn(),
  },
}));

vi.mock('../../src/service/logService.ts', () => ({
  default: {
    forceCallLogMatcherCheck: vi.fn(),
  },
}));

vi.mock('../../src/lib/rcAPI.ts', () => ({
  RcAPI: rcApiMocks.RcAPI,
}));

vi.mock('../../src/service/pluginService.ts', () => ({
  default: {
    checkAndUpdatePluginVersion: vi.fn(),
  },
}));

async function loadLoginStatusHandler() {
  vi.resetModules();
  return loadModule('../../src/eventHandlers/rc-login-status-notify.ts');
}

function appendWidgetContainer() {
  const widget = document.createElement('div');
  widget.id = 'rc-widget';
  document.body.appendChild(widget);
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    version: '1.7.35',
    author: { name: 'App Connect Team' },
    platforms: {
      salesforce: {
        name: 'salesforce',
        useLicense: true,
        page: {
          appointment: {
            supported: true,
            title: 'Service Visits',
            showConfirm: false,
          },
        },
      },
    },
  };
}

function rcInfo() {
  return {
    value: {
      cachedData: {
        extensionFeatures: {
          records: [{ id: 'SMSSending', available: true }],
        },
        extensionInfo: {
          id: 'extension-local',
          name: 'RC User',
          contact: { email: 'rc@example.test' },
          account: { id: 'account-local' },
        },
      },
    },
  };
}

function loggedInEventData() {
  return {
    loggedIn: true,
    loginNumber: '+16505550100',
    contractedCountryCode: 'US',
    features: {
      smartNote: true,
      ringSenseInsights: true,
      ringCX: false,
      sms: true,
    },
  };
}

async function notifyLoggedInWithCrmJwt() {
  seedStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    userSettings: { showAppointmentsTab: { value: true } },
  });
  const handler = await loadLoginStatusHandler();

  await handler.onEvent({
    data: loggedInEventData(),
  });
}

describe('rc-login-status-notify event handler', () => {
  beforeEach(() => {
    appendWidgetContainer();
    vi.spyOn(globalThis, 'setInterval').mockReturnValue(1);
    axios.defaults.headers.common = {};
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(getManifest).mockReset().mockResolvedValue(manifest());
    vi.mocked(getPlatformList).mockReset().mockResolvedValue([{ id: 'salesforce' }]);
    vi.mocked(authCore.checkAndOpenPlatformSelectionPage).mockReset();
    vi.mocked(authCore.apiKeyLogin).mockReset();
    vi.mocked(authCore.setAuth).mockReset();
    vi.mocked(authCore.isAdminManagedOAuthEnabled).mockReset().mockReturnValue(false);
    vi.mocked(authCore.checkManagedOAuthBeforeCrmVisible).mockReset();
    vi.mocked(userCore.getShowUserReportTabSetting).mockReset().mockReturnValue({ value: true });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReset().mockReturnValue({ value: true });
    vi.mocked(userCore.getUserReportStats).mockReset().mockResolvedValue({ calls: 4 });
    vi.mocked(userCore.refreshUserSettings).mockReset().mockResolvedValue({ refreshed: true });
    vi.mocked(userCore.refreshUserInfo).mockReset();
    vi.mocked(userCore.updateSSCLToken).mockReset();
    vi.mocked(userCore.preloadUserSettingsFromAdmin).mockReset();
    vi.mocked(reportPage.getReportsPageRender).mockReset().mockReturnValue({ id: 'reportPage' });
    vi.mocked(calldownPage.getCalldownPageWithRecords).mockReset().mockResolvedValue({ id: 'calldownPage' });
    vi.mocked(appointmentsPage.getAppointmentsPageRender).mockReset().mockReturnValue({ id: 'appointmentsPage' });
    vi.mocked(releaseNotesPage.getReleaseNotesPageRender).mockReset().mockResolvedValue(null);
    vi.mocked(pluginService.checkAndUpdatePluginVersion).mockReset().mockResolvedValue({ plugin_plugin1: { value: {} } });
    vi.mocked(logService.forceCallLogMatcherCheck).mockReset();
    vi.mocked(getRcInfo).mockReset().mockResolvedValue(rcInfo());
    vi.mocked(setRcAdditionalSubmission).mockReset();
    vi.mocked(showNotification).mockReset();
    vi.mocked(reset).mockReset();
    vi.mocked(identify).mockReset();
    vi.mocked(group).mockReset();
    vi.mocked(trackRcLogin).mockReset();
    vi.mocked(trackRcLogout).mockReset();
    rcApiMocks.RcAPI.mockClear();
    rcApiMocks.getUserInfo.mockReset().mockResolvedValue({
      accountId: 'account-1',
      extensionId: 'extension-1',
    });
  });

  it('stores logged-in feature permissions and updates widget authorization status', async () => {
    await notifyLoggedInWithCrmJwt();

    expect(readStorage().userPermissions).toEqual({
      aiNote: true,
      ringSenseInsights: true,
      ringCX: false,
      sms: true,
      c2sms: true,
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-update-authorization-status',
        authorized: true,
      },
      targetOrigin: '*',
    });
    expect(trackRcLogin).toHaveBeenCalled();
  });

  it('registers report, calldown, and appointments tabs after login', async () => {
    await notifyLoggedInWithCrmJwt();

    expect(reportPage.getReportsPageRender).toHaveBeenCalledWith({
      userStats: { calls: 4 },
      userSettings: {},
    });
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith({
      manifest: manifest(),
      filterStatus: 'All',
      userSettings: {},
    });
    expect(appointmentsPage.getAppointmentsPageRender).toHaveBeenCalledWith(expect.objectContaining({
      platformName: 'salesforce',
      appointmentTitle: 'Service Visits',
      showConfirm: false,
      userSettings: { showAppointmentsTab: { value: true } },
    }));
  });

  it('sets analytics identity and RingCentral request headers after login', async () => {
    await notifyLoggedInWithCrmJwt();

    expect(identify).toHaveBeenCalledWith({
      extensionId: 'extension-1',
      rcAccountId: 'account-1',
      platformName: 'salesforce',
    });
    expect(group).toHaveBeenCalledWith({ rcAccountId: 'account-1' });
    expect(axios.defaults.headers.common).toMatchObject({
      'rc-extension-id': 'extension-1',
      'rc-account-id': 'account-1',
      'developer-author-name': 'App Connect Team',
    });
  });

  it('refreshes admin settings, plugin settings, preload settings, and SSCL token after login', async () => {
    await notifyLoggedInWithCrmJwt();

    expect(adminCore.refreshAdminSettings).toHaveBeenCalled();
    expect(pluginService.checkAndUpdatePluginVersion).toHaveBeenCalled();
    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({
      changedSettings: { plugin_plugin1: { value: {} } },
    });
    expect(userCore.updateSSCLToken).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: manifest().platforms.salesforce,
      token: 'crm-jwt',
    });
    expect(userCore.preloadUserSettingsFromAdmin).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
    });
  });

  it('opens platform selection and marks CRM unauthenticated when no platform is selected', async () => {
    vi.mocked(getPlatformInfo).mockResolvedValueOnce(undefined);
    vi.mocked(getManifest).mockResolvedValueOnce({
      serverUrl: 'https://server.example',
      version: '1.7.35',
      platforms: {},
    });
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: {
        loggedIn: true,
        features: {},
      },
    });

    expect(authCore.checkAndOpenPlatformSelectionPage).toHaveBeenCalledWith({
      platformList: [{ id: 'salesforce' }],
    });
    expect(readStorage().crmAuthed).toBe(false);
    expect(authCore.setAuth).toHaveBeenCalledWith(false);
  });

  it('auto logs in CRM with the RingCentral access token and keeps syncing when SSCL update fails', async () => {
    const autoLoginManifest = manifest();
    const ssclError = new Error('sscl update failed');
    autoLoginManifest.platforms.salesforce.autoLoginCRMWithRingCentralLogin = true;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(getManifest).mockResolvedValueOnce(autoLoginManifest);
    vi.mocked(authCore.apiKeyLogin).mockResolvedValueOnce('auto-login-token');
    vi.mocked(userCore.updateSSCLToken).mockRejectedValueOnce(ssclError);
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: {
        loggedIn: true,
        features: {},
      },
    });

    expect(authCore.apiKeyLogin).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      apiKey: 'rc-access-token',
      useLicense: true,
    });
    expect(userCore.updateSSCLToken).toHaveBeenNthCalledWith(1, {
      serverUrl: 'https://server.example',
      platform: autoLoginManifest.platforms.salesforce,
      token: 'auto-login-token',
    });
    expect(console.log).toHaveBeenCalledWith(ssclError);
    expect(readStorage().crmAuthed).toBe(true);
    expect(adminCore.refreshAdminSettings).toHaveBeenCalled();
  });

  it('asks the runtime for a Pipedrive callback URI when CRM is not authenticated', async () => {
    vi.mocked(getPlatformInfo).mockResolvedValueOnce({ platformName: 'pipedrive' });
    vi.mocked(getManifest).mockResolvedValueOnce({
      serverUrl: 'https://server.example',
      version: '1.7.35',
      platforms: {
        pipedrive: {
          name: 'pipedrive',
          useLicense: false,
        },
      },
    });
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: {
        loggedIn: true,
        features: {},
      },
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'popupWindowRequestPipedriveCallbackUri',
    });
    expect(authCore.setAuth).not.toHaveBeenCalled();
    expect(readStorage().crmAuthed).toBe(false);
  });

  it('shows release notes and updates the registered extension version', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'crm-jwt',
      'rc-crm-extension-version': '1.7.34',
      rcLoginStatus: false,
    });
    vi.mocked(releaseNotesPage.getReleaseNotesPageRender).mockResolvedValueOnce({
      id: 'releaseNotesPage',
    });
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: {
        loggedIn: false,
        features: {},
      },
    });

    expect(readStorage()['rc-crm-extension-version']).toBe('1.7.35');
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'releaseNotesPage' },
        },
        targetOrigin: undefined,
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/releaseNotesPage',
        },
        targetOrigin: '*',
      },
    ]));
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Updated to the latest version 1.7.35',
      ttl: 60000,
    });
  });

  it('checks admin-managed OAuth before the CRM becomes visible', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'crm-jwt',
    });
    vi.mocked(authCore.isAdminManagedOAuthEnabled).mockReturnValueOnce(true);
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: {
        loggedIn: true,
        features: {},
      },
    });

    expect(authCore.checkManagedOAuthBeforeCrmVisible).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      platform: manifest().platforms.salesforce,
    });
  });

  it('keeps optional tabs hidden and skips server-backed RC user sync when manifest has no server URL', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'crm-jwt',
      userSettings: { showAppointmentsTab: { value: false } },
    });
    vi.mocked(getRcInfo).mockResolvedValue({
      value: {
        cachedData: {
          extensionFeatures: { records: [] },
          extensionInfo: {
            id: 'extension-local',
            name: 'RC User',
            contact: { email: 'rc@example.test' },
            account: { id: 'account-local' },
          },
        },
      },
    });
    vi.mocked(getManifest).mockResolvedValueOnce({
      version: '1.7.35',
      platforms: {
        salesforce: {
          name: 'salesforce',
          page: {
            appointment: { supported: false },
          },
        },
      },
    });
    vi.mocked(userCore.getShowUserReportTabSetting).mockReturnValueOnce({ value: false });
    vi.mocked(userCore.getShowCalldownTabSetting).mockReturnValueOnce({ value: false });
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: loggedInEventData(),
    });

    expect(readStorage().userPermissions).toEqual({
      aiNote: true,
      ringSenseInsights: true,
      ringCX: false,
      sms: true,
    });
    expect(reportPage.getReportsPageRender).not.toHaveBeenCalled();
    expect(calldownPage.getCalldownPageWithRecords).not.toHaveBeenCalled();
    expect(appointmentsPage.getAppointmentsPageRender).not.toHaveBeenCalled();
    expect(rcApiMocks.getUserInfo).not.toHaveBeenCalled();
  });

  it('starts Bullhorn heartbeat when the authenticated CRM platform is Bullhorn', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'crm-jwt',
    });
    const bullhornManifest = {
      serverUrl: 'https://server.example',
      version: '1.7.35',
      platforms: {
        bullhorn: {
          name: 'bullhorn',
        },
      },
    };
    vi.mocked(getPlatformInfo).mockResolvedValueOnce({ platformName: 'bullhorn' });
    vi.mocked(getManifest).mockResolvedValueOnce(bullhornManifest);
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: loggedInEventData(),
    });

    expect(bullhornHeartbeat).toHaveBeenCalledWith({
      platform: bullhornManifest.platforms.bullhorn,
    });
  });

  it('tracks RC login and logout transitions after initial state is known', async () => {
    seedStorage({
      rcLoginStatus: false,
    });
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: loggedInEventData(),
    });
    expect(trackRcLogin).toHaveBeenCalled();
    expect(readStorage().rcLoginStatus).toBe(true);

    seedStorage({
      rcLoginStatus: true,
    });
    await handler.onEvent({
      data: { loggedIn: false, features: {} },
    });
    expect(trackRcLogout).not.toHaveBeenCalled();

    seedStorage({
      rcLoginStatus: true,
    });
    await handler.onEvent({
      data: { loggedIn: false, features: {} },
    });
    expect(trackRcLogout).toHaveBeenCalled();
    expect(readStorage().rcLoginStatus).toBe(false);
  });

  it('does not show release notes when there is no rendered release-note page', async () => {
    seedStorage({
      'rc-crm-extension-version': '1.7.34',
    });
    vi.mocked(releaseNotesPage.getReleaseNotesPageRender).mockResolvedValueOnce(null);
    const handler = await loadLoginStatusHandler();

    await handler.onEvent({
      data: { loggedIn: false, features: {} },
    });

    expect(showNotification).not.toHaveBeenCalled();
    expect(readStorage()['rc-crm-extension-version']).toBe('1.7.34');
  });
});
