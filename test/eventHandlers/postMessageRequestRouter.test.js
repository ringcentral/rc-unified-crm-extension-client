import authCore from '../../src/core/auth.js';
import authorizeHandler from '../../src/eventHandlers/rc-post-message-request/authorize.js';
import customizedPageInputChangedHandler from '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js';
import contactsMatchHandler from '../../src/eventHandlers/rc-post-message-request/contacts/match.js';
import contactsViewHandler from '../../src/eventHandlers/rc-post-message-request/contacts/view.js';
import callLoggerIndexHandler from '../../src/eventHandlers/rc-post-message-request/callLogger/index.js';
import callLoggerInputChangedHandler from '../../src/eventHandlers/rc-post-message-request/callLogger/inputChanged/index.js';
import callLoggerMatchHandler from '../../src/eventHandlers/rc-post-message-request/callLogger/match/index.js';
import messageLoggerIndexHandler from '../../src/eventHandlers/rc-post-message-request/messageLogger/index.js';
import messageLoggerInputChangedHandler from '../../src/eventHandlers/rc-post-message-request/messageLogger/inputChanged/index.js';
import messageLoggerMatchHandler from '../../src/eventHandlers/rc-post-message-request/messageLogger/match/index.js';
import settingsHandler from '../../src/eventHandlers/rc-post-message-request/settings.js';
import customButtonClickHandler from '../../src/eventHandlers/rc-post-message-request/custom-button-click/index.js';
import { getManifest, getPlatformList } from '../../src/service/manifestService.js';
import { getPlatformInfo } from '../../src/service/platformService.js';
import { responseMessage, showNotification } from '../../src/lib/util.js';
import { loadModule } from '../helpers/loadModule';

vi.mock('../../src/core/auth.js', () => ({
  default: {
    syncCrmAuthedFromStorage: vi.fn(),
    checkAndOpenPlatformSelectionPage: vi.fn(),
  },
}));

vi.mock('../../src/service/manifestService.js', () => ({
  getManifest: vi.fn(),
  getPlatformList: vi.fn(),
}));

vi.mock('../../src/service/platformService.js', () => ({
  getPlatformInfo: vi.fn(),
}));

vi.mock('../../src/lib/util.js', () => ({
  showNotification: vi.fn(),
  responseMessage: vi.fn(),
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/authorize.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/contacts/match.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/contacts/view.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/callLogger/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/callLogger/inputChanged/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/callLogger/match/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/messageLogger/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/messageLogger/inputChanged/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/messageLogger/match/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/settings.js', () => ({
  default: { onEvent: vi.fn() },
}));

vi.mock('../../src/eventHandlers/rc-post-message-request/custom-button-click/index.js', () => ({
  default: { onEvent: vi.fn() },
}));

async function loadPostMessageRouter() {
  vi.resetModules();
  return loadModule('../../src/eventHandlers/rc-post-message-request/index.js');
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        name: 'salesforce',
        displayName: 'Salesforce',
      },
    },
  };
}

function childHandlers() {
  return [
    authorizeHandler.onEvent,
    customizedPageInputChangedHandler.onEvent,
    contactsMatchHandler.onEvent,
    contactsViewHandler.onEvent,
    callLoggerIndexHandler.onEvent,
    callLoggerInputChangedHandler.onEvent,
    callLoggerMatchHandler.onEvent,
    messageLoggerIndexHandler.onEvent,
    messageLoggerInputChangedHandler.onEvent,
    messageLoggerMatchHandler.onEvent,
    settingsHandler.onEvent,
    customButtonClickHandler.onEvent,
  ];
}

describe('rc-post-message-request router', () => {
  beforeEach(() => {
    vi.mocked(authCore.syncCrmAuthedFromStorage).mockReset().mockResolvedValue(true);
    vi.mocked(authCore.checkAndOpenPlatformSelectionPage).mockReset();
    vi.mocked(getManifest).mockReset().mockResolvedValue(manifest());
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(getPlatformList).mockReset().mockResolvedValue([{ id: 'salesforce' }]);
    vi.mocked(showNotification).mockReset();
    vi.mocked(responseMessage).mockReset();
    for (const handler of childHandlers()) {
      vi.mocked(handler).mockReset();
    }
  });

  it('blocks call/message logger routes when CRM is not authenticated', async () => {
    vi.mocked(authCore.syncCrmAuthedFromStorage).mockResolvedValueOnce(false);
    const router = await loadPostMessageRouter();

    await router.onEvent({
      data: {
        path: '/callLogger',
        requestId: 'request-1',
      },
    });

    expect(showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Please go to user settings page and connect to your Salesforce account.',
      ttl: 60000,
    });
    expect(responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(callLoggerIndexHandler.onEvent).not.toHaveBeenCalled();
  });

  it('routes authorize requests with manifest and platform context', async () => {
    const router = await loadPostMessageRouter();
    const data = {
      path: '/authorize',
      requestId: 'request-2',
      body: {},
    };

    await router.onEvent({ data });

    expect(authorizeHandler.onEvent).toHaveBeenCalledWith({
      data,
      manifest: manifest(),
      platformInfo: { platformName: 'salesforce' },
      platformName: 'salesforce',
      platform: manifest().platforms.salesforce,
    });
  });

  it('opens platform selection from the platform-selection route', async () => {
    const router = await loadPostMessageRouter();

    await router.onEvent({
      data: {
        path: '/platform-selection',
        requestId: 'request-3',
      },
    });

    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-on' }, '*');
    expect(authCore.checkAndOpenPlatformSelectionPage).toHaveBeenCalledWith({
      platformList: [{ id: 'salesforce' }],
    });
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
  });

  it('routes all post-message child paths with shared request context', async () => {
    const router = await loadPostMessageRouter();
    const routes = [
      ['/customizedPage/inputChanged', customizedPageInputChangedHandler.onEvent],
      ['/contacts/match', contactsMatchHandler.onEvent],
      ['/contacts/view', contactsViewHandler.onEvent],
      ['/callLogger', callLoggerIndexHandler.onEvent],
      ['/callLogger/inputChanged', callLoggerInputChangedHandler.onEvent],
      ['/callLogger/match', callLoggerMatchHandler.onEvent],
      ['/messageLogger', messageLoggerIndexHandler.onEvent],
      ['/messageLogger/inputChanged', messageLoggerInputChangedHandler.onEvent],
      ['/messageLogger/match', messageLoggerMatchHandler.onEvent],
      ['/settings', settingsHandler.onEvent],
      ['/custom-button-click', customButtonClickHandler.onEvent],
    ];

    for (const [path, childHandler] of routes) {
      const data = {
        path,
        requestId: `request-${path}`,
      };
      await router.onEvent({ data });
      expect(childHandler).toHaveBeenLastCalledWith({
        data,
        manifest: manifest(),
        platformInfo: { platformName: 'salesforce' },
        platformName: 'salesforce',
        platform: manifest().platforms.salesforce,
      });
    }
  });

  it('acknowledges unknown paths without dispatching a child handler', async () => {
    const router = await loadPostMessageRouter();

    await router.onEvent({
      data: {
        path: '/unknown',
        requestId: 'request-4',
      },
    });

    expect(responseMessage).toHaveBeenCalledWith('request-4', { data: 'ok' });
    for (const handler of childHandlers()) {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
