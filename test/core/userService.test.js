import axios from 'axios';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import adminCore from '../../src/core/admin.ts';
import embeddableServices from '../../src/service/embeddableServices.ts';
import reportPage from '../../src/components/reportPage/reportPage.ts';
import calldownPage from '../../src/components/calldownPage.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
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
