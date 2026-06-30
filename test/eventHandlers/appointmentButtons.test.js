const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
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

test('appointment confirm updates appointment status, refreshes the current list, and responds to widget', async () => {
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

  const appointmentConfirm = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentConfirm.js',
    {
      stubs: {
        '../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords(args) {
            listPageCalls.push(args);
            return {
              id: 'appointmentsPage',
              rows: [
                {
                  id: 'appointment-1',
                },
              ],
            };
          },
        },
        '../../../service/appointmentService': {
          async updateAppointmentStatus(args) {
            updateStatusCalls.push(args);
            return {
              successful: true,
            };
          },
        },
        '../../../lib/appointmentUtils': {
          extractAppointmentsListContext(data) {
            assert.equal(data.requestId, 'req-confirm-appointment');
            return {
              tab: 'pending',
              searchWithFilters: {
                search: 'Ada',
                filter: 'Today',
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

  await appointmentConfirm.onEvent({
    data: {
      requestId: 'req-confirm-appointment',
      body: {
        button: {},
      },
    },
    manifest,
    listButtonItemId: 'appointment-1',
  });

  assert.deepEqual(updateStatusCalls, [
    {
      serverUrl: 'https://server.example.com',
      jwtToken: 'crm-jwt',
      appointmentId: 'appointment-1',
      status: 'confirmed',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Appointment confirmed successfully.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(listPageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'pending',
      searchWithFilters: {
        search: 'Ada',
        filter: 'Today',
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
              id: 'appointment-1',
            },
          ],
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(responses, [
    {
      requestId: 'req-confirm-appointment',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('appointment create save creates appointment, refreshes return list, and navigates to customized tab', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const submitCreateCalls = [];
  const listPageCalls = [];
  const notifications = [];

  const appointmentCreateSave = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreateSave.js',
    {
      stubs: {
        '../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../components/appointmentsPage/appointmentCreatePage': {
          async submitAppointmentCreate(args) {
            submitCreateCalls.push(args);
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
                  id: 'appointment-new',
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
    subject: 'Demo',
    startsAt: '2026-07-01T10:00:00.000Z',
    returnTab: 'upcoming',
    returnSearch: 'Demo',
    returnFilter: 'Mine',
  };

  await appointmentCreateSave.onEvent({
    data: {
      body: {
        button: {
          formData,
        },
      },
    },
    manifest,
  });

  assert.deepEqual(submitCreateCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      formData,
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Appointment created.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(listPageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'upcoming',
      searchWithFilters: {
        search: 'Demo',
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
          rows: [
            {
              id: 'appointment-new',
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
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});

test('appointment create save reports server validation failure without refreshing the list', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const notifications = [];

  const appointmentCreateSave = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/appointmentCreateSave.js',
    {
      stubs: {
        '../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
        '../../../components/appointmentsPage/appointmentCreatePage': {
          async submitAppointmentCreate() {
            return {
              successful: false,
              returnMessage: {
                messageType: 'warning',
                message: 'Start time is required.',
                ttl: 4000,
                details: {
                  field: 'startsAt',
                },
              },
            };
          },
        },
        '../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords() {
            throw new Error('appointments list should not refresh after failed create');
          },
        },
      },
    }
  );

  await appointmentCreateSave.onEvent({
    data: {
      body: {
        button: {
          formData: {
            subject: 'Incomplete appointment',
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
      message: 'Start time is required.',
      ttl: 4000,
      details: {
        field: 'startsAt',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, []);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
});
