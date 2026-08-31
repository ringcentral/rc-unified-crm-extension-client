import { vi } from 'vitest';

function createChromeMock(initialStorage = {}) {
    const store = { ...initialStorage };

    function readKeys(keys) {
        if (keys === undefined || keys === null) {
            return { ...store };
        }
        if (typeof keys === 'string') {
            return { [keys]: store[keys] };
        }
        if (Array.isArray(keys)) {
            return keys.reduce((acc, key) => {
                acc[key] = store[key];
                return acc;
            }, {});
        }
        return Object.keys(keys).reduce((acc, key) => {
            acc[key] = store[key] === undefined ? keys[key] : store[key];
            return acc;
        }, {});
    }

    return {
        store,
        storage: {
            local: {
                get: vi.fn(async (keys) => readKeys(keys)),
                set: vi.fn(async (items) => {
                    Object.assign(store, items);
                }),
                remove: vi.fn(async (keys) => {
                    for (const key of [].concat(keys)) {
                        delete store[key];
                    }
                })
            },
            onChanged: {
                addListener: vi.fn()
            }
        },
        runtime: {
            onMessage: { addListener: vi.fn() },
            sendMessage: vi.fn(async () => null),
            getManifest: vi.fn(() => ({ version: '1.0.0' }))
        },
        windows: {
            create: vi.fn(async () => ({ id: 1 })),
            update: vi.fn(async () => ({ id: 1 })),
            get: vi.fn(async () => ({ id: 1, width: 300 }))
        },
        tabs: {
            query: vi.fn(async () => []),
            sendMessage: vi.fn(async () => null)
        }
    };
}

function createRcInfo() {
    return {
        value: {
            cachedData: {
                extensionInfo: {
                    id: 'ext-1',
                    name: 'Test User',
                    contact: { email: 'test@example.com' },
                    account: { id: 'acc-1' }
                },
                extensionFeatures: {
                    records: [{ id: 'SMSSending', available: true }]
                }
            }
        }
    };
}

/**
 * Boots the real src/popup.js with its dependencies mocked, and returns the
 * `message` listener it registers so tests can drive widget events directly.
 */
export async function loadPopup({ storage = {}, userSettings = {} } = {}) {
    vi.resetModules();

    document.body.innerHTML = `
        <div id="rc-widget"></div>
        <iframe id="rc-widget-adapter-frame"></iframe>
    `;
    const adapterFrame = document.querySelector('#rc-widget-adapter-frame');
    const widgetPostMessage = vi.fn();
    Object.defineProperty(adapterFrame, 'contentWindow', {
        configurable: true,
        value: { postMessage: widgetPostMessage }
    });

    const chromeMock = createChromeMock(storage);
    globalThis.chrome = chromeMock;
    globalThis.RCAdapter = { setAutoLog: vi.fn() };

    const axiosMock = {
        defaults: { timeout: 0, headers: { common: {} } },
        get: vi.fn(async () => ({ data: {} })),
        post: vi.fn(async () => ({ data: {} })),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        }
    };
    vi.doMock('axios', () => ({ default: axiosMock }));

    const util = {
        downloadTextFile: vi.fn(),
        checkC2DCollision: vi.fn(async () => false),
        responseMessage: vi.fn(),
        isObjectEmpty: vi.fn(() => true),
        showNotification: vi.fn(async () => 'notification-id'),
        dismissNotification: vi.fn(),
        getRcInfo: vi.fn(async () => createRcInfo()),
        getRcAccessToken: vi.fn(() => 'rc-access-token'),
        getPlatformInfo: vi.fn(async () => ({ platformName: 'testCRM', hostname: 'test.com' })),
        getManifest: vi.fn(async () => ({
            serverUrl: 'https://server.example',
            version: '1.0.0',
            author: { name: 'Test Author' },
            platforms: {
                testCRM: { name: 'testCRM', auth: { type: 'apiKey' } }
            }
        })),
        getUserReportStats: vi.fn(async () => ({})),
        getRcContactInfo: vi.fn(async () => ({}))
    };
    vi.doMock('../../src/lib/util', () => util);

    const userCore = {
        refreshUserSettings: vi.fn(async () => userSettings),
        updateSSCLToken: vi.fn(async () => {}),
        preloadUserSettingsFromAdmin: vi.fn(async () => null),
        getShowUserReportTabSetting: vi.fn(() => ({ value: false })),
        getIncomingCallPop: vi.fn(() => ({ value: 'disabled' })),
        getOutgoingCallPop: vi.fn(() => ({ value: 'disabled' })),
        getCallPopMultiMatchBehavior: vi.fn(() => ({ value: 'promptToSelect' }))
    };
    vi.doMock('../../src/core/user', () => ({ default: userCore }));

    const adminCore = {
        refreshAdminSettings: vi.fn(async () => ({ adminSettings: { userSettings: {} } }))
    };
    vi.doMock('../../src/core/admin', () => ({ default: adminCore }));

    const authCore = {
        checkAuth: vi.fn(async () => true),
        setAuth: vi.fn(),
        apiKeyLogin: vi.fn(async () => 'jwt-token'),
        unAuthorize: vi.fn(async () => {})
    };
    vi.doMock('../../src/core/auth', () => ({ default: authCore }));

    vi.doMock('../../src/core/log', () => ({ default: {} }));
    vi.doMock('../../src/core/disposition', () => ({ default: {} }));
    vi.doMock('../../src/core/customContactSearch', () => ({ default: {} }));
    vi.doMock('../../src/core/contact', () => ({
        default: {
            getLocalCachedContact: vi.fn(() => []),
            openContactPage: vi.fn(async () => {})
        }
    }));

    vi.doMock('../../src/lib/rcAPI', () => ({
        getUserInfo: vi.fn(async () => ({ accountId: 'acc-1', extensionId: 'ext-1' }))
    }));

    const analyticsNames = [
        'setAuthor', 'identify', 'reset', 'group', 'trackPage', 'trackRcLogin', 'trackRcLogout',
        'trackPlacedCall', 'trackAnsweredCall', 'trackCallEnd', 'trackSentSMS', 'trackCreateMeeting',
        'trackEditSettings', 'trackConnectedCall', 'trackOpenFeedback', 'trackUpdateCallRecordingLink',
        'trackFactoryReset', 'trackRingSensePage'
    ];
    vi.doMock('../../src/lib/analytics', () => Object.fromEntries(
        analyticsNames.map((name) => [name, vi.fn()])
    ));

    vi.doMock('../../src/service/logService', () => ({
        default: {
            forceCallLogMatcherCheck: vi.fn(async () => {}),
            retroAutoCallLog: vi.fn(async () => {})
        }
    }));
    vi.doMock('../../src/service/embeddableServices', () => ({
        default: { getServiceManifest: vi.fn(async () => ({ name: 'service-manifest' })) },
        getServiceManifest: vi.fn(async () => ({ name: 'service-manifest' }))
    }));

    vi.doMock('../../src/lib/logUtil', () => ({
        logPageFormDataDefaulting: vi.fn(() => ({})),
        getLogConflictInfo: vi.fn(async () => ({})),
        addPendingRecordingSessionId: vi.fn(async () => {}),
        triggerPendingRecordingCheck: vi.fn(async () => {}),
        removePendingRecordingSessionId: vi.fn(async () => {})
    }));

    vi.doMock('../../src/misc/bullhorn', () => ({
        bullhornHeartbeat: vi.fn(async () => {}),
        tryConnectToBullhorn: vi.fn(async () => {})
    }));

    vi.doMock('../../src/lib/apiErrorHandler', () => ({
        default: {
            handleApiError: vi.fn(async () => {}),
            registerCrmAuthCacheClearedHandler: vi.fn(),
            registerAxiosCrmAuthInterceptor: vi.fn()
        }
    }));

    vi.doMock('../../src/components/releaseNotesPage', () => ({
        default: { getReleaseNotesPageRender: vi.fn(async () => null) }
    }));
    vi.doMock('../../src/components/reportPage', () => ({
        default: { getReportsPageRender: vi.fn(() => ({ id: 'reportPage' })) }
    }));

    const addEventListener = vi.spyOn(window, 'addEventListener');
    await import('../../src/popup.js');

    const messageListenerCall = addEventListener.mock.calls.find(([type]) => type === 'message');
    if (!messageListenerCall) {
        throw new Error('popup.js did not register a message listener');
    }
    const listener = messageListenerCall[1];

    return {
        chromeMock,
        widgetPostMessage,
        util,
        userCore,
        adminCore,
        authCore,
        sendWidgetEvent: (data) => Promise.resolve(listener({ data }))
    };
}
