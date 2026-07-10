import userCore from '../../src/core/user.ts';
import { seedStorage } from '../setup/storageHelpers';

function userSetting<T>(value: T) {
  return {
    value,
    readOnly: false,
    readOnlyReason: '',
  };
}

vi.mock('ringcentral-c2d', () => ({
  RangeObserver: vi.fn(function RangeObserver(this: { options: unknown }, options) {
    this.options = options;
  }),
  LibPhoneNumberMatcher: vi.fn(function LibPhoneNumberMatcher(this: { options: unknown }, options) {
    this.options = options;
  }),
  defaultExclusions: [],
}));

vi.mock('../../src/components/embedded', () => ({
  default: function App() {
    return null;
  },
}));

vi.mock('../../src/misc/CustomC2DWidget.ts', () => ({
  default: vi.fn(function CustomC2DWidget(this: {
    on: () => void;
    update: () => void;
  }) {
    this.on = vi.fn();
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
  vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValue(userSetting('disabled'));
  vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValue(userSetting('disabled'));
  vi.resetModules();
  const module = await import('../../src/content.ts');
  await Promise.resolve();
  return module;
}

describe('content URL activation', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/accounts/123');
    window.RingCentralC2D = vi.fn(function RingCentralC2D(this: {
      widget: NonNullable<typeof window.clickToDialInject>['widget'];
      observer: unknown;
    }, options) {
      this.widget = options.widget;
      this.observer = options.observer;
    }) as unknown as NonNullable<typeof window.RingCentralC2D>;
    vi.mocked(userCore.getClickToDialEmbedMode).mockReset().mockReturnValue(userSetting('disabled'));
    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReset().mockReturnValue(userSetting('disabled'));
    vi.mocked(userCore.getClickToDialUrls).mockReset().mockReturnValue(userSetting([]));
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReset().mockReturnValue(userSetting([]));
  });

  it('allows embedding on every page when the global override is enabled', async () => {
    const { checkUrlMatch } = await loadContentSeams();
    seedStorage({ allowEmbeddingForAllPages: true });

    await expect(checkUrlMatch({ type: 'c2d' })).resolves.toBe(true);
  });

  it('matches whitelist and blacklist URL settings for quick access buttons', async () => {
    const { checkUrlMatch } = await loadContentSeams();
    seedStorage({
      allowEmbeddingForAllPages: false,
      'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
      customCrmManifest: {
        platforms: {
          salesforce: {
            embedUrls: ['*crm-only*'],
          },
        },
      },
      userSettings: {},
    });

    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValueOnce(userSetting('whitelist'));
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReturnValueOnce(userSetting(['*accounts*']));
    await expect(checkUrlMatch({ type: 'quickAccessButton' })).resolves.toBe(true);

    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValueOnce(userSetting('blacklist'));
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReturnValueOnce(userSetting(['*accounts*']));
    await expect(checkUrlMatch({ type: 'quickAccessButton' })).resolves.toBe(false);
  });

  it('uses CRM-only and disabled modes for click-to-dial activation', async () => {
    const { checkUrlMatch } = await loadContentSeams();
    window.history.pushState({}, '', '/crm-only/contact');
    seedStorage({
      allowEmbeddingForAllPages: false,
      'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
      customCrmManifest: {
        platforms: {
          salesforce: {
            embedUrls: ['*crm-only*'],
          },
        },
      },
      userSettings: {},
    });

    vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValueOnce(userSetting('crmOnly'));
    vi.mocked(userCore.getClickToDialUrls).mockReturnValueOnce(userSetting([]));
    await expect(checkUrlMatch({ type: 'c2d' })).resolves.toBe(true);

    vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValueOnce(userSetting('disabled'));
    await expect(checkUrlMatch({ type: 'c2d' })).resolves.toBe(false);
  });

  it('allows activation when platform info is missing or storage fails', async () => {
    const { checkUrlMatch } = await loadContentSeams();

    await chrome.storage.local.remove('platform-info');
    await expect(checkUrlMatch({ type: 'quickAccessButton' })).resolves.toBe(true);

    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(checkUrlMatch({ type: 'c2d' })).resolves.toBe(true);
  });

  it('handles null URL lists for click-to-dial and quick access modes', async () => {
    const { checkUrlMatch } = await loadContentSeams();
    seedStorage({
      allowEmbeddingForAllPages: false,
      'platform-info': { platformName: 'salesforce', hostname: 'localhost' },
      customCrmManifest: {
        platforms: {
          salesforce: {},
        },
      },
      userSettings: {},
    });

    vi.mocked(userCore.getClickToDialEmbedMode).mockReturnValueOnce(userSetting('whitelist'));
    vi.mocked(userCore.getClickToDialUrls).mockReturnValueOnce(userSetting(null));
    await expect(checkUrlMatch({ type: 'c2d' })).resolves.toBe(false);

    vi.mocked(userCore.getQuickAccessButtonEmbedMode).mockReturnValueOnce(userSetting('blacklist'));
    vi.mocked(userCore.getQuickAccessButtonUrls).mockReturnValueOnce(userSetting(null));
    await expect(checkUrlMatch({ type: 'quickAccessButton' })).resolves.toBe(true);
  });
});
