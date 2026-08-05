import axios from 'axios';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import adminCore from '../../src/core/admin.ts';
import embeddableServices from '../../src/service/embeddableServices.ts';
import reportPage from '../../src/components/reportPage/reportPage.ts';
import calldownPage from '../../src/components/calldownPage.ts';
import { getRcAccessToken, refreshRCToken } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

const rcApiMocks = vi.hoisted(() => ({
  instance: {
    getRcCallLog: vi.fn(),
    getRcSMSLog: vi.fn(),
  },
  RcAPI: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
  refreshRCToken: vi.fn(async () => {}),
}));

vi.mock('../../src/lib/rcAPI.ts', () => ({
  RcAPI: rcApiMocks.RcAPI,
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/core/admin.ts', () => ({
  default: {
    authServerSideLogging: vi.fn(),
  },
}));

vi.mock('../../src/service/embeddableServices.ts', () => ({
  default: {
    getServiceManifest: vi.fn(),
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

function getPostedUserSettings(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('userSettings' in body)) {
    throw new TypeError('Expected POST body to contain userSettings');
  }
  return body.userSettings;
}

async function loadUserCore() {
  vi.resetModules();
  return loadModule('../../src/core/user.ts');
}

describe('user service behavior', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(getManifest).mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        salesforce: {
          page: {
            appointment: {
              supported: true,
            },
          },
        },
      },
    });
    vi.mocked(getPlatformInfo).mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(embeddableServices.getServiceManifest).mockResolvedValue({ id: 'service' });
    vi.mocked(reportPage.getReportsPageRender).mockReturnValue({ id: 'reportPage' });
    vi.mocked(calldownPage.getCalldownPageWithRecords).mockResolvedValue({ id: 'calldownPage' });
    vi.mocked(adminCore.authServerSideLogging).mockReset().mockResolvedValue('sscl-access-token');
    rcApiMocks.RcAPI.mockReset().mockImplementation(function RcAPI() {
      return rcApiMocks.instance;
    });
    rcApiMocks.instance.getRcCallLog.mockReset();
    rcApiMocks.instance.getRcSMSLog.mockReset();
    vi.mocked(getRcAccessToken).mockClear();
    vi.mocked(refreshRCToken).mockClear();
  });

  it('returns null for user report stats until both custom dates are available', async () => {
    const userCore = await loadUserCore();

    await expect(userCore.getUserReportStats({
      dateRange: 'Select date range...',
      customStartDate: '2026-01-01',
    })).resolves.toBeNull();

    expect(rcApiMocks.RcAPI).not.toHaveBeenCalled();
  });

  it('builds user report stats for custom ranges, call outcomes, SMS directions, and unlogged calls', async () => {
    rcApiMocks.instance.getRcCallLog.mockResolvedValueOnce({
      records: [
        { direction: 'Inbound', result: 'Call connected', duration: 120 },
        { direction: 'Inbound', result: 'Accepted', duration: undefined },
        { direction: 'Inbound', result: 'Answered Not Accepted', duration: 60 },
        { direction: 'Inbound', result: 'Missed', duration: 30 },
        { direction: 'Outbound', result: 'Call connected', duration: 90 },
      ],
    });
    rcApiMocks.instance.getRcSMSLog.mockResolvedValueOnce({
      records: [
        { direction: 'Outbound' },
        { direction: 'Outbound' },
        { direction: 'Inbound' },
      ],
    });
    vi.mocked(RCAdapter.getUnloggedCalls!).mockResolvedValueOnce({
      calls: [
        { id: 'before-range', startTime: '2025-12-31T23:59:59Z' },
        { id: 'inside-range', startTime: '2026-01-01T12:00:00Z' },
        { id: 'after-range', startTime: '2026-01-03T00:00:01Z' },
      ],
      hasMore: false,
    });
    const userCore = await loadUserCore();

    await expect(userCore.getUserReportStats({
      dateRange: 'Select date range...',
      customStartDate: '2026-01-01T00:00:00Z',
      customEndDate: '2026-01-03T00:00:00Z',
    })).resolves.toMatchObject({
      dateRange: 'Select date range...',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-01-03T00:00:00Z',
      callLogStats: {
        inboundCallCount: 4,
        outboundCallCount: 1,
        answeredCallCount: 3,
        answeredCallPercentage: '75.00%',
        totalTalkTime: 5,
        averageTalkTime: 1,
      },
      smsLogStats: {
        smsSentCount: 2,
        smsReceivedCount: 1,
      },
      unloggedCallStats: {
        unloggedCallCount: 1,
        calls: [{ id: 'inside-range', startTime: '2026-01-01T12:00:00Z' }],
      },
    });

    expect(rcApiMocks.instance.getRcCallLog).toHaveBeenCalledWith({
      rcAccessToken: 'rc-access-token',
      dateRange: 'Select date range...',
      customStartDate: '2026-01-01T00:00:00Z',
      customEndDate: '2026-01-03T00:00:00Z',
    });
    expect(refreshRCToken).toHaveBeenCalledTimes(2);
    expect(getRcAccessToken).toHaveBeenCalledTimes(2);
    expect(vi.mocked(refreshRCToken).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(getRcAccessToken).mock.invocationCallOrder[0]);
    expect(vi.mocked(refreshRCToken).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(getRcAccessToken).mock.invocationCallOrder[1]);
    expect(RCAdapter.getUnloggedCalls).toHaveBeenCalledWith(100, 1);
  });

  it('uses zero report stats when no calls match the range', async () => {
    rcApiMocks.instance.getRcCallLog.mockResolvedValueOnce({
      records: [
        { direction: 'Inbound', result: 'Missed', duration: undefined },
      ],
    });
    rcApiMocks.instance.getRcSMSLog.mockResolvedValueOnce({ records: [] });
    vi.mocked(RCAdapter.getUnloggedCalls!).mockResolvedValueOnce({ calls: [], hasMore: false });
    const userCore = await loadUserCore();

    await expect(userCore.getUserReportStats({
      dateRange: 'Last 24 hours',
      customStartDate: '2026-01-01T00:00:00Z',
      customEndDate: '2026-01-02T00:00:00Z',
    })).resolves.toMatchObject({
      callLogStats: {
        answeredCallCount: 0,
        answeredCallPercentage: '0%',
        totalTalkTime: 0,
        averageTalkTime: 0,
      },
    });
  });

  it('uploads selected region and migrates legacy overriding phone formats', async () => {
    seedStorage({ selectedRegion: 'GB' });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        userSettings: {
          selectedRegion: { value: 'GB' },
        },
      },
    });
    const userCore = await loadUserCore();

    await expect(userCore.uploadUserSettings({
      serverUrl: 'https://server.example',
      userSettings: {
        overridingPhoneNumberFormat: { value: '(###) ###-####', customizable: false },
        overridingPhoneNumberFormat2: { value: '+# ### ### ####' },
        overridingPhoneNumberFormat3: { value: '' },
      },
      settingKeysToRemove: ['oldSetting'],
    })).resolves.toEqual({
      selectedRegion: { value: 'GB' },
    });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/user/settings', {
      userSettings: expect.objectContaining({
        selectedRegion: { value: 'GB' },
        overridingNumberFormat: {
          customizable: false,
          numberFormatter1: '(###) ###-####',
          numberFormatter2: '+# ### ### ####',
          numberFormatter3: '',
        },
      }),
      settingKeysToRemove: ['oldSetting'],
    });
  });

  it('uploads existing selected region and sparse legacy phone formats', async () => {
    seedStorage({ selectedRegion: 'AU' });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        userSettings: {
          saved: true,
        },
      },
    });
    const userCore = await loadUserCore();

    await expect(userCore.uploadUserSettings({
      serverUrl: 'https://server.example',
      userSettings: {
        selectedRegion: { value: 'US' },
        overridingPhoneNumberFormat: {},
        overridingPhoneNumberFormat3: { value: '###-###' },
      },
      settingKeysToRemove: [],
    })).resolves.toEqual({
      saved: true,
    });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/user/settings', {
      userSettings: expect.objectContaining({
        selectedRegion: { value: 'AU' },
        overridingNumberFormat: {
          customizable: true,
          numberFormatter1: '',
          numberFormatter2: '',
          numberFormatter3: '###-###',
        },
      }),
      settingKeysToRemove: [],
    });
  });

  it('does not add overridingNumberFormat when legacy phone formats are empty', async () => {
    seedStorage({ selectedRegion: 'US' });
    vi.mocked(axios.post).mockImplementationOnce(async (_url, body) => ({
      data: {
        userSettings: getPostedUserSettings(body),
      },
    }));
    const userCore = await loadUserCore();

    const uploaded = await userCore.uploadUserSettings({
      serverUrl: 'https://server.example',
      userSettings: {
        overridingPhoneNumberFormat: { value: '' },
        overridingPhoneNumberFormat2: { value: null },
      },
      settingKeysToRemove: [],
    });

    expect(uploaded).toEqual({
      overridingPhoneNumberFormat: { value: '' },
      overridingPhoneNumberFormat2: { value: null },
      selectedRegion: { value: 'US' },
    });
    expect(uploaded.overridingNumberFormat).toBeUndefined();
  });

  it('does not refresh user settings when CRM is not authorized', async () => {
    seedStorage({ crmAuthed: false });
    const userCore = await loadUserCore();

    await expect(userCore.refreshUserSettings({})).resolves.toBeUndefined();

    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('preloads user settings from admin and returns null when the preload request fails', async () => {
    const preloadError = new Error('preload failed');
    seedStorage({
      rcUserInfo: {
        rcAccountId: 'account-1',
      },
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: {
          autoLogCall: { value: true },
        },
      })
      .mockRejectedValueOnce(preloadError);
    const userCore = await loadUserCore();

    await expect(userCore.preloadUserSettingsFromAdmin({
      serverUrl: 'https://server.example',
    })).resolves.toEqual({
      autoLogCall: { value: true },
    });
    await expect(userCore.preloadUserSettingsFromAdmin({
      serverUrl: 'https://server.example',
    })).resolves.toBeNull();

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://server.example/user/preloadSettings?rcAccountId=account-1',
    );
    expect(console.log).toHaveBeenCalledWith(preloadError);
  });

  it('preloads user settings with an empty account id when rcUserInfo is missing', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        autoLogCall: { value: false },
      },
    });
    const userCore = await loadUserCore();

    await expect(userCore.preloadUserSettingsFromAdmin({
      serverUrl: 'https://server.example',
    })).resolves.toEqual({
      autoLogCall: { value: false },
    });

    expect(axios.get).toHaveBeenCalledWith('https://server.example/user/preloadSettings?rcAccountId=');
  });

  it('refreshes online settings, mirrors overridingNumberFormat, stores flags, and re-registers widget pages', async () => {
    seedStorage({
      crmAuthed: true,
      rcUserInfo: { rcAccountId: 'account-1' },
      selectedRegion: 'US',
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        overridingNumberFormat: {
          customizable: false,
          numberFormatter1: 'format-1',
          numberFormatter2: 'format-2',
          numberFormatter3: 'format-3',
        },
        autoLogCall: { value: true },
        showAppointmentsTab: { value: true },
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        userSettings: {
          overridingNumberFormat: {
            customizable: false,
            numberFormatter1: 'format-1',
            numberFormatter2: 'format-2',
            numberFormatter3: 'format-3',
          },
          overridingPhoneNumberFormat: { customizable: false, value: 'format-1' },
          overridingPhoneNumberFormat2: { customizable: false, value: 'format-2' },
          overridingPhoneNumberFormat3: { customizable: false, value: 'format-3' },
          autoLogCall: { value: true },
          selectedRegion: { value: 'US' },
          showAppointmentsTab: { value: true },
        },
      },
    });
    const userCore = await loadUserCore();

    const refreshed = await userCore.refreshUserSettings({
      changedSettings: {
        c2dMatcherType: { value: 'regExp' },
      },
    });

    expect(refreshed).toMatchObject({
      overridingPhoneNumberFormat: { value: 'format-1' },
      overridingPhoneNumberFormat2: { value: 'format-2' },
      overridingPhoneNumberFormat3: { value: 'format-3' },
    });
    expect(readStorage()).toMatchObject({
      userSettings: refreshed,
      notificationLevelSetting: ['success', 'warning', 'error'],
      c2dMatcherType: 'libPhone',
    });
    expect(RCAdapter.setAutoLog).toHaveBeenCalledWith({ call: true, message: false });
    expect(getWidgetPostMessages().map(({ message }) => message.type)).toEqual(expect.arrayContaining([
      'rc-adapter-update-features-flags',
      'rc-adapter-register-third-party-service',
      'rc-adapter-register-customized-page',
    ]));
  });

  it('refreshes settings with missing platform info and account-level server-side logging', async () => {
    seedStorage({
      crmAuthed: true,
      selectedRegion: 'US',
    });
    vi.mocked(getPlatformInfo).mockResolvedValueOnce(null);
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        c2dMatcherType: { value: 'libPhone' },
        showChatTab: { value: false },
        serverSideLogging: {
          enable: true,
          loggingLevel: 'Account',
        },
        autoLogCall: { value: true },
        autoLogSMS: { value: true },
        autoLogInboundFax: { value: true },
        showAppointmentsTab: { value: true },
        showAiAssistantWidget: { value: true, customizable: false },
        autoStartAiAssistant: { value: true, customizable: true },
      },
    });
    vi.mocked(axios.post).mockImplementationOnce(async (_url, body) => ({
      data: {
        userSettings: getPostedUserSettings(body),
      },
    }));
    const userCore = await loadUserCore();

    const refreshed = await userCore.refreshUserSettings({
      changedSettings: {
        c2dMatcherType: { value: 'regExp' },
        showChatTab: { value: true },
      },
    });

    expect(refreshed.c2dMatcherType.value).toBe('regExp');
    expect(refreshed.showChatTab.value).toBe(true);
    expect(window.postMessage).toHaveBeenCalledWith({
      type: 'rc-server-side-logging-enabled',
      enabled: true,
    }, '*');
    expect(RCAdapter.setAutoLog).toHaveBeenCalledWith({
      call: false,
      message: true,
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: expect.objectContaining({
        type: 'rc-adapter-update-features-flags',
        appointments: false,
      }),
      targetOrigin: '*',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-update-ai-assistant-settings',
        showAiAssistantWidget: true,
        showAiAssistantWidgetReadOnly: true,
        showAiAssistantWidgetReadOnlyReason: 'This setting is managed by admin',
        autoStartAiAssistant: true,
        autoStartAiAssistantReadOnly: false,
        autoStartAiAssistantReadOnlyReason: '',
      },
      targetOrigin: '*',
    });
  });

  it('refreshes settings without changed settings and can skip forced AI updates', async () => {
    seedStorage({
      crmAuthed: true,
      selectedRegion: 'US',
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        autoLogCall: { value: false },
      },
    });
    vi.mocked(axios.post).mockImplementationOnce(async (_url, body) => ({
      data: {
        userSettings: getPostedUserSettings(body),
      },
    }));
    const userCore = await loadUserCore();

    const refreshed = await userCore.refreshUserSettings({
      isAvoidForceChange: true,
    });

    expect(refreshed).toMatchObject({
      autoLogCall: { value: false },
      selectedRegion: { value: 'US' },
    });
    expect(getWidgetPostMessages()).not.toContainEqual({
      message: expect.objectContaining({
        type: 'rc-adapter-update-ai-assistant-settings',
      }),
      targetOrigin: '*',
    });
  });

  it('refreshes user info through the server wrapper', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        refreshed: true,
      },
    });
    const userCore = await loadUserCore();

    await expect(userCore.refreshUserInfo({
      serverUrl: 'https://server.example',
    })).resolves.toEqual({
      data: {
        refreshed: true,
      },
    });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/user/refreshInfo');
  });

  it('updates the server-side logging CRM token only when enabled and a token is available', async () => {
    seedStorage({
      rcUserInfo: {
        rcAccountId: 'account-1',
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        serverSideLogging: {
          enable: true,
        },
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        successful: true,
      },
    });
    const userCore = await loadUserCore();
    const platform = {
      name: 'salesforce',
      serverSideLogging: {
        url: 'https://sscl.example',
      },
    };

    await userCore.updateSSCLToken({
      serverUrl: 'https://server.example',
      platform,
      token: 'crm-token',
    });

    expect(adminCore.authServerSideLogging).toHaveBeenCalledWith({ platform });
    expect(axios.post).toHaveBeenCalledWith(
      'https://sscl.example/update-crm-token',
      {
        crmToken: 'crm-token',
        crmPlatform: 'salesforce',
        crmAdapterUrl: 'https://server.example',
      },
      {
        headers: {
          Accept: 'application/json',
          'X-Access-Token': 'sscl-access-token',
        },
      },
    );

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        serverSideLogging: {
          enable: true,
        },
      },
    });
    vi.mocked(axios.post).mockClear();

    await userCore.updateSSCLToken({
      serverUrl: 'https://server.example',
      platform,
      token: undefined,
    });

    expect(adminCore.authServerSideLogging).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
