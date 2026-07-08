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

async function loadIdentifiedAnalytics() {
  const analytics = await loadAnalytics({ token: 'token-1' });
  analytics.setAuthor('Author');
  analytics.identify({
    platformName: 'salesforce',
    rcAccountId: 'account-1',
    extensionId: 'extension-1',
  });
  vi.mocked(mixpanel.track).mockClear();
  return analytics;
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

  it('initializes Mixpanel and tracks identity, account groups, and reset', async () => {
    const analytics = await loadAnalytics({ token: 'token-1' });

    analytics.setAuthor('Author');
    analytics.identify({
      platformName: 'salesforce',
      rcAccountId: 'account-1',
      extensionId: 'extension-1',
    });
    analytics.group({ rcAccountId: 'account-1' });
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
    expect(mixpanel.reset).toHaveBeenCalled();
  });

  it('tracks page views and logs page view failures without throwing', async () => {
    const analytics = await loadAnalytics({ token: 'token-1' });
    analytics.setAuthor('Author');

    analytics.trackPage('/settings/logging', { section: 'logging' });
    vi.mocked(mixpanel.track_pageview).mockImplementationOnce(() => {
      throw new Error('page view failed');
    });
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    analytics.trackPage('/broken/path');

    expect(mixpanel.track_pageview).toHaveBeenCalledWith(expect.objectContaining({
      author: 'Author',
      childPath: '/logging',
      section: 'logging',
    }), {
      event_name: 'Viewed /settings',
    });
    expect(consoleLog).toHaveBeenCalledWith(expect.any(Error));
  });

  it('tracks account authentication product events', async () => {
    const analytics = await loadIdentifiedAnalytics();
    analytics.trackFirstTimeSetup();
    analytics.trackRcLogin();
    analytics.trackRcLogout();
    analytics.trackCrmLogin();
    analytics.trackCrmLogout();

    for (const eventName of [
      'First time setup',
      'Login with RingCentral account',
      'Logout with RingCentral account',
      'Login with CRM account',
      'Logout with CRM account',
    ]) {
      expect(mixpanel.track).toHaveBeenCalledWith(eventName, expect.objectContaining({
        via: 'client',
        collectedFrom: 'client',
      }));
    }
  });

  it('tracks call and message product events with CRM context', async () => {
    const analytics = await loadIdentifiedAnalytics();

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

    for (const eventName of [
      'A new call placed',
      'A new call answered',
      'A new call connected',
      'A new SMS sent',
      'Sync message log',
    ]) {
      expect(mixpanel.track).toHaveBeenCalledWith(eventName, expect.objectContaining({
        via: 'client',
        collectedFrom: 'client',
      }));
    }
    expect(mixpanel.track).toHaveBeenCalledWith('A call is ended', expect.objectContaining({
      direction: 'Inbound',
      durationInSeconds: 60,
      result: 'Completed',
      callWith: '+16505550100',
      callingMode: 'web',
      crmPlatform: 'salesforce',
    }));
    expect(mixpanel.track).toHaveBeenCalledWith('Sync call log', expect.objectContaining({
      hasNote: true,
      crmPlatform: 'salesforce',
    }));
  });

  it('tracks settings, feedback, contact, and setup product events', async () => {
    const analytics = await loadIdentifiedAnalytics();

    analytics.trackEditSettings({ changedItem: 'autoLogCall', status: 'success' });
    analytics.trackCreateMeeting();
    analytics.trackOpenFeedback();
    analytics.trackSubmitFeedback();
    analytics.createNewContact();
    analytics.contactPop();
    analytics.trackFactoryReset();
    analytics.trackUpdateCallRecordingLink({ processState: 'success' });
    analytics.trackCrmAuthFail();
    analytics.trackRingSensePage();

    for (const eventName of [
      'Create meeting',
      'Open feedback',
      'Submit feedback',
      'Create a new contact',
      'Contact pop',
      'Factory reset',
      'CRM Auth failed',
      'Visit ACE from AppConnect',
    ]) {
      expect(mixpanel.track).toHaveBeenCalledWith(eventName, expect.objectContaining({
        via: 'client',
        collectedFrom: 'client',
      }));
    }
    expect(mixpanel.track).toHaveBeenCalledWith('Edit settings', expect.objectContaining({
      changedItem: 'autoLogCall',
      status: 'success',
      crmPlatform: 'salesforce',
    }));
    expect(mixpanel.track).toHaveBeenCalledWith('Call recording update', expect.objectContaining({
      processState: 'success',
      crmPlatform: 'salesforce',
    }));
  });

  it('tracks extension runtime and setup error events with stored RingCentral context', async () => {
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

    await analytics.trackMissingServiceWorker();
    await analytics.trackChromeAPIError('tabs API failed');
    await analytics.trackCRMSetupError();

    expect(mixpanel.track).toHaveBeenCalledWith('Service worker missing', expect.objectContaining({
      crmPlatform: 'salesforce',
      rcAccountId: 'account-1',
      rcExtensionId: 'extension-1',
    }));
    expect(mixpanel.track).toHaveBeenCalledWith('Chrome API error ', expect.objectContaining({
      errorMessage: 'tabs API failed',
    }));
    expect(mixpanel.track).toHaveBeenCalledWith('CRM setup error', expect.objectContaining({
      crmPlatform: 'salesforce',
    }));
  });
});
