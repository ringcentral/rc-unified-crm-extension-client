import { RangeObserver, LibPhoneNumberMatcher } from 'ringcentral-c2d';
import CustomC2DWidget from '../../src/misc/CustomC2DWidget.js';
import userCore from '../../src/core/user.js';
import { sendMessageToExtension } from '../../src/lib/sendMessage.js';
import { initializeShadowRootSupport } from '../../src/lib/c2d/shadowRootSupport.js';
import { seedStorage } from '../setup/storageHelpers';

const widgetHandlers = vi.hoisted(() => ({}));

vi.mock('ringcentral-c2d', () => ({
  RangeObserver: vi.fn(function RangeObserver(options) {
    this.options = options;
  }),
  LibPhoneNumberMatcher: vi.fn(function LibPhoneNumberMatcher(options) {
    this.options = options;
  }),
  defaultExclusions: [{ name: 'default-exclusion' }],
}));

vi.mock('../../src/components/embedded', () => ({
  default: function App() {
    return null;
  },
}));

vi.mock('../../src/misc/CustomC2DWidget.js', () => ({
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

vi.mock('../../src/lib/sendMessage.js', () => ({
  sendMessageToExtension: vi.fn(),
}));

vi.mock('../../src/lib/util.js', () => ({
  isObjectEmpty: vi.fn((obj) => !obj || Object.keys(obj).length === 0),
}));

vi.mock('../../src/core/user.js', () => ({
  default: {
    getClickToDialEmbedMode: vi.fn(),
    getQuickAccessButtonEmbedMode: vi.fn(),
    getClickToDialUrls: vi.fn(),
    getQuickAccessButtonUrls: vi.fn(),
  },
}));

vi.mock('../../src/lib/c2d/shadowRootSupport.js', () => ({
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
  const module = await import('../../src/content.js');
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
});
