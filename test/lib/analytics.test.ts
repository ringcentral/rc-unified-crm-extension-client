// @ts-nocheck
import mixpanel from 'mixpanel-browser';
import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('mixpanel-browser', () => ({
  default: {
    init: vi.fn(),
    reset: vi.fn(),
    identify: vi.fn(),
    people: {
      set: vi.fn(),
    },
    add_group: vi.fn(),
    set_group: vi.fn(),
    track: vi.fn(),
    track_pageview: vi.fn(),
  },
}));

async function loadAnalytics({ token = '', initThrows = false } = {}) {
  vi.resetModules();
  if (token) {
    vi.stubEnv('MIXPANEL_TOKEN', token);
  } else {
    vi.unstubAllEnvs();
    delete process.env.MIXPANEL_TOKEN;
  }
  vi.mocked(mixpanel.init).mockReset();
  vi.mocked(mixpanel.reset).mockReset();
  vi.mocked(mixpanel.identify).mockReset();
  vi.mocked(mixpanel.people.set).mockReset();
  vi.mocked(mixpanel.add_group).mockReset();
  vi.mocked(mixpanel.set_group).mockReset();
  vi.mocked(mixpanel.track).mockReset();
  vi.mocked(mixpanel.track_pageview).mockReset();
  if (initThrows) {
    vi.mocked(mixpanel.init).mockImplementationOnce(() => {
      throw new Error('init failed');
    });
  }
  return loadModule('../../src/lib/analytics.ts');
}

describe('analytics', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not call Mixpanel when analytics are disabled or init fails', async () => {
    let analytics = await loadAnalytics();
    analytics.setAuthor('Author');
    analytics.reset();
    analytics.trackRcLogin();
    expect(mixpanel.init).not.toHaveBeenCalled();
    expect(mixpanel.track).not.toHaveBeenCalled();

    analytics = await loadAnalytics({ token: 'token-1', initThrows: true });
    analytics.trackRcLogin();
    expect(mixpanel.track).not.toHaveBeenCalled();
  });

  it('initializes Mixpanel and tracks identity, groups, page views, and product events', async () => {
    seedStorage({
      'platform-info': { platformName: 'salesforce' },
      rcUserInfo: {
        rcAccountId: 'account-1',
        rcExtensionId: 'extension-1',
      },
    });
    const analytics = await loadAnalytics({ token: 'token-1' });

    analytics.setAuthor('Author');
    analytics.identify({
      platformName: 'salesforce',
      rcAccountId: 'account-1',
      extensionId: 'extension-1',
    });
    analytics.group({ rcAccountId: 'account-1' });
    analytics.trackPage('/settings/logging', { section: 'logging' });
    vi.mocked(mixpanel.track_pageview).mockImplementationOnce(() => {
      throw new Error('page view failed');
    });
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    analytics.trackPage('/broken/path');

    analytics.trackFirstTimeSetup();
    analytics.trackRcLogin();
    analytics.trackRcLogout();
    analytics.trackCrmLogin();
    analytics.trackCrmLogout();
    analytics.trackPlacedCall();
    analytics.trackAnsweredCall();
    analytics.trackConnectedCall();
    analytics.trackCallEnd({
      durationInSeconds: 60,
      direction: 'Inbound',
      result: 'Completed',
      callWith: '+16505550100',
      callingMode: 'web',
    });
    analytics.trackSentSMS();
    analytics.trackSyncCallLog({ hasNote: true });
    analytics.trackSyncMessageLog();
    analytics.trackEditSettings({ changedItem: 'autoLogCall', status: 'success' });
    analytics.trackCreateMeeting();
    analytics.trackOpenFeedback();
    analytics.trackSubmitFeedback();
    analytics.createNewContact();
    analytics.contactPop();
    analytics.trackFactoryReset();
    analytics.trackUpdateCallRecordingLink({ processState: 'success' });
    await analytics.trackMissingServiceWorker();
    await analytics.trackChromeAPIError('tabs API failed');
    await analytics.trackCRMSetupError();
    analytics.trackCrmAuthFail();
    analytics.trackRingSensePage();
    analytics.reset();

    expect(mixpanel.init).toHaveBeenCalledWith('token-1', { persistence: 'localStorage' });
    expect(mixpanel.identify).toHaveBeenCalledWith('extension-1');
    expect(mixpanel.people.set).toHaveBeenCalledWith(expect.objectContaining({
      crmPlatform: 'salesforce',
      rcAccountId: 'account-1',
      version: expect.any(String),
      author: 'Author',
    }));
    expect(mixpanel.add_group).toHaveBeenCalledWith('rcAccountId', 'account-1');
    expect(mixpanel.set_group).toHaveBeenCalledWith('rcAccountId', 'account-1');
    expect(mixpanel.track_pageview).toHaveBeenCalledWith(expect.objectContaining({
      childPath: '/logging',
      section: 'logging',
    }), {
      event_name: 'Viewed /settings',
    });
    expect(consoleLog).toHaveBeenCalledWith(expect.any(Error));
    expect(mixpanel.track).toHaveBeenCalledWith('A call is ended', expect.objectContaining({
      direction: 'Inbound',
      durationInSeconds: 60,
      via: 'client',
      collectedFrom: 'client',
    }));
    expect(mixpanel.track).toHaveBeenCalledWith('Service worker missing', expect.objectContaining({
      rcAccountId: 'account-1',
      rcExtensionId: 'extension-1',
    }));
    expect(mixpanel.reset).toHaveBeenCalled();
  });
});
