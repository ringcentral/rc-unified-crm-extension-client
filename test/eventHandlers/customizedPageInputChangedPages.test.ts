import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        page: {
          appointment: {
            supported: true,
            title: 'CRM Appointments',
            status: [{ const: 'confirmed' }],
            titleField: { defaultValue: 'Meeting' },
            emailMandatoryInAttendee: true,
          },
        },
      },
    },
  };
}

function dataFor(overrides: Record<string, any> = {}) {
  return {
    requestId: 'request-1',
    body: {
      keys: [],
      formData: {},
      page: { id: 'page' },
      ...overrides,
    },
  };
}

async function flushAsyncHandlers() {
  await Promise.resolve();
  await Promise.resolve();
}

async function loadPageHandler(modulePath, overrides: Record<string, any> = {}) {
  vi.resetModules();
  vi.mocked(axios.get).mockReset();
  const util = {
    createDebounceHandler: vi.fn(() => async (request, handler) => handler(request)),
    responseMessage: vi.fn((responseId, response) => {
      document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-post-message-response',
        responseId,
        response,
      }, '*');
    }),
    getRcAccessToken: vi.fn(() => 'rc-access-token'),
    getRcInfo: vi.fn(async () => ({
      value: {
        cachedData: {
          accountInfo: {
            regionalSettings: {
              timezone: { name: 'Asia/Shanghai' },
            },
          },
        },
      },
    })),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const rcApiInstance = {
    getRcExtensionList: vi.fn(async () => [
      { id: 'extension-1', name: 'Agent One' },
      { id: 'me', name: 'Me' },
    ]),
  };
  const RcAPI = vi.fn(function RcAPI() {
    return rcApiInstance;
  });
  vi.doMock('../../src/lib/rcAPI.ts', () => ({ RcAPI }));

  const contactCore = {
    getContact: vi.fn(async () => ({
      matched: true,
      contactInfo: [{ id: 'contact-1', phoneNumber: '+16505550100' }],
    })),
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const logPage = {
    getUnloggedCallPageRender: vi.fn(({ unloggedCalls }) => ({
      id: 'unloggedCallPage',
      unloggedCalls,
    })),
  };
  vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));

  const userCore = {
    getShowUserReportTabSetting: vi.fn(() => ({ value: true })),
    getUserReportStats: vi.fn(async () => ({ loggedCallCount: 2 })),
    getShowAppointmentsTabSetting: vi.fn(() => ({ value: true })),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const adminCore = {
    getAdminReportStats: vi.fn(async () => ({
      groupedBy: 'day',
      groupKeys: ['2026-07-03'],
      itemKeys: ['calls'],
      totalCalls: 4,
    })),
    getUserExtensionReportStats: vi.fn(async () => ({
      loggedCallCount: 3,
    })),
    ...overrides.adminCore,
  };
  vi.doMock('../../src/core/admin.ts', () => ({ default: adminCore }));

  const reportPage = {
    getReportsPageRender: vi.fn((props) => ({
      id: 'reportPage',
      props,
    })),
  };
  vi.doMock('../../src/components/reportPage/reportPage.ts', () => ({ default: reportPage }));

  const appointmentCreatePage = {
    getAppointmentCreatePageRender: vi.fn((props) => ({
      id: 'appointmentCreatePage',
      props,
    })),
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentCreatePage.ts', () => ({ default: appointmentCreatePage }));

  const appointmentEditPage = {
    getAppointmentEditPageRender: vi.fn((props) => ({
      id: 'appointmentEditPage',
      props,
    })),
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentEditPage.ts', () => ({ default: appointmentEditPage }));

  const appointmentsPage = {
    getAppointmentsPageWithRecords: vi.fn(async (props) => ({
      id: 'appointmentsPage',
      props,
    })),
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentsPage.ts', () => ({ default: appointmentsPage }));

  const calldownPage: Record<string, any> = {
    getCalldownPageWithRecords: vi.fn(async (props) => ({
      id: 'calldownPage',
      props,
    })),
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));

  const handler = await loadModule(modulePath);
  return {
    handler,
    util,
    RcAPI,
    rcApiInstance,
    contactCore,
    logPage,
    userCore,
    adminCore,
    reportPage,
    appointmentCreatePage,
    appointmentEditPage,
    appointmentsPage,
    calldownPage,
  };
}

describe('customizedPage inputChanged page handlers', () => {
  it('opens unlogged calls from report summaries and reuses matched contact lookups', async () => {
    seedStorage({ isAdmin: true, userSettings: {} });
    const { handler, contactCore, logPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        formData: {
          unloggedCallSummary: 'unloggedCallCount',
          unloggedCalls: [
            { sessionId: 'call-1', direction: 'Inbound', from: { phoneNumber: '+16505550100' }, to: {} },
            { sessionId: 'call-2', direction: 'Inbound', from: { phoneNumber: '+16505550100' }, to: {} },
          ],
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(contactCore.getContact).toHaveBeenCalledTimes(1);
    expect(logPage.getUnloggedCallPageRender).toHaveBeenCalledWith({
      unloggedCalls: [
        expect.objectContaining({ matched: true, phoneNumber: '+16505550100' }),
        expect.objectContaining({ matched: true, phoneNumber: '+16505550100' }),
      ],
    });
    expect(readStorage().unloggedCallPageDataCache).toHaveLength(2);
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/unloggedCallPage',
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('ignores invalid admin report extension selections before rendering', async () => {
    seedStorage({
      isAdmin: true,
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    const { handler, adminCore, userCore, reportPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['rcExtensionList'],
        formData: {
          rcExtensionList: 'unknown-extension',
          dateRangeEnums: 'Last 24 hours',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(reportPage.getReportsPageRender).not.toHaveBeenCalled();
    expect(adminCore.getAdminReportStats).not.toHaveBeenCalled();
    expect(userCore.getUserReportStats).not.toHaveBeenCalled();
  });

  it('fetches company report stats with the account timezone and selected group key', async () => {
    seedStorage({
      isAdmin: true,
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    const { handler, adminCore, reportPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['tab'],
        formData: {
          tab: 'companyReportTab',
          rcExtensionList: 'extension-1',
          dateRangeEnums: 'Last 7 days',
          groupKeyEnums: 'day',
          startDate: '2026-07-01',
          endDate: '2026-07-03',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(adminCore.getAdminReportStats).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      timezone: 'Asia/Shanghai',
      groupBy: 'day',
    }));
    expect(reportPage.getReportsPageRender).toHaveBeenCalledWith(expect.objectContaining({
      selectedTab: 'companyReportTab',
      selectedRcExtension: 'extension-1',
      companyStats: expect.objectContaining({
        groupedBy: 'day',
        dateRange: 'Last 7 days',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
      }),
      userStats: undefined,
    }));
  });

  it('fetches current-user report stats for the user report tab', async () => {
    seedStorage({
      isAdmin: true,
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    const { handler, adminCore, userCore, reportPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['tab'],
        formData: {
          tab: 'userReportTab',
          rcExtensionList: 'me',
          dateRangeEnums: 'Last 30 days',
          startDate: '2026-07-01',
          endDate: '2026-07-03',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(userCore.getUserReportStats).toHaveBeenCalledWith(expect.objectContaining({
      dateRange: 'Last 30 days',
    }));
    expect(adminCore.getUserExtensionReportStats).not.toHaveBeenCalled();
    expect(reportPage.getReportsPageRender).toHaveBeenCalledWith(expect.objectContaining({
      selectedTab: 'userReportTab',
      selectedRcExtension: 'me',
      userStats: expect.objectContaining({
        loggedCallCount: 2,
        dateRange: 'Last 30 days',
      }),
      companyStats: undefined,
    }));
  });

  it('updates the selected company report item without refetching stats', async () => {
    seedStorage({
      isAdmin: true,
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    const { handler, adminCore, userCore, reportPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['itemKeyEnums'],
        formData: {
          tab: 'companyReportTab',
          rcExtensionList: 'extension-1',
          dateRangeEnums: 'Select date range...',
          startDate: '2026-07-01',
          endDate: '2026-07-03',
          companyStats: {
            groupedBy: 'user',
            itemKeys: ['calls'],
          },
          itemKeyEnums: 'calls',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(reportPage.getReportsPageRender).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedItemKey: 'calls',
      companyStats: expect.objectContaining({ groupedBy: 'user' }),
    }));
    expect(adminCore.getAdminReportStats).not.toHaveBeenCalled();
    expect(userCore.getUserReportStats).not.toHaveBeenCalled();
  });

  it('stops report loading without rendering when a custom date range is invalid', async () => {
    seedStorage({
      isAdmin: true,
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
    });
    const { handler, adminCore, userCore, reportPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/reportPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['tab'],
        formData: {
          tab: 'userReportTab',
          rcExtensionList: 'me',
          dateRangeEnums: 'Select date range...',
          startDate: '2026-07-03',
          endDate: '2026-07-01',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
    expect(reportPage.getReportsPageRender).not.toHaveBeenCalled();
    expect(adminCore.getAdminReportStats).not.toHaveBeenCalled();
    expect(userCore.getUserReportStats).not.toHaveBeenCalled();
  });

  it('normalizes appointment create end time when start time is after end time', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['dateTime'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          dateTime: '2026-07-03T10:00:00',
          endDateTime: '2026-07-03T09:30:00',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(appointmentCreatePage.getAppointmentCreatePageRender).toHaveBeenCalledWith(expect.objectContaining({
      initialFormData: expect.objectContaining({
        endDateTime: '2026-07-03T10:00:00',
        duration: 'PT0M',
      }),
      appointmentTitle: 'CRM Appointments',
    }));
  });

  it('recalculates appointment edit duration from end time changes', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    const { handler, appointmentEditPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['endDateTime'],
        page: { id: 'appointmentEditPage' },
        formData: {
          dateTime: '2026-07-03T10:00:00',
          endDateTime: '2026-07-03T11:30:00',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(appointmentEditPage.getAppointmentEditPageRender).toHaveBeenCalledWith(expect.objectContaining({
      initialFormData: expect.objectContaining({
        duration: 'PT1H30M',
      }),
    }));
  });

  it('handles appointment date-time early returns and whole-hour durations', async () => {
    const { handler, appointmentCreatePage, appointmentEditPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['dateTime'],
        page: { id: 'appointmentCreatePage' },
        formData: {},
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await handler.onEvent({
      data: dataFor({
        keys: ['dateTime'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          dateTime: 'not-a-date',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(appointmentCreatePage.getAppointmentCreatePageRender).not.toHaveBeenCalled();

    await handler.onEvent({
      data: dataFor({
        keys: ['endDateTime'],
        page: { id: 'appointmentEditPage' },
        formData: {
          dateTime: '2026-07-03T10:00:00',
          endDateTime: '2026-07-03T12:00:00',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(appointmentEditPage.getAppointmentEditPageRender).toHaveBeenCalledWith(expect.objectContaining({
      initialFormData: expect.objectContaining({
        duration: 'PT2H',
      }),
    }));
  });

  it('defaults appointment end time when end time is missing', async () => {
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['dateTime'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          dateTime: '2026-07-03T10:00:00',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(appointmentCreatePage.getAppointmentCreatePageRender).toHaveBeenCalledWith(expect.objectContaining({
      initialFormData: expect.objectContaining({
        endDateTime: '2026-07-03T10:00:00',
        duration: 'PT0M',
      }),
    }));
  });

  it('searches appointment participant contacts and keeps selected candidates', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        contact: [
          { id: 'candidate-1', type: 'Lead', name: 'Existing', email: 'existing@example.test' },
          { id: 'candidate-2', type: 'Lead', name: 'New Person', email: 'new@example.test' },
        ],
      },
    });

    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          participantContactIds: ['candidate-1', 'Jane'],
          participantCandidates: [
            { id: 'candidate-1', type: 'Lead', name: 'Existing' },
          ],
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await flushAsyncHandlers();
    expect(axios.get).toHaveBeenCalledWith('https://server.example/custom/contact/search', {
      headers: {
        Authorization: 'Bearer jwt-1',
      },
      params: {
        name: 'Jane',
      },
    });
    expect(appointmentCreatePage.getAppointmentCreatePageRender).toHaveBeenLastCalledWith(expect.objectContaining({
      initialFormData: expect.objectContaining({
        participantContactIds: ['candidate-1'],
        emailMandatoryInAttendee: true,
        participantCandidates: [
          expect.objectContaining({ id: 'candidate-1', email: 'existing@example.test', emailChecked: true }),
          expect.objectContaining({ id: 'candidate-2', name: 'New Person', emailChecked: true }),
        ],
      }),
    }));
  });

  it('ignores appointment participant changes that do not contain a search query', async () => {
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: [],
        formData: {},
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        formData: {
          participantContactIds: 'not-an-array',
          participantCandidates: 'not-an-array',
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        formData: {
          participantContactIds: ['candidate-1'],
          participantCandidates: [{ id: 'candidate-1' }],
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        formData: {
          participantContactIds: ['   '],
          participantCandidates: [],
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(axios.get).not.toHaveBeenCalled();
    expect(appointmentCreatePage.getAppointmentCreatePageRender).not.toHaveBeenCalled();
  });

  it('searches appointment participants without JWT and falls back to default appointment config', async () => {
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          participantContactIds: ['Jane'],
          participantCandidates: [],
          emailMandatoryInAttendee: false,
        },
      }),
      manifest: {
        serverUrl: 'https://server.example',
        platforms: {},
      },
      platformName: 'salesforce',
    });
    await flushAsyncHandlers();

    expect(axios.get).toHaveBeenCalledWith('https://server.example/custom/contact/search', {
      params: {
        name: 'Jane',
      },
    });
    expect(appointmentCreatePage.getAppointmentCreatePageRender).toHaveBeenCalledWith(expect.objectContaining({
      appointmentTitle: 'Appointments',
      statusConfig: undefined,
      titleFieldConfig: undefined,
      initialFormData: expect.objectContaining({
        participantCandidates: [],
        participantContactIds: [],
        emailMandatoryInAttendee: false,
      }),
    }));
  });

  it('dedupes appointment participant candidates while preserving confirmed email checks', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        contact: [
          null,
          { id: 'candidate-1', type: 'Lead', name: 'Ignored', email: 'ignored@example.test' },
          { id: 'candidate-2', type: null, name: null },
          { id: '', type: 'Lead', name: 'No Id' },
        ],
      },
    });

    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          participantContactIds: ['candidate-1', 'New person'],
          participantCandidates: [
            null,
            { id: 'candidate-1' },
            {
              id: 'candidate-1',
              type: 'Contact',
              name: 'Existing Person',
              email: 'existing@example.test',
              emailChecked: true,
            },
          ],
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await flushAsyncHandlers();

    expect(appointmentCreatePage.getAppointmentCreatePageRender).toHaveBeenCalledWith(expect.objectContaining({
      initialFormData: expect.objectContaining({
        participantCandidates: [
          {
            id: 'candidate-1',
            type: 'Contact',
            name: 'Existing Person',
            email: 'existing@example.test',
            emailChecked: true,
          },
          {
            id: 'candidate-2',
            type: '',
            name: '',
            emailChecked: true,
          },
        ],
      }),
    }));
  });

  it('turns off appointment participant loading when search fails', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const searchError = new Error('search failed');
    const { handler, appointmentCreatePage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.ts',
    );
    vi.mocked(axios.get).mockRejectedValueOnce(searchError);

    await handler.onEvent({
      data: dataFor({
        keys: ['participantContactIds'],
        page: { id: 'appointmentCreatePage' },
        formData: {
          participantContactIds: ['Jane'],
          participantCandidates: [],
        },
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    await flushAsyncHandlers();

    expect(console.error).toHaveBeenCalledWith('Appointment participant search failed:', searchError);
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
    expect(appointmentCreatePage.getAppointmentCreatePageRender).not.toHaveBeenCalled();
  });

  it('ignores appointment page refresh events without list filters', async () => {
    seedStorage({
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
      appointmentsLastState: { tab: 'upcoming', search: '', filter: 'All' },
    });
    const { handler, appointmentsPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.ts',
    );

    await handler.onEvent({
      data: dataFor({ keys: ['appointments'], formData: {} }),
      manifest: manifest(),
    });
    expect(appointmentsPage.getAppointmentsPageWithRecords).not.toHaveBeenCalled();
  });

  it('ignores appointment refreshes when the appointments tab is hidden by settings', async () => {
    seedStorage({
      userSettings: { showAppointmentsTab: { value: false } },
      rcUnifiedCrmExtJwt: 'jwt-1',
      appointmentsLastState: { tab: 'upcoming', search: '', filter: 'All' },
    });
    const { handler, appointmentsPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.ts',
      {
        userCore: {
          getShowAppointmentsTabSetting: vi.fn(() => ({ value: false })),
        },
      },
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['searchWithFilters'],
        formData: {
          tab: 'upcoming',
          searchWithFilters: { search: 'Jane', filter: 'All' },
        },
      }),
      manifest: manifest(),
    });

    expect(appointmentsPage.getAppointmentsPageWithRecords).not.toHaveBeenCalled();
  });

  it('refreshes appointments for search/filter changes', async () => {
    seedStorage({
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
      appointmentsLastState: { tab: 'upcoming', search: '', filter: 'All' },
    });
    const { handler, appointmentsPage, util } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['searchWithFilters'],
        formData: {
          tab: 'upcoming',
          searchWithFilters: { search: 'Jane', filter: 'All' },
        },
      }),
      manifest: manifest(),
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(appointmentsPage.getAppointmentsPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      jwtToken: 'jwt-1',
      tab: 'upcoming',
      searchWithFilters: { search: 'Jane', filter: 'All' },
      forceSync: false,
    }));
  });

  it('refreshes appointments immediately for filter changes and reports refresh errors', async () => {
    seedStorage({
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
      appointmentsLastState: { tab: 'upcoming', search: 'Jane', filter: 'All' },
    });
    const { handler, appointmentsPage, util } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['searchWithFilters'],
        formData: {
          tab: 'upcoming',
          searchWithFilters: { search: 'Jane', filter: 'Canceled' },
        },
      }),
      manifest: manifest(),
    });

    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-on' }, '*');
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
    expect(readStorage().appointmentsLastState).toEqual({ tab: 'upcoming', search: 'Jane', filter: 'Canceled' });

    appointmentsPage.getAppointmentsPageWithRecords.mockRejectedValueOnce(new Error('refresh failed'));
    await handler.onEvent({
      data: dataFor({
        requestId: 'request-error',
        keys: ['tab'],
        formData: {
          tab: 'past',
          searchWithFilters: { search: 'Jane', filter: 'Canceled' },
        },
      }),
      manifest: manifest(),
    });

    expect(util.responseMessage).toHaveBeenLastCalledWith('request-1', { error: 'refresh failed' });
  });

  it('refreshes appointments immediately for tab changes and remembers list state', async () => {
    seedStorage({
      userSettings: {},
      rcUnifiedCrmExtJwt: 'jwt-1',
      appointmentsLastState: { tab: 'upcoming', search: '', filter: 'All' },
    });
    const { handler } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['tab'],
        formData: {
          tab: 'past',
          searchWithFilters: { search: 'Jane', filter: 'Mine' },
        },
      }),
      manifest: manifest(),
    });
    expect(readStorage().appointmentsLastState).toEqual({ tab: 'past', search: 'Jane', filter: 'Mine' });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customizedTabs/appointmentsPage',
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('refreshes calldown list for search text changes', async () => {
    seedStorage({
      userSettings: {},
      calldownLastState: { search: '', filter: 'All' },
    });
    const { handler, calldownPage, util } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['searchWithFilters'],
        formData: {
          searchWithFilters: { search: 'Jane', filter: 'All' },
        },
      }),
      manifest: manifest(),
    });
    await flushAsyncHandlers();
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      searchWithFilters: { search: 'Jane', filter: 'All' },
    }));
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('shows calldown loading state for filter changes', async () => {
    seedStorage({
      userSettings: {},
      calldownLastState: { search: 'Jane', filter: 'All' },
    });
    const { handler } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.ts',
    );

    await handler.onEvent({
      data: dataFor({
        keys: ['searchWithFilters'],
        formData: {
          searchWithFilters: { search: 'Jane', filter: 'Completed' },
        },
      }),
      manifest: manifest(),
    });
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-on' }, '*');
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
  });

  it('responds with calldown refresh errors', async () => {
    seedStorage({
      userSettings: {},
      calldownLastState: { search: '', filter: 'All' },
    });
    const { handler, calldownPage, util } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.ts',
    );
    calldownPage.getCalldownPageWithRecords.mockRejectedValueOnce(new Error('calldown failed'));

    await handler.onEvent({
      data: dataFor({
        keys: ['searchWithFilters'],
        formData: {
          searchWithFilters: { search: 'Jane', filter: 'Open' },
        },
      }),
      manifest: manifest(),
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { error: 'calldown failed' });
  });

  it('refreshes calldown list for non-search changes with legacy filters', async () => {
    seedStorage({
      userSettings: {},
      calldownLastState: { search: '', filter: 'All' },
    });
    const { handler, calldownPage } = await loadPageHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/calldownPage.ts',
    );
    calldownPage.getCalldownPageWithRecords.mockResolvedValueOnce({ id: 'calldownPage' });

    await handler.onEvent({
      data: dataFor({
        keys: ['rowAction'],
        formData: {
          filterName: 'Jane',
          filterStatus: 'All',
        },
      }),
      manifest: manifest(),
    });
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      filterName: 'Jane',
      filterStatus: 'All',
    }));
  });
});
