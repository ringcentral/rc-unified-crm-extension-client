import { RangeObserver, LibPhoneNumberMatcher } from 'ringcentral-c2d';
import CustomC2DWidget from '../../src/misc/CustomC2DWidget.ts';
import userCore from '../../src/core/user.ts';
import { sendMessageToExtension } from '../../src/lib/sendMessage.ts';
import { initializeShadowRootSupport } from '../../src/lib/c2d/shadowRootSupport.ts';
import ReactDOM from 'react-dom';
import { seedStorage } from '../setup/storageHelpers';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';

const widgetHandlers = vi.hoisted(() => ({}));

vi.mock('ringcentral-c2d', () => ({
  RangeObserver: vi.fn(function RangeObserver(options) {
    this.options = options;
  }),
  LibPhoneNumberMatcher: vi.fn(function LibPhoneNumberMatcher(options) {
    this.options = options;
  }),
  RegExpPhoneNumberMatcher: vi.fn(function RegExpPhoneNumberMatcher(options) {
    this.options = options;
  }),
  defaultExclusions: [{ name: 'default-exclusion' }],
}));

vi.mock('../../src/components/embedded', () => ({
  default: function App() {
    return null;
  },
}));

vi.mock('../../src/misc/CustomC2DWidget.ts', () => ({
  default: vi.fn(function CustomC2DWidget() {
    this.on = vi.fn((event, callback) => {
      widgetHandlers[event] = callback;
    });
    this.update = vi.fn();
  }),
}));

vi.mock('react', () => ({
  default: {
    createElement: vi.fn(() => ({})),
  },
}));

vi.mock('react-dom', () => ({
  default: {
    render: vi.fn(),
  },
}));

vi.mock('@ringcentral/juno', () => ({
  RcThemeProvider: function RcThemeProvider() {
    return null;
  },
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/lib/sendMessage.ts', () => ({
  sendMessageToExtension: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  isObjectEmpty: vi.fn((obj) => !obj || Object.keys(obj).length === 0),
}));

vi.mock('../../src/core/user.ts', () => ({
  default: {
    getClickToDialEmbedMode: vi.fn(),
    getQuickAccessButtonEmbedMode: vi.fn(),
    getClickToDialUrls: vi.fn(),
    getQuickAccessButtonUrls: vi.fn(),
  },
}));

vi.mock('../../src/lib/c2d/shadowRootSupport.ts', () => ({
  initializeShadowRootSupport: vi.fn(),
}));

async function loadContentSeams() {
  seedStorage({
    renderQuickAccessButton: false,
    'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
    userSettings: {},
  });
  vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValue({ value: 'disabled' });
  vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValue({ value: 'disabled' });
  vi.resetModules();
  const module = await import('../../src/content.ts');
  await Promise.resolve();
  return module;
}

describe('content click-to-dial initialization', () => {
  beforeEach(() => {
    Object.keys(widgetHandlers).forEach((key) => {
      delete widgetHandlers[key];
    });
    window.history.pushState({}, '', '/crm/contact');
    window.clickToDialInstances = [];
    window.clickToDialObservers = [];
    window.clickToDialShadowRootPollers = [];
    window.RingCentralC2D = vi.fn(function RingCentralC2D(options) {
      this.widget = options.widget;
      this.observer = options.observer;
    });
    vi.mocked(RangeObserver).mockClear();
    vi.mocked(LibPhoneNumberMatcher).mockClear();
    vi.mocked(CustomC2DWidget).mockClear();
    vi.mocked(sendMessageToExtension).mockReset();
    vi.mocked(initializeShadowRootSupport).mockReset();
    vi.mocked(userCore.getClickToDialEmbedMode).mockReset().mockReturnValue({ value: 'disabled' });
    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReset().mockReturnValue({ value: 'disabled' });
    vi.mocked(userCore.getClickToDialUrls).mockReset().mockReturnValue({ value: [] });
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReset().mockReturnValue({ value: [] });
  });

  it('initializes C2D with matcher settings, SMS permission, ignore selector, and shadow-root support', async () => {
    const { initializeC2D } = await loadContentSeams();
    seedStorage({
      renderQuickAccessButton: false,
      userPermissions: { c2sms: true },
      c2dMatcherType: 'libPhone',
      selectedRegion: 'US',
      'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
      customCrmManifest: {
        platforms: {
          salesforce: {
            c2dIgnoreSelector: '.ignore-phone',
          },
        },
      },
      userSettings: {},
    });
    vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValue({ value: 'whitelist' });
    vi.mocked(userCore.getClickToDialUrls).mockReturnValue({ value: ['*crm*'] });

    await initializeC2D();

    expect(LibPhoneNumberMatcher).toHaveBeenCalledWith(expect.objectContaining({
      countryCode: 'US',
      validDomExclusions: expect.any(Array),
    }));
    expect(RangeObserver).toHaveBeenCalledWith(expect.objectContaining({
      node: document.body,
      matcher: expect.any(Object),
    }));
    expect(window.RingCentralC2D).toHaveBeenCalledWith(expect.objectContaining({
      widget: expect.any(CustomC2DWidget),
      observer: expect.any(RangeObserver),
    }));
    expect(window.clickToDialInject.widget.update).toHaveBeenCalledWith({ enableC2Text: true });
    expect(initializeShadowRootSupport).toHaveBeenCalledWith(expect.objectContaining({
      sharedWidget: window.clickToDialInject.widget,
      matcherType: 'libPhone',
      selectedRegion: 'US',
      c2dIgnoreSelector: '.ignore-phone',
      pollerStore: window.clickToDialShadowRootPollers,
    }));
    expect(window.clickToDialInstances).toContain(window.clickToDialInject);

    widgetHandlers.call('+16505550100');
    widgetHandlers.text('+16505550200');
    widgetHandlers.schedule('+16505550300');

    expect(sendMessageToExtension).toHaveBeenCalledWith({
      type: 'c2d',
      phoneNumber: '+16505550100',
    });
    expect(sendMessageToExtension).toHaveBeenCalledWith({
      type: 'c2sms',
      phoneNumber: '+16505550200',
    });
    expect(sendMessageToExtension).toHaveBeenCalledWith({
      type: 'c2schedule',
      phoneNumber: '+16505550300',
    });
  });

  it('initializes C2D storage arrays and defaults SMS permission and ignore selector', async () => {
    const { initializeC2D } = await loadContentSeams();
    delete window.clickToDialInstances;
    delete window.clickToDialObservers;
    delete window.clickToDialShadowRootPollers;
    seedStorage({
      renderQuickAccessButton: false,
      userPermissions: {},
      c2dMatcherType: 'libPhone',
      selectedRegion: null,
      'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
      customCrmManifest: {
        platforms: {
          salesforce: {},
        },
      },
      userSettings: {},
    });
    vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValue({ value: 'whitelist' });
    vi.mocked(userCore.getClickToDialUrls).mockReturnValue({ value: ['*crm*'] });

    await initializeC2D();

    expect(window.clickToDialInstances).toEqual([window.clickToDialInject]);
    expect(window.clickToDialObservers).toEqual([]);
    expect(window.clickToDialShadowRootPollers).toEqual([]);
    expect(window.clickToDialInject.widget.update).toHaveBeenCalledWith({ enableC2Text: false });
    expect(initializeShadowRootSupport).toHaveBeenCalledWith(expect.objectContaining({
      c2dIgnoreSelector: '',
      selectedRegion: null,
      pollerStore: window.clickToDialShadowRootPollers,
    }));
  });

  it('creates regexp/default matcher instances and reuses shared widgets without duplicate handlers', async () => {
    const { createC2DInstance } = await loadContentSeams();
    const sharedWidget = {
      on: vi.fn(),
      update: vi.fn(),
    };

    createC2DInstance({
      rootNode: document.body,
      sharedWidget,
      matcherType: 'regExp',
      selectedRegion: 'US',
      c2dIgnoreSelector: '.ignore-phone',
    });

    expect(window.RingCentralC2D).toHaveBeenLastCalledWith(expect.objectContaining({
      widget: sharedWidget,
      observer: expect.any(RangeObserver),
    }));
    expect(sharedWidget.on).not.toHaveBeenCalled();

    createC2DInstance({
      rootNode: document.body,
      matcherType: 'unknown',
      selectedRegion: 'CA',
      c2dIgnoreSelector: '',
    });

    expect(LibPhoneNumberMatcher).toHaveBeenCalledWith(expect.objectContaining({
      countryCode: 'CA',
      validDomExclusions: expect.any(Array),
    }));
  });

  it('renders or skips the quick access button based on URL activation', async () => {
    const { RenderQuickAccessButton } = await loadContentSeams();
    seedStorage({
      'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
      customCrmManifest: {
        platforms: {
          salesforce: {},
        },
      },
      userSettings: {},
    });

    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValueOnce({ value: 'whitelist' });
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReturnValueOnce({ value: ['*no-match*'] });
    await RenderQuickAccessButton();

    expect(ReactDOM.render).not.toHaveBeenCalled();

    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValueOnce({ value: 'whitelist' });
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReturnValueOnce({ value: ['*crm*'] });
    await RenderQuickAccessButton();

    expect(document.getElementById('rc-crm-extension-quick-access-button')).toBeTruthy();
    expect(ReactDOM.render).toHaveBeenCalled();

    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValueOnce({ value: 'whitelist' });
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReturnValueOnce({ value: ['*crm*'] });
    await RenderQuickAccessButton();

    expect(document.querySelectorAll('#rc-crm-extension-quick-access-button')).toHaveLength(1);
    expect(ReactDOM.render).toHaveBeenCalledTimes(2);
  });

  it('handles content-script runtime messages', async () => {
    await loadContentSeams();
    const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    listener({ action: 'openAppWindow' }, {}, sendResponse);
    expect(window.postMessage).toHaveBeenCalledWith({
      type: 'rc-adapter-syncMinimized',
      minimized: false,
    }, '*');
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-syncMinimized',
        minimized: false,
      },
      targetOrigin: '*',
    });
    expect(sendResponse).toHaveBeenLastCalledWith('ok');

    listener({ action: 'needCallbackUri' }, {}, sendResponse);
    expect(sendMessageToExtension).toHaveBeenCalledWith({
      type: 'pipedriveCallbackUri',
      callbackUri: window.location.href,
    });

    document.body.insertAdjacentHTML('beforeend', '<div id="rc-stepper"></div>');
    listener({ action: 'pipedriveAltAuthDone' }, {}, sendResponse);
    expect(document.querySelector('#rc-stepper').innerHTML).toBe('(3/3) Setup finished. You can close this page now.');

    document.cookie = 'bullhorn=%7B%22username%22%3A%22bh-user%22%2C%22masterUserId%22%3A1%7D';
    sendResponse.mockClear();
    listener({ action: 'fetchBullhornUsername' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ bullhornUsername: 'bh-user' });
  });
});
