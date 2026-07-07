// @ts-nocheck
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

async function loadRouteChanged(overrides = {}) {
  vi.resetModules();

  const analytics = {
    trackPage: vi.fn(),
    ...overrides.analytics,
  };
  vi.doMock('../../src/lib/analytics.ts', () => analytics);

  const userCore = {
    getShowCalldownTabSetting: vi.fn(() => ({ value: true })),
    getShowAppointmentsTabSetting: vi.fn(() => ({ value: true })),
    refreshUserSettings: vi.fn(async () => ({})),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const calldownPage = {
    getCalldownPageWithRecords: vi.fn(async (props) => ({ id: 'calldownPage', props })),
    getCalldownPageRender: vi.fn(() => ({ id: 'calldownPage' })),
    ...overrides.calldownPage,
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));

  const appointmentsPage = {
    getAppointmentsPageWithRecords: vi.fn(async (props) => ({ id: 'appointmentsPage', props })),
    ...overrides.appointmentsPage,
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentsPage.ts', () => ({ default: appointmentsPage }));

  const manifestService = {
    getManifest: vi.fn(async () => ({
      serverUrl: 'https://server.example',
      platforms: {
        salesforce: {
          page: {
            appointment: {
              supported: true,
            },
          },
        },
      },
    })),
    ...overrides.manifestService,
  };
  vi.doMock('../../src/service/manifestService.ts', () => manifestService);

  const platformService = {
    getPlatformInfo: vi.fn(async () => ({ platformName: 'salesforce' })),
    ...overrides.platformService,
  };
  vi.doMock('../../src/service/platformService.ts', () => platformService);

  const handler = await loadModule('../../src/eventHandlers/rc-route-changed-notify.ts');
  return {
    handler,
    analytics,
    userCore,
    calldownPage,
    appointmentsPage,
    manifestService,
    platformService,
  };
}

describe('route changed notify handler', () => {
  beforeEach(() => {
    seedStorage({
      userSettings: {},
    });
  });

  it('tracks non-root routes, clears auto-popup state, and terminates expandable note for conversations', async () => {
    const { handler, analytics } = await loadRouteChanged();

    await handler.onEvent({
      data: {
        path: '/conversations/abc',
      },
    });
    expect(analytics.trackPage).toHaveBeenCalledWith('/conversations/abc');
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-expandable-call-note-terminate' }, '*');
    expect(readStorage().appConnectCurrentPath).toBe('/conversations/abc');

    await handler.onEvent({
      data: {
        path: '/history',
      },
    });
    expect(readStorage().autoPopupMainConverastionId).toBeNull();
  });

  it('refreshes or hides the calldown tab when navigating to it', async () => {
    seedStorage({
      crmAuthed: true,
      rcUnifiedCrmExtJwt: 'jwt-1',
      userSettings: {
        showCalldownTab: { value: true },
      },
    });
    let loaded = await loadRouteChanged();

    await loaded.handler.onEvent({
      data: {
        path: '/customizedTabs/calldownPage',
      },
    });
    expect(loaded.calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      filterStatus: 'All',
      userSettings: {
        showCalldownTab: { value: true },
      },
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: expect.objectContaining({ id: 'calldownPage' }),
        }),
      }),
    ]));

    seedStorage({
      crmAuthed: false,
      userSettings: {
        showCalldownTab: { value: true },
      },
    });
    loaded = await loadRouteChanged();
    await loaded.handler.onEvent({
      data: {
        path: '/customizedTabs/calldownPage',
      },
    });
    expect(loaded.calldownPage.getCalldownPageRender).toHaveBeenCalled();
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
    ]));
  });

  it('refreshes appointments only when CRM auth, support, and user setting allow it', async () => {
    seedStorage({
      crmAuthed: true,
      rcUnifiedCrmExtJwt: 'jwt-1',
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });
    let loaded = await loadRouteChanged();

    await loaded.handler.onEvent({
      data: {
        path: '/customizedTabs/appointmentsPage',
      },
    });
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      searchWithFilters: { search: '', filter: 'All' },
      forceSync: false,
    }));
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');

    loaded = await loadRouteChanged({
      manifestService: {
        getManifest: vi.fn(async () => ({
          platforms: {
            salesforce: {
              page: {
                appointment: {
                  supported: false,
                },
              },
            },
          },
        })),
      },
    });
    await loaded.handler.onEvent({
      data: {
        path: '/customizedTabs/appointmentsPage',
      },
    });
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).not.toHaveBeenCalled();
  });

  it('refreshes user settings on settings route only when the last sync is stale', async () => {
    seedStorage({
      crmAuthed: true,
    });
    vi.setSystemTime(new Date('2026-07-03T00:02:00.000Z'));
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      if (typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, 'crmAuthed')) {
        return { crmAuthed: true };
      }
      if (typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, 'lastUserSettingSyncDate')) {
        return { lastUserSettingSyncDate: new Date('2026-07-03T00:00:00.000Z') };
      }
      return {};
    });
    const { handler, userCore } = await loadRouteChanged();

    await handler.onEvent({
      data: {
        path: '/settings',
      },
    });

    expect(userCore.refreshUserSettings).toHaveBeenCalledWith({});
    expect(readStorage().lastUserSettingSyncDate).toEqual('2026-07-03T00:02:00.000Z');
  });
});
