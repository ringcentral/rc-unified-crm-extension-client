const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages = [], widgetMessages = []) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
    open(url, target) {
      windowMessages.push({ openedUrl: url, target });
    },
  };
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            widgetMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };
}

test('appointment refresh list reloads the current tab with force sync', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const listPageCalls = [];
  const appointmentRefreshList = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentRefreshList.js',
    {
      stubs: {
        '../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords(args) {
            listPageCalls.push(args);
            return {
              id: 'appointmentsPage',
              refreshed: true,
            };
          },
        },
        '../../../lib/appointmentUtils': {
          extractAppointmentsListContext(data) {
            assert.equal(data.requestId, 'req-refresh-list');
            return {
              tab: 'past',
              searchWithFilters: {
                search: 'demo',
                filter: 'Mine',
              },
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await appointmentRefreshList.onEvent({
    data: {
      requestId: 'req-refresh-list',
      body: {},
    },
    manifest,
  });

  assert.deepEqual(listPageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'past',
      searchWithFilters: {
        search: 'demo',
        filter: 'Mine',
      },
      forceSync: true,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentsPage',
          refreshed: true,
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('appointment cancel updates status, shows server return message, refreshes list, and responds', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const updateStatusCalls = [];
  const listPageCalls = [];
  const notifications = [];
  const responses = [];

  const appointmentCancel = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCancel.js',
    {
      stubs: {
        '../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords(args) {
            listPageCalls.push(args);
            return {
              id: 'appointmentsPage',
              rows: [],
            };
          },
        },
        '../../../service/appointmentService': {
          async updateAppointmentStatus(args) {
            updateStatusCalls.push(args);
            return {
              successful: true,
              returnMessage: {
                messageType: 'success',
                message: 'Canceled in CRM',
                ttl: 4500,
                details: {
                  appointmentId: args.appointmentId,
                },
              },
            };
          },
        },
        '../../../lib/appointmentUtils': {
          extractAppointmentsListContext() {
            return {
              tab: 'upcoming',
              searchWithFilters: {
                search: 'Ada',
                filter: 'All',
              },
            };
          },
        },
        '../../../lib/util': {
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
          showNotification(notification) {
            notifications.push(notification);
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };

  await appointmentCancel.onEvent({
    data: {
      requestId: 'req-cancel-appointment',
      body: {
        button: {
          additionalInfo: {
            thirdPartyAppointmentId: 'ignored-appointment',
          },
        },
      },
    },
    manifest,
    listButtonItemId: 'appointment-2',
  });

  assert.deepEqual(updateStatusCalls, [
    {
      serverUrl: 'https://server.example.com',
      jwtToken: 'crm-jwt',
      appointmentId: 'appointment-2',
      status: 'canceled',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Canceled in CRM',
      ttl: 4500,
      details: {
        appointmentId: 'appointment-2',
      },
    },
  ]);
  assert.deepEqual(listPageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'upcoming',
      searchWithFilters: {
        search: 'Ada',
        filter: 'All',
      },
      forceSync: false,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentsPage',
          rows: [],
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-cancel-appointment',
      payload: {
        data: 'ok',
      },
    },
  ]);
});

test('appointment save updates the appointment, refreshes the return list, and navigates back to appointments tab', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const saveCalls = [];
  const listPageCalls = [];
  const notifications = [];

  const appointmentSave = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentSave.js',
    {
      stubs: {
        '../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../components/appointmentsPage/appointmentEditPage': {
          async saveAppointmentEdits(args) {
            saveCalls.push(args);
            return {
              successful: true,
            };
          },
        },
        '../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords(args) {
            listPageCalls.push(args);
            return {
              id: 'appointmentsPage',
              rows: [
                {
                  id: 'appointment-3',
                },
              ],
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const formData = {
    thirdPartyAppointmentId: 'appointment-3',
    subject: 'Updated demo',
    returnTab: 'past',
    returnSearch: 'demo',
    returnFilter: 'Completed',
  };

  await appointmentSave.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
    manifest,
  });

  assert.deepEqual(saveCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      formData,
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Appointment updated.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(listPageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'past',
      searchWithFilters: {
        search: 'demo',
        filter: 'Completed',
      },
      forceSync: false,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentsPage',
          rows: [
            {
              id: 'appointment-3',
            },
          ],
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customizedTabs/appointmentsPage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('appointment save reports validation failure without refreshing the list', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const notifications = [];
  const appointmentSave = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentSave.js',
    {
      stubs: {
        '../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../components/appointmentsPage/appointmentEditPage': {
          async saveAppointmentEdits() {
            return {
              successful: false,
              returnMessage: {
                messageType: 'warning',
                message: 'Subject is required.',
                ttl: 4000,
                details: {
                  field: 'subject',
                },
              },
            };
          },
        },
        '../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords() {
            throw new Error('failed save should not refresh appointments list');
          },
        },
      },
    }
  );

  await appointmentSave.onEvent({
    data: {
      body: {
        button: {
          formData: {
            thirdPartyAppointmentId: 'appointment-4',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Subject is required.',
      ttl: 4000,
      details: {
        field: 'subject',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, []);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('appointment open contact uses explicit contactUrl when provided by the list row', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  installWindowAndAdapter(windowMessages, []);

  const appointmentOpenContact = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.js',
    {
      stubs: {
        '../../../core/contact': {
          async openContactPage() {
            throw new Error('contactUrl should bypass adapter contact open');
          },
        },
        axios: {},
        '../../../service/appointmentService': {
          async listAppointments() {
            throw new Error('contactUrl should not fetch appointments');
          },
        },
      },
    }
  );

  await appointmentOpenContact.onEvent({
    data: {
      body: {
        button: {
          additionalInfo: {
            contactUrl: 'https://crm.example.com/contact/123',
            contactId: 'contact-123',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
  });

  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-on',
      },
      targetOrigin: '*',
    },
    {
      openedUrl: 'https://crm.example.com/contact/123',
      target: undefined,
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      targetOrigin: '*',
    },
  ]);
});

test('appointment open contact resolves temp hostname and opens all attendee contact URLs', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    'platform-info': {
      hostname: 'temp',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  installWindowAndAdapter(windowMessages, []);

  const hostnameCalls = [];
  const appointmentOpenContact = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenContact.js',
    {
      stubs: {
        '../../../core/contact': {
          async openContactPage() {
            throw new Error('contactPageUrl template should open attendee URLs directly');
          },
        },
        axios: {
          async get(url) {
            hostnameCalls.push(url);
            return {
              data: 'acme.crm.example.com',
            };
          },
        },
        '../../../service/appointmentService': {
          async listAppointments() {
            throw new Error('attendees from button should not fetch appointment list');
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        contactPageUrl: 'https://{hostname}/{contactType}/{contactId}',
      },
    },
  };

  await appointmentOpenContact.onEvent({
    data: {
      body: {
        button: {
          additionalInfo: {
            attendees: [
              {
                id: 'contact-1',
                type: 'Lead',
              },
              {
                id: 'contact-2',
                type: 'Contact',
              },
            ],
          },
        },
      },
    },
    manifest,
    platformName: 'acme',
  });

  assert.deepEqual(hostnameCalls, [
    'https://server.example.com/hostname?jwtToken=crm-jwt',
  ]);
  assert.equal(storage.store['platform-info'].hostname, 'acme.crm.example.com');
  assert.deepEqual(windowMessages, [
    {
      message: {
        type: 'rc-log-modal-loading-on',
      },
      targetOrigin: '*',
    },
    {
      openedUrl: 'https://acme.crm.example.com/Lead/contact-1',
      target: undefined,
    },
    {
      openedUrl: 'https://acme.crm.example.com/Contact/contact-2',
      target: undefined,
    },
    {
      message: {
        type: 'rc-log-modal-loading-off',
      },
      targetOrigin: '*',
    },
  ]);
});

test('appointment open appointment resolves hostname and third-party appointment id into configured URL', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
    'platform-info': {
      hostname: 'temp',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  installWindowAndAdapter(windowMessages, []);

  const hostnameCalls = [];
  const notifications = [];
  const appointmentOpenAppointment = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenAppointment.js',
    {
      stubs: {
        '../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        axios: {
          async get(url) {
            hostnameCalls.push(url);
            return {
              data: 'acme.crm.example.com',
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      acme: {
        page: {
          appointment: {
            canOpenAppointmentPage: true,
            appointmentPageUrl: 'https://{hostname}/appointments/{thirdPartyAppointmentId}',
          },
        },
      },
    },
  };

  await appointmentOpenAppointment.onEvent({
    data: {
      body: {
        button: {
          additionalInfo: {
            thirdPartyAppointmentId: 'meeting 42',
          },
        },
      },
    },
    manifest,
    platformName: 'acme',
  });

  assert.deepEqual(hostnameCalls, [
    'https://server.example.com/hostname?jwtToken=crm-jwt',
  ]);
  assert.deepEqual(windowMessages, [
    {
      openedUrl: 'https://acme.crm.example.com/appointments/meeting%2042',
      target: '_blank',
    },
  ]);
  assert.deepEqual(notifications, []);
});

test('appointment open appointment warns when neither manifest template nor row URL is available', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const windowMessages = [];
  installWindowAndAdapter(windowMessages, []);

  const notifications = [];
  const appointmentOpenAppointment = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentOpenAppointment.js',
    {
      stubs: {
        '../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        axios: {
          async get() {
            throw new Error('missing appointment link should not fetch hostname');
          },
        },
      },
    }
  );

  await appointmentOpenAppointment.onEvent({
    data: {
      body: {
        button: {
          additionalInfo: {},
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
      platforms: {
        acme: {
          page: {
            appointment: {
              canOpenAppointmentPage: false,
            },
          },
        },
      },
    },
    platformName: 'acme',
  });

  assert.deepEqual(windowMessages, []);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'No appointment link available.',
      ttl: 3000,
    },
  ]);
});
