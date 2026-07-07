import manifest from '../manifest.json';
import mixpanel from 'mixpanel-browser';

type AnalyticsPayload = Record<string, any>;

declare const process: {
    env: Record<string, string | undefined>;
};

// eslint-disable-next-line no-undef
let useAnalytics = !!process.env.MIXPANEL_TOKEN;
if (useAnalytics) {
    try {
        // eslint-disable-next-line no-undef
        mixpanel.init(process.env.MIXPANEL_TOKEN, { persistence: 'localStorage' });
    }
    catch (e) {
        useAnalytics = false;
    }
}

const appName = 'App Connect';
const eventAddedVia = 'client';
const version = manifest.version;
let author = '';
let platformName = '';

function setAuthor(authorName: string) {
    if (!useAnalytics) {
        return;
    }
    author = authorName;
}

function reset() {
    if (!useAnalytics) {
        return;
    }
    mixpanel.reset();
}

function identify({ platformName, rcAccountId, extensionId }: AnalyticsPayload = {}) {
    if (!useAnalytics) {
        return;
    }
    mixpanel.identify(extensionId);
    mixpanel.people.set({
        crmPlatform: platformName,
        rcAccountId,
        version,
        author
    });
    platformName = platformName;
}

function group({ rcAccountId }: AnalyticsPayload = {}) {
    if (!useAnalytics) {
        return;
    }
    mixpanel.add_group('rcAccountId', rcAccountId);
    mixpanel.set_group('rcAccountId', rcAccountId);
}

function track(event: string, properties: AnalyticsPayload = {}) {
    if (!useAnalytics) {
        return;
    }
    mixpanel.track(event, { appName, via: eventAddedVia, version, collectedFrom: 'client', ...properties });
}

function trackPage(name: string, properties: AnalyticsPayload = {}) {
    if (!useAnalytics) {
        return;
    }
    try {
        const pathSegments = name.split('/');
        const rootPath = `/${pathSegments[1]}`;
        const childPath = name.split(rootPath)[1];
        mixpanel.track_pageview(
            {
                appName,
                via: eventAddedVia,
                version,
                author,
                path: window.location.pathname,
                childPath,
                search: window.location.search,
                url: window.location.href,
                ...properties
            },
            {
                event_name: `Viewed ${rootPath}`
            });
    }
    catch (e) {
        console.log(e)
    }
}


function trackFirstTimeSetup() {
    track('First time setup', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
function trackRcLogin() {
    track('Login with RingCentral account', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
function trackRcLogout() {
    track('Logout with RingCentral account', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
function trackCrmLogin() {
    track('Login with CRM account', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackCrmLogout() {
    track('Logout with CRM account', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackPlacedCall() {
    track('A new call placed', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackAnsweredCall() {
    track('A new call answered', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackConnectedCall() {
    track('A new call connected', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackCallEnd({ durationInSeconds, direction, result, callWith, callingMode }: AnalyticsPayload = {}) {
    track('A call is ended', {
        direction,
        durationInSeconds,
        result,
        callWith,
        callingMode,
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackSentSMS() {
    track('A new SMS sent', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}
function trackSyncCallLog({ hasNote }: AnalyticsPayload = {}) {
    track('Sync call log', {
        hasNote,
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}
function trackSyncMessageLog() {
    track('Sync message log', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}
function trackEditSettings({ changedItem, status }: AnalyticsPayload = {}) {
    track('Edit settings', {
        changedItem,
        status,
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}

function trackCreateMeeting() {
    track('Create meeting', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
function trackOpenFeedback() {
    track('Open feedback', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}
function trackSubmitFeedback() {
    track('Submit feedback', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
function createNewContact() {
    track('Create a new contact', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}
function contactPop() {
    track('Contact pop', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}

function trackFactoryReset() {
    track('Factory reset', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}
function trackUpdateCallRecordingLink({ processState }: AnalyticsPayload = {}) {
    track('Call recording update', {
        appName,
        via: eventAddedVia,
        version,
        author,
        processState,
        crmPlatform: platformName
    })
}

async function trackMissingServiceWorker() {
    const platformInfo = await chrome.storage.local.get('platform-info') as AnalyticsPayload;
    const platformName = platformInfo['platform-info'].platformName;
    const userInfo = await chrome.storage.local.get('rcUserInfo') as AnalyticsPayload;
    const rcAccountId = userInfo.rcUserInfo.rcAccountId;
    const rcExtensionId = userInfo.rcUserInfo.rcExtensionId;
    track('Service worker missing', {
        crmPlatform: platformName,
        appName,
        via: eventAddedVia,
        version,
        author,
        rcAccountId,
        rcExtensionId
    })
}

async function trackChromeAPIError(errorMessage?: string) {
    track('Chrome API error ', {
        appName,
        via: eventAddedVia,
        version,
        author,
        errorMessage,
    })
}

async function trackCRMSetupError() {
    track('CRM setup error', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    })
}

function trackCrmAuthFail() {
    track('CRM Auth failed', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}

function trackRingSensePage() {
    track('Visit ACE from AppConnect', {
        appName,
        via: eventAddedVia,
        version,
        author,
        crmPlatform: platformName
    });
}

const analytics = {
    setAuthor,
    reset,
    identify,
    group,
    trackPage,
    trackFirstTimeSetup,
    trackRcLogin,
    trackRcLogout,
    trackCrmLogin,
    trackCrmLogout,
    trackPlacedCall,
    trackAnsweredCall,
    trackConnectedCall,
    trackCallEnd,
    trackSentSMS,
    trackSyncCallLog,
    trackSyncMessageLog,
    trackEditSettings,
    trackCreateMeeting,
    trackOpenFeedback,
    trackSubmitFeedback,
    createNewContact,
    contactPop,
    trackFactoryReset,
    trackUpdateCallRecordingLink,
    trackMissingServiceWorker,
    trackChromeAPIError,
    trackCRMSetupError,
    trackCrmAuthFail,
    trackRingSensePage,
};

export {
    setAuthor,
    reset,
    identify,
    group,
    trackPage,
    trackFirstTimeSetup,
    trackRcLogin,
    trackRcLogout,
    trackCrmLogin,
    trackCrmLogout,
    trackPlacedCall,
    trackAnsweredCall,
    trackConnectedCall,
    trackCallEnd,
    trackSentSMS,
    trackSyncCallLog,
    trackSyncMessageLog,
    trackEditSettings,
    trackCreateMeeting,
    trackOpenFeedback,
    trackSubmitFeedback,
    createNewContact,
    contactPop,
    trackFactoryReset,
    trackUpdateCallRecordingLink,
    trackMissingServiceWorker,
    trackChromeAPIError,
    trackCRMSetupError,
    trackCrmAuthFail,
    trackRingSensePage,
};

export default analytics;
