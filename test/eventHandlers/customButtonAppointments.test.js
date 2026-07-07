import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

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
            canOpenAppointmentPage: true,
            appointmentPageUrl: 'https://{hostname}/appointments/{thirdPartyAppointmentId}?ats={atsUrl}',
          },
        },
      },
    },
  };
}

function dataFor(formData = {}, additionalInfo = {}) {
  return {
    requestId: 'request-1',
    body: {
      button: {
        formData,
        additionalInfo,
      },
    },
  };
}

async function loadAppointmentButton(modulePath, overrides = {}) {
  vi.resetModules();
  vi.mocked(axios.get).mockReset();
  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn((responseId, response) => {
      document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-post-message-response',
        responseId,
        response,
      }, '*');
    }),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const appointmentService = {
    updateAppointmentStatus: vi.fn(async () => ({ successful: true })),
    listAppointments: vi.fn(async () => [
      {
        id: 'appointment-1',
        title: 'Intro call',
        attendees: [{ id: 'contact-1', type: 'Lead' }],
      },
    ]),
    refreshAppointment: vi.fn(async () => ({ successful: true })),
    ...overrides.appointmentService,
  };
  vi.doMock('../../src/service/appointmentService.ts', () => appointmentService);

  vi.doMock('../../src/lib/appointmentUtils.ts', () => ({
    extractAppointmentsListContext: vi.fn(() => ({
      tab: 'upcoming',
      searchWithFilters: { search: 'Jane', filter: 'All' },
    })),
    normalizeAppointmentId: vi.fn((appointment) => appointment.id ?? appointment.thirdPartyAppointmentId),
    toCanonicalAppointment: vi.fn((appointment) => appointment),
    normalizeAttendees: vi.fn((attendees = []) => attendees.map((attendee) => (
      typeof attendee === 'string' ? { id: attendee } : attendee
    )).filter((attendee) => attendee?.id)),
  }));

  vi.doMock('../../src/lib/urlTemplate.ts', () => ({
    renderUrlTemplate: vi.fn(({ template, values }) => ({
      url: template
        .replace('{hostname}', values.hostname ?? '')
        .replace('{thirdPartyAppointmentId}', values.thirdPartyAppointmentId ?? '')
        .replace('{contactId}', values.contactId ?? '')
        .replace('{contactType}', values.contactType ?? '')
        .replace('{atsUrl}', values.atsUrl ?? ''),
    })),
  }));

  const contactCore = {
    openContactPage: vi.fn(async () => {}),
    ...overrides.contactCore,
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const appointmentCreatePage = {
    getAppointmentCreatePageRender: vi.fn((props) => ({ id: 'appointmentCreatePage', props })),
    submitAppointmentCreate: vi.fn(async () => ({ successful: true })),
    ...overrides.appointmentCreatePage,
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentCreatePage.ts', () => ({ default: appointmentCreatePage }));

  const appointmentEditPage = {
    getAppointmentEditPageRender: vi.fn((props) => ({ id: 'appointmentEditPage', props })),
    saveAppointmentEdits: vi.fn(async () => ({ successful: true })),
    ...overrides.appointmentEditPage,
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentEditPage.ts', () => ({ default: appointmentEditPage }));

  const appointmentsPage = {
    getAppointmentsPageWithRecords: vi.fn(async (props) => ({ id: 'appointmentsPage', props })),
    ...overrides.appointmentsPage,
  };
  vi.doMock('../../src/components/appointmentsPage/appointmentsPage.ts', () => ({ default: appointmentsPage }));

  const handler = await loadModule(modulePath);
  return {
    handler,
    util,
    appointmentService,
    appointmentCreatePage,
    appointmentEditPage,
    appointmentsPage,
    contactCore,
  };
}

describe('custom-button appointment handlers', () => {
  beforeEach(() => {
    globalThis.open = vi.fn();
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': {
        hostname: 'crm.example',
      },
      crm_extension_bullhorn_user_urls: {
        atsUrl: 'https://ats.example',
      },
    });
  });

  it('cancels and confirms appointments, refreshes the list, and responds to the widget', async () => {
    let loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCancel.ts',
      {
        appointmentService: {
          updateAppointmentStatus: vi.fn(async () => ({
            returnMessage: {
              messageType: 'warning',
              message: 'Already canceled',
              ttl: 3000,
              details: 'No-op',
            },
          })),
        },
      },
    );
    await loaded.handler.onEvent({
      data: dataFor({}, { thirdPartyAppointmentId: 'appointment-1' }),
      manifest: manifest(),
    });
    expect(loaded.appointmentService.updateAppointmentStatus).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appointment-1',
      status: 'canceled',
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Already canceled',
      ttl: 3000,
      details: 'No-op',
    });
    expect(loaded.util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentConfirm.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      listButtonItemId: 'appointment-2',
    });
    expect(loaded.appointmentService.updateAppointmentStatus).toHaveBeenCalledWith(expect.objectContaining({
      appointmentId: 'appointment-2',
      status: 'confirmed',
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Appointment confirmed successfully.',
      ttl: 3000,
    });
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      tab: 'upcoming',
      searchWithFilters: { search: 'Jane', filter: 'All' },
      forceSync: false,
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: expect.objectContaining({ id: 'appointmentsPage' }),
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('reports appointment status update failures through notifications and response messages', async () => {
    const loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCancel.ts',
      {
        appointmentService: {
          updateAppointmentStatus: vi.fn(async () => {
            throw new Error('service unavailable');
          }),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({}, { thirdPartyAppointmentId: 'appointment-1' }),
      manifest: manifest(),
    });

    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'service unavailable',
      ttl: 3000,
    });
    expect(loaded.util.responseMessage).toHaveBeenCalledWith('request-1', { error: 'service unavailable' });
  });

  it('opens appointment URLs from templates, fallback URLs, and warns when no link exists', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': {
        hostname: 'temp',
      },
      crm_extension_bullhorn_user_urls: {
        atsUrl: 'https://ats.example',
      },
      userSettings: {},
    });
    const loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenAppointment.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({ data: 'resolved.example' });

    await loaded.handler.onEvent({
      data: dataFor({ thirdPartyAppointmentId: 'id with spaces' }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(axios.get).toHaveBeenCalledWith('https://server.example/hostname?jwtToken=jwt-1');
    expect(open).toHaveBeenCalledWith('https://resolved.example/appointments/id%20with%20spaces?ats=ats.example', '_blank');

    await loaded.handler.onEvent({
      data: dataFor({ appointmentUrl: 'https://fallback.example/appointment' }),
      manifest: {
        serverUrl: 'https://server.example',
        platforms: { salesforce: { page: { appointment: { canOpenAppointmentPage: false } } } },
      },
      platformName: 'salesforce',
    });
    expect(open).toHaveBeenCalledWith('https://fallback.example/appointment', '_blank');

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: {
        serverUrl: 'https://server.example',
        platforms: { salesforce: { page: { appointment: { canOpenAppointmentPage: false } } } },
      },
      platformName: 'salesforce',
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'No appointment link available.',
      ttl: 3000,
    });
  });

  it('creates and saves appointments, navigating back to refreshed list only on success', async () => {
    let loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreateSave.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({
        title: 'New Appointment',
        returnTab: 'past',
        returnSearch: 'Jane',
        returnFilter: 'Mine',
      }),
      manifest: manifest(),
    });
    expect(loaded.appointmentCreatePage.submitAppointmentCreate).toHaveBeenCalledWith(expect.objectContaining({
      jwtToken: 'jwt-1',
      formData: expect.objectContaining({ title: 'New Appointment' }),
    }));
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      tab: 'past',
      searchWithFilters: { search: 'Jane', filter: 'Mine' },
      forceSync: true,
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Appointment created.',
      ttl: 3000,
    });

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentSave.ts',
      {
        appointmentEditPage: {
          saveAppointmentEdits: vi.fn(async () => ({
            successful: false,
            returnMessage: {
              messageType: 'error',
              message: 'Validation failed',
              ttl: 4000,
              details: 'Title required',
            },
          })),
        },
      },
    );
    await loaded.handler.onEvent({
      data: dataFor({ title: '' }),
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'error',
      message: 'Validation failed',
      ttl: 4000,
      details: 'Title required',
    });
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).not.toHaveBeenCalled();

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentSave.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({ title: 'Updated Appointment' }),
      manifest: manifest(),
    });
    expect(loaded.appointmentEditPage.saveAppointmentEdits).toHaveBeenCalledWith(expect.objectContaining({
      formData: expect.objectContaining({ title: 'Updated Appointment' }),
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Appointment updated.',
      ttl: 3000,
    });
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

  it('opens appointment create/edit pages and refreshes appointment rows and lists', async () => {
    let loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreate.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.appointmentCreatePage.getAppointmentCreatePageRender).toHaveBeenCalledWith({
      initialFormData: {
        returnTab: 'upcoming',
        returnSearch: 'Jane',
        returnFilter: 'All',
        emailMandatoryInAttendee: undefined,
      },
      appointmentTitle: 'Appointments',
      statusConfig: undefined,
      titleFieldConfig: undefined,
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/appointmentCreatePage',
        },
        targetOrigin: '*',
      },
    ]));

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentEdit.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformName: 'salesforce',
      listButtonItemId: 'appointment-1',
    });
    expect(loaded.appointmentService.listAppointments).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      range: 'upcoming',
      mineOnly: false,
      forceSync: false,
    });
    expect(loaded.appointmentEditPage.getAppointmentEditPageRender).toHaveBeenCalledWith(expect.objectContaining({
      appointment: expect.objectContaining({
        id: 'appointment-1',
        returnTab: 'upcoming',
        returnSearch: 'Jane',
        returnFilter: 'All',
      }),
    }));

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefresh.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({}, { thirdPartyAppointmentId: 'appointment-1' }),
      manifest: manifest(),
      listButtonItemId: 'appointment-1',
    });
    expect(loaded.appointmentService.refreshAppointment).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      jwtToken: 'jwt-1',
      appointmentId: 'appointment-1',
    });
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      forceSync: false,
    }));

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefreshList.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
    });
    expect(loaded.appointmentsPage.getAppointmentsPageWithRecords).toHaveBeenCalledWith(expect.objectContaining({
      forceSync: true,
    }));
  });

  it('opens appointment contacts from URLs, attendees, explicit contact fields, and phone fallbacks', async () => {
    let loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.ts',
    );
    globalThis.open = vi.fn();
    await loaded.handler.onEvent({
      data: dataFor({}, {
        contactUrl: 'https://crm.example/contact/direct',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(open).toHaveBeenCalledWith('https://crm.example/contact/direct');

    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': {
        hostname: 'temp',
      },
      userSettings: {},
    });
    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.ts',
    );
    vi.mocked(axios.get).mockResolvedValueOnce({ data: 'resolved.example' });
    await loaded.handler.onEvent({
      data: dataFor({}, {
        attendees: [{ id: 'contact-1', type: 'Lead' }],
      }),
      manifest: {
        ...manifest(),
        platforms: {
          salesforce: {
            contactPageUrl: 'https://{hostname}/contacts/{contactType}/{contactId}',
          },
        },
      },
      platformName: 'salesforce',
    });
    expect(axios.get).toHaveBeenCalledWith('https://server.example/hostname?jwtToken=jwt-1');
    expect(open).toHaveBeenCalledWith('https://resolved.example/contacts/Lead/contact-1');

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.ts',
      {
        appointmentService: {
          listAppointments: vi.fn(async () => [
            {
              id: 'appointment-2',
              attendeeIds: [{ id: 'fallback-contact', type: 'Contact' }],
            },
          ]),
        },
      },
    );
    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformName: 'salesforce',
      listButtonItemId: 'appointment-2',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      contactId: 'fallback-contact',
      contactType: 'Contact',
    });

    loaded = await loadAppointmentButton(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.ts',
    );
    await loaded.handler.onEvent({
      data: dataFor({}, {
        contactId: 'explicit-contact',
        contactType: 'Account',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      contactId: 'explicit-contact',
      contactType: 'Account',
    });

    await loaded.handler.onEvent({
      data: dataFor({}, {
        phoneNumber: '+16505550100',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550100',
      multiContactMatchBehavior: 'disabled',
    });
  });
});
