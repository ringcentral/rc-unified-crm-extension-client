import manifest from '../manifest.json';
import mixpanel from 'mixpanel-browser';

let useAnalytics = !!manifest.mixpanelToken;
if (useAnalytics) {
    try {
        mixpanel.init(manifest.mixpanelToken);
    }
    catch (e) {
        useAnalytics = false;
    }
}

const appName = 'App Connect';
const eventAddedVia = 'client';
const version = manifest.version;
let author = '';

exports.setAuthor = function setAuthor(authorName) {
    if (!useAnalytics) {
        return;
    }
    author = authorName;
}

exports.reset = function reset() {
    if (!useAnalytics) {
        return;
    }
    mixpanel.reset();
}

exports.identify = function identify({ platformName, rcAccountId, extensionId }) {
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
}

exports.group = function group({ rcAccountId }) {
    if (!useAnalytics) {
        return;
    }
    mixpanel.add_group('rcAccountId', rcAccountId);
    mixpanel.set_group('rcAccountId', rcAccountId);
}

function track(event, properties = {}) {
    if (!useAnalytics) {
        return;
    }
    mixpanel.track(event, { appName, via: eventAddedVia, version, collectedFrom: 'client', ...properties });
}

exports.trackPage = function page(name, properties = {}) {
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


exports.trackFirstTimeSetup = function trackFirstTimeSetup() {
    track('First time setup', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackRcLogin = function trackRcLogin() {
    track('Login with RingCentral account', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackRcLogout = function trackRcLogout() {
    track('Logout with RingCentral account', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackCrmLogin = function trackCrmLogin() {
    track('Login with CRM account', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackCrmLogout = function trackCrmLogout() {
    track('Logout with CRM account', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackPlacedCall = function trackPlacedCall() {
    track('A new call placed', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackAnsweredCall = function trackAnsweredCall() {
    track('A new call answered', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackConnectedCall = function trackConnectedCall() {
    track('A new call connected', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackCallEnd = function trackCallEnd({ durationInSeconds, direction, result, callWith, callingMode }) {
    track('A call is ended', {
        direction,
        durationInSeconds,
        result,
        callWith,
        callingMode,
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackSentSMS = function trackSentSMS() {
    track('A new SMS sent', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}
exports.trackSyncCallLog = function trackSyncCallLog({ hasNote }) {
    track('Sync call log', {
        hasNote,
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.trackSyncMessageLog = function trackSyncMessageLog() {
    track('Sync message log', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.trackEditSettings = function trackEditSettings({ changedItem, status }) {
    track('Edit settings', {
        changedItem,
        status,
        appName,
        via: eventAddedVia,
        version,
        author
    })
}

exports.trackCreateMeeting = function trackCreateMeeting() {
    track('Create meeting', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.trackOpenFeedback = function trackOpenFeedback() {
    track('Open feedback', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.trackSubmitFeedback = function trackSubmitFeedback() {
    track('Submit feedback', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.createNewContact = function createNewContact() {
    track('Create a new contact', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.trackFactoryReset = function trackFactoryReset() {
    track('Factory reset', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}
exports.trackUpdateCallRecordingLink = function trackUpdateCallRecordingLink({ processState }) {
    track('Call recording update', {
        appName,
        via: eventAddedVia,
        version,
        author,
        processState
    })
}

exports.trackMissingServiceWorker = async function trackMissingServiceWorker() {
    const platformInfo = await chrome.storage.local.get('platform-info');
    const platformName = platformInfo['platform-info'].platformName;
    const userInfo = await chrome.storage.local.get('rcUserInfo');
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

exports.trackChromeAPIError = async function trackChromeAPIError(errorMessage) {
    track('Chrome API error ', {
        appName,
        via: eventAddedVia,
        version,
        author,
        errorMessage,
    })
}

exports.trackCRMSetupError = async function trackCRMSetupError() {
    track('CRM setup error', {
        appName,
        via: eventAddedVia,
        version,
        author
    })
}

exports.trackCrmAuthFail = function trackCrmAuthFail() {
    track('CRM Auth failed', {
        appName,
        via: eventAddedVia,
        version,
        author
    });
}