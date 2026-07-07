// @ts-nocheck
import axios from 'axios';
import userCore from '../../src/core/user.ts';
import { listAppointments } from '../../src/service/appointmentService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetFrameWindow } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/core/user.ts', () => ({
  default: {
    getShowAppointmentsTabSetting: vi.fn((settings) => ({
      value: settings?.showAppointmentsTab?.value ?? true,
    })),
    getShowCalldownTabSetting: vi.fn((settings) => ({
      value: settings?.showCalldownTab?.value ?? true,
    })),
  },
}));

vi.mock('../../src/service/appointmentService.ts', () => ({
  listAppointments: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadPage(modulePath) {
  vi.resetModules();
  return loadModule(modulePath);
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        page: {
          appointment: {
            title: 'Visits',
            showConfirm: true,
            filterStatus: {
              value: ['All', 'Scheduled', 'Canceled'],
            },
          },
        },
      },
    },
  };
}

describe('appointmentsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-07-03T08:00:00Z') });
    vi.mocked(listAppointments).mockReset();
    vi.mocked(getPlatformInfo).mockReset();
    vi.mocked(userCore.getShowAppointmentsTabSetting).mockImplementation((settings) => ({
      value: settings?.showAppointmentsTab?.value ?? true,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders tab settings and hides the appointments page when the user disables it', async () => {
    const appointmentsPage = await loadPage('../../src/components/appointmentsPage/appointmentsPage.ts');

    const page = appointmentsPage.getAppointmentsPageRender({
      manifest: manifest(),
      platformName: 'salesforce',
      selectedTab: 'past',
      searchWithFilters: {
        search: 'Jane',
        filter: 'Canceled',
      },
      filterOptions: ['Scheduled', 'Canceled'],
      userSettings: {
        showAppointmentsTab: { value: false },
      },
    });

    expect(page.hidden).toBe(true);
    expect(page.formData).toMatchObject({
      tab: 'past',
      searchWithFilters: {
        search: 'Jane',
        filter: 'Canceled',
      },
    });
    expect(page.schema.properties.appointments.oneOf).toEqual([]);
  });

  it('loads, normalizes, filters, and renders appointment records with list actions', async () => {
    vi.mocked(getPlatformInfo).mockResolvedValue({ platformName: 'salesforce' });
    vi.mocked(listAppointments).mockResolvedValue([
      {
        externalId: 'future-1',
        summary: 'Intro with Jane',
        start: '2099-01-01T10:30:00Z',
        status: 'confirmed',
        attendees: [{ id: 'contact-1', name: 'Jane Smith', type: 'Lead' }],
      },
      {
        externalId: 'past-1',
        summary: 'Old visit',
        start: '2000-01-01T10:30:00Z',
        status: 'cancelled',
        attendees: [{ id: 'contact-2', name: 'Alex Green', type: 'Contact' }],
      },
      {
        id: 'future-2',
        title: 'Unrelated',
        startTimeUtc: '2099-01-02T10:30:00Z',
        status: 'scheduled',
        participantName: 'Chris',
      },
    ]);
    const appointmentsPage = await loadPage('../../src/components/appointmentsPage/appointmentsPage.ts');

    const page = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest: manifest(),
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      forceSync: true,
      searchWithFilters: {
        search: 'jane',
        filter: 'Scheduled',
      },
    });

    expect(getPlatformInfo).toHaveBeenCalled();
    expect(listAppointments).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      range: 'upcoming',
      mineOnly: false,
      forceSync: true,
    });
    expect(page.hidden).toBe(false);
    expect(page.schema.properties.appointments.oneOf).toEqual([
      expect.objectContaining({
        const: 'future-1',
        title: 'Intro with Jane',
        description: 'Jane Smith',
        actions: expect.arrayContaining([
          expect.objectContaining({ id: 'appointmentEdit' }),
          expect.objectContaining({ id: 'appointmentConfirm' }),
          expect.objectContaining({ id: 'appointmentCancel', color: 'danger.b03' }),
        ]),
        additionalInfo: expect.objectContaining({
          thirdPartyAppointmentId: 'future-1',
          attendees: [{ id: 'contact-1', name: 'Jane Smith', type: 'Lead' }],
        }),
      }),
    ]);
  });

  it('returns a hidden appointments page without calling the server and renders empty state otherwise', async () => {
    vi.mocked(userCore.getShowAppointmentsTabSetting).mockReturnValue({ value: false });
    const appointmentsPage = await loadPage('../../src/components/appointmentsPage/appointmentsPage.ts');

    const hidden = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest: manifest(),
      jwtToken: 'jwt-1',
      platformName: 'salesforce',
      userSettings: {
        showAppointmentsTab: { value: false },
      },
    });
    expect(hidden.hidden).toBe(true);
    expect(hidden.unreadCount).toBe(0);
    expect(listAppointments).not.toHaveBeenCalled();

    vi.mocked(userCore.getShowAppointmentsTabSetting).mockReturnValue({ value: true });
    vi.mocked(listAppointments).mockResolvedValue([]);
    const empty = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest: manifest(),
      jwtToken: 'jwt-1',
      platformName: 'salesforce',
      userSettings: {
        showAppointmentsTab: { value: true },
      },
    });
    expect(empty.schema.properties.appointments.oneOf).toEqual([
      expect.objectContaining({
        const: 'noAppointments',
        title: 'No Visits',
        actions: [expect.objectContaining({ id: 'appointmentsRefreshButton' })],
      }),
    ]);
  });
});

describe('calldownPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-07-03T08:00:00Z') });
    vi.mocked(axios.get).mockReset();
    vi.mocked(userCore.getShowCalldownTabSetting).mockImplementation((settings) => ({
      value: settings?.showCalldownTab?.value ?? true,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders calldown records enriched from widget matcher and contact cache', async () => {
    seedStorage({
      'platform-info': {
        platformName: 'salesforce',
      },
      calldownContactCache: {
        'contact-2': {
          contactName: 'Cached Alex',
          phoneNumber: '+16505550200',
          contactType: 'Lead',
        },
        stale: {
          contactName: 'Stale Contact',
        },
      },
    });
    getWidgetFrameWindow().phone.contactMatcher.data = {
      '+16505550100': {
        salesforce: {
          data: [
            { id: 'contact-1', name: 'Widget Jane', type: 'Contact' },
            { id: 'new-contact', name: 'New', isNewContact: true },
          ],
        },
      },
    };
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [
          {
            id: 'row-1',
            contactId: 'contact-1',
            status: 'called',
            lastCallAt: '2026-07-03T07:30:00Z',
          },
          {
            id: 'row-2',
            contactId: 'contact-2',
            status: 'scheduled',
            scheduledAt: '2026-07-03T12:00:00Z',
          },
          {
            id: 'row-3',
            contactId: 'contact-3',
            contactName: 'Old scheduled',
            phoneNumber: '+16505550300',
            status: 'scheduled',
            scheduledAt: '2026-07-02T12:00:00Z',
          },
        ],
      },
    });
    const calldownPage = await loadPage('../../src/components/calldownPage.ts');

    const page = await calldownPage.getCalldownPageWithRecords({
      manifest: manifest(),
      searchWithFilters: {
        search: '',
        filter: 'All',
      },
      userSettings: {
        showCalldownTab: { value: true },
      },
    });

    expect(axios.get).toHaveBeenCalledWith('https://server.example/calldown', {
      params: { status: 'All' },
    });
    expect(page.hidden).toBe(false);
    expect(page.unreadCount).toBe(1);
    expect(page.schema.properties.records.oneOf).toEqual([
      expect.objectContaining({
        const: 'row-1',
        title: 'Widget Jane',
        description: '+16505550100',
        authorName: 'Called',
        actions: expect.not.arrayContaining([expect.objectContaining({ id: 'calldownActionEdit' })]),
      }),
      expect.objectContaining({
        const: 'row-2',
        title: 'Cached Alex',
        description: '+16505550200',
        authorName: 'Scheduled',
        actions: expect.arrayContaining([expect.objectContaining({ id: 'calldownActionEdit' })]),
      }),
      expect.objectContaining({
        const: 'row-3',
        authorName: 'Not Called',
      }),
    ]);
    expect(readStorage().calldownListCache).toHaveLength(3);
    expect(readStorage().calldownContactCache).toEqual({
      'contact-2': {
        contactName: 'Cached Alex',
        phoneNumber: '+16505550200',
        contactType: 'Lead',
      },
    });
  });

  it('filters calldown records, marks the tab hidden, and keeps an empty list on API failure', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'row-1',
              contactId: 'contact-1',
              contactName: 'Jane Smith',
              phoneNumber: '+16505550100',
              status: 'called',
              lastCallAt: '2026-07-03T07:30:00Z',
            },
            {
              id: 'row-2',
              contactId: 'contact-2',
              contactName: 'Alex Green',
              phoneNumber: '+16505550200',
              status: 'scheduled',
              scheduledAt: '2026-07-03T12:00:00Z',
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error('network'));
    const calldownPage = await loadPage('../../src/components/calldownPage.ts');

    const filtered = await calldownPage.getCalldownPageWithRecords({
      manifest: manifest(),
      searchWithFilters: {
        search: 'alex',
        filter: 'Scheduled',
      },
      userSettings: {
        showCalldownTab: { value: false },
      },
    });
    expect(filtered.hidden).toBe(true);
    expect(filtered.schema.properties.records.oneOf).toEqual([
      expect.objectContaining({
        const: 'row-2',
        title: 'Alex Green',
      }),
    ]);

    const failed = await calldownPage.getCalldownPageWithRecords({
      manifest: manifest(),
      filterStatus: 'Called',
    });
    expect(failed.schema.properties.records.oneOf).toEqual([]);
  });
});
