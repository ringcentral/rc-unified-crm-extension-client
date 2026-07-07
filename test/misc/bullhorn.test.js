import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

async function loadBullhorn(overrides = {}) {
  vi.resetModules();
  vi.mocked(axios.get).mockReset();

  const util = {
    showNotification: vi.fn(),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const analytics = {
    trackCrmAuthFail: vi.fn(),
    ...overrides.analytics,
  };
  vi.doMock('../../src/lib/analytics.js', () => analytics);

  const embeddableServices = {
    getServiceManifest: vi.fn(async () => ({ id: 'service-manifest' })),
    ...overrides.embeddableServices,
  };
  vi.doMock('../../src/service/embeddableServices.js', () => embeddableServices);

  const manifestService = {
    getManifest: vi.fn(async () => ({ serverUrl: 'https://server.example' })),
    ...overrides.manifestService,
  };
  vi.doMock('../../src/service/manifestService.js', () => manifestService);

  const calldownPage = {
    getCalldownPageRender: vi.fn(() => ({ id: 'calldownPage' })),
    ...overrides.calldownPage,
  };
  vi.doMock('../../src/components/calldownPage.js', () => ({ default: calldownPage }));

  const userCore = {
    getShowCalldownTabSetting: vi.fn(() => ({ value: true })),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.js', () => ({ default: userCore }));

  const bullhorn = await loadModule('../../src/misc/bullhorn.js');
  return {
    bullhorn,
    util,
    analytics,
    embeddableServices,
    manifestService,
    calldownPage,
    userCore,
  };
}

const platform = {
  name: 'bullhorn',
  auth: {
    oauth: {
      clientId: 'client-id',
    },
  },
};

describe('bullhorn helpers', () => {
  it('opens Bullhorn OAuth using cached login URLs', async () => {
    seedStorage({
      crm_extension_bullhorn_user_urls: {
        oauthUrl: 'https://auth.bullhorn.example',
      },
    });
    const { bullhorn } = await loadBullhorn();

    await bullhorn.tryConnectToBullhorn({ platform });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: 'https://auth.bullhorn.example/authorize?response_type=code&action=Login&client_id=client-id&state=platform=bullhorn&redirect_uri=https://ringcentral.github.io/ringcentral-embeddable/redirect.html',
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('fetches Bullhorn login URLs when cache is missing', async () => {
    seedStorage({
      crm_extension_bullhornUsername: 'jane@example.test',
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        oauthUrl: 'https://auth.bullhorn.example',
      },
    });
    const { bullhorn, util } = await loadBullhorn();
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        oauthUrl: 'https://auth.bullhorn.example',
      },
    });

    await bullhorn.tryConnectToBullhorn({ platform });

    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warning',
      message: 'Login failure. If you already have Bullhorn page open, please refresh Bullhorn page and try again.',
    }));
    expect(axios.get).toHaveBeenCalledWith('https://rest.bullhornstaffing.com/rest-services/loginInfo?username=jane@example.test');
    expect(readStorage().crm_extension_bullhorn_user_urls).toEqual({
      oauthUrl: 'https://auth.bullhorn.example',
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: expect.stringContaining('client_id=client-id'),
    }));
  });

  it('keeps storage intact when heartbeat succeeds', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmAuthed: true,
    });
    const { bullhorn, util, analytics } = await loadBullhorn();
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: true,
      },
    });

    await bullhorn.bullhornHeartbeat({ platform });

    expect(readStorage()).toMatchObject({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmAuthed: true,
    });
    expect(util.showNotification).not.toHaveBeenCalled();
    expect(analytics.trackCrmAuthFail).not.toHaveBeenCalled();
  });

  it('clears CRM state, hides calldown, refreshes service manifest, and reconnects on failed heartbeat', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmAuthed: true,
      userSettings: {
        showCalldownTab: { value: true },
      },
      crm_extension_bullhorn_user_urls: {
        oauthUrl: 'https://auth.bullhorn.example',
      },
    });
    const { bullhorn, util, analytics, calldownPage, embeddableServices } = await loadBullhorn();
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: false,
      },
    });

    await bullhorn.bullhornHeartbeat({ platform });

    expect(readStorage().rcUnifiedCrmExtJwt).toBeUndefined();
    expect(readStorage().crmAuthed).toBeUndefined();
    expect(calldownPage.getCalldownPageRender).toHaveBeenCalled();
    expect(embeddableServices.getServiceManifest).toHaveBeenCalled();
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-register-customized-page',
          page: {
            id: 'calldownPage',
            hidden: true,
            unreadCount: 0,
          },
        },
      }),
      expect.objectContaining({
        message: {
          type: 'rc-adapter-register-third-party-service',
          service: { id: 'service-manifest' },
        },
      }),
    ]));
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Bullhorn token expired. Auto-reconnecting to Bullhorn...',
    }));
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'If auto connect failed, please reconnect manually.',
    }));
    expect(analytics.trackCrmAuthFail).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'openThirdPartyAuthWindow',
      oAuthUri: expect.stringContaining('https://auth.bullhorn.example/authorize?'),
    }));
  });

  it('uses the exception recovery path when heartbeat request fails', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      crmAuthed: true,
      userSettings: {},
      crm_extension_bullhorn_user_urls: {
        oauthUrl: 'https://auth.bullhorn.example',
      },
    });
    const { bullhorn, util, analytics } = await loadBullhorn({
      userCore: {
        getShowCalldownTabSetting: vi.fn(() => ({ value: false })),
      },
    });
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network'));

    await bullhorn.bullhornHeartbeat({ platform });

    expect(readStorage().rcUnifiedCrmExtJwt).toBeUndefined();
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Auto-reconnecting to Bullhorn...',
    }));
    expect(analytics.trackCrmAuthFail).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'openThirdPartyAuthWindow',
    }));
  });
});
