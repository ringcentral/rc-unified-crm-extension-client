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

function createImmediateDebounce() {
  return function debounceNow(_requestId, handler) {
    return handler();
  };
}

test('appointment input change recalculates duration and snaps an invalid end time to the start time', async () => {
  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const createPageCalls = [];

  const appointmentPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.js',
    {
      stubs: {
        '../../../../lib/util': {
          createDebounceHandler() {
            return createImmediateDebounce();
          },
        },
        '../../../../components/appointmentsPage/appointmentCreatePage': {
          getAppointmentCreatePageRender(args) {
            createPageCalls.push(args);
            return {
              id: 'appointmentCreatePage',
              formData: args.initialFormData,
            };
          },
        },
        '../../../../components/appointmentsPage/appointmentEditPage': {
          getAppointmentEditPageRender() {
            throw new Error('edit page should not render for appointmentCreatePage');
          },
        },
        axios: {},
      },
    }
  );

  const manifest = {
    platforms: {
      salesforce: {
        page: {
          appointment: {
            title: 'Meetings',
            status: {
              confirmed: 'Confirmed',
            },
            titleField: {
              title: 'Subject',
            },
          },
        },
      },
    },
  };

  await appointmentPage.onEvent({
    data: {
      body: {
        keys: ['dateTime'],
        page: {
          id: 'appointmentCreatePage',
        },
        formData: {
          dateTime: '2026-07-01T10:00',
          endDateTime: '2026-07-01T09:30',
        },
      },
    },
    manifest,
    platformName: 'salesforce',
  });

  assert.deepEqual(createPageCalls, [
    {
      initialFormData: {
        dateTime: '2026-07-01T10:00',
        endDateTime: '2026-07-01T10:00',
        duration: 'PT0M',
      },
      appointmentTitle: 'Meetings',
      statusConfig: {
        confirmed: 'Confirmed',
      },
      titleFieldConfig: {
        title: 'Subject',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentCreatePage',
          formData: {
            dateTime: '2026-07-01T10:00',
            endDateTime: '2026-07-01T10:00',
            duration: 'PT0M',
          },
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});

test('appointment participant autocomplete searches free text, merges candidates, and clears the query from selected ids', async () => {
  const storage = createChromeStorage({
    rcUnifiedCrmExtJwt: 'crm-jwt',
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const axiosGets = [];
  const editPageCalls = [];

  const appointmentPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentPage.js',
    {
      stubs: {
        '../../../../lib/util': {
          createDebounceHandler() {
            return createImmediateDebounce();
          },
        },
        '../../../../components/appointmentsPage/appointmentCreatePage': {
          getAppointmentCreatePageRender() {
            throw new Error('create page should not render for appointmentEditPage');
          },
        },
        '../../../../components/appointmentsPage/appointmentEditPage': {
          getAppointmentEditPageRender(args) {
            editPageCalls.push(args);
            return {
              id: 'appointmentEditPage',
              formData: args.initialFormData,
            };
          },
        },
        axios: {
          async get(url, options) {
            axiosGets.push({ url, options });
            return {
              data: {
                contact: [
                  {
                    id: 'crm-contact-2',
                    type: 'Contact',
                    name: 'Grace Hopper',
                    email: 'grace@example.com',
                  },
                  {
                    id: 'crm-contact-2',
                    type: 'Contact',
                    name: 'Grace Hopper Duplicate',
                  },
                ],
              },
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
    platforms: {
      hubspot: {
        page: {
          appointment: {
            title: 'Appointments',
            emailMandatoryInAttendee: true,
          },
        },
      },
    },
  };

  await appointmentPage.onEvent({
    data: {
      requestId: 'req-appointment-search',
      body: {
        keys: ['participantContactIds'],
        page: {
          id: 'appointmentEditPage',
        },
        formData: {
          participantContactIds: ['crm-contact-1', 'Grace'],
          participantCandidates: [
            {
              id: 'crm-contact-1',
              type: 'Lead',
              name: 'Ada Lovelace',
            },
          ],
          title: 'Demo',
        },
      },
    },
    manifest,
    platformName: 'hubspot',
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(axiosGets, [
    {
      url: 'https://server.example.com/custom/contact/search',
      options: {
        params: {
          jwtToken: 'crm-jwt',
          name: 'Grace',
        },
      },
    },
  ]);
  assert.equal(editPageCalls.length, 1);
  assert.equal(editPageCalls[0].appointmentTitle, 'Appointments');
  assert.deepEqual(editPageCalls[0].initialFormData, {
    participantContactIds: ['crm-contact-1'],
    participantCandidates: [
      {
        id: 'crm-contact-1',
        type: 'Lead',
        name: 'Ada Lovelace',
      },
      {
        id: 'crm-contact-2',
        type: 'Contact',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        emailChecked: true,
      },
    ],
    title: 'Demo',
    emailMandatoryInAttendee: true,
  });
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentEditPage',
          formData: {
            participantContactIds: ['crm-contact-1'],
            participantCandidates: [
              {
                id: 'crm-contact-1',
                type: 'Lead',
                name: 'Ada Lovelace',
              },
              {
                id: 'crm-contact-2',
                type: 'Contact',
                name: 'Grace Hopper',
                email: 'grace@example.com',
                emailChecked: true,
              },
            ],
            title: 'Demo',
            emailMandatoryInAttendee: true,
          },
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




test('appointments list filter change refreshes immediately with spinner and stores last state', async () => {
  const storage = createChromeStorage({
    userSettings: {
      showAppointmentsTab: {
        value: true,
      },
    },
    rcUnifiedCrmExtJwt: 'crm-jwt',
    appointmentsLastState: {
      tab: 'upcoming',
      search: '',
      filter: 'All',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pageCalls = [];
  const responses = [];

  const appointmentsPageInputChanged = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.js',
    {
      stubs: {
        '../../../../lib/util': {
          createDebounceHandler() {
            return createImmediateDebounce();
          },
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
        },
        '../../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'appointmentsPage',
              rows: ['appointment-1'],
            };
          },
        },
        '../../../../core/user': {
          getShowAppointmentsTabSetting(userSettings) {
            return {
              value: userSettings.showAppointmentsTab.value,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const searchWithFilters = {
    search: '',
    filter: 'Today',
  };

  await appointmentsPageInputChanged.onEvent({
    data: {
      requestId: 'req-filter',
      body: {
        keys: ['searchWithFilters'],
        formData: {
          tab: 'upcoming',
          searchWithFilters,
        },
      },
    },
    manifest,
  });

  assert.deepEqual(storage.store.appointmentsLastState, {
    tab: 'upcoming',
    search: '',
    filter: 'Today',
  });
  assert.deepEqual(pageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'upcoming',
      searchWithFilters,
      forceSync: false,
      userSettings: {
        showAppointmentsTab: {
          value: true,
        },
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentsPage',
          rows: ['appointment-1'],
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
  assert.deepEqual(responses, [
    {
      requestId: 'req-filter',
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

test('appointments list search typing responds immediately and refreshes through debounce without spinner', async () => {
  const storage = createChromeStorage({
    userSettings: {
      showAppointmentsTab: {
        value: true,
      },
    },
    rcUnifiedCrmExtJwt: 'crm-jwt',
    appointmentsLastState: {
      tab: 'upcoming',
      search: '',
      filter: 'All',
    },
  });
  global.chrome = storage.chrome;

  const windowMessages = [];
  const widgetMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pageCalls = [];
  const responses = [];

  const appointmentsPageInputChanged = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/appointmentsPage.js',
    {
      stubs: {
        '../../../../lib/util': {
          createDebounceHandler() {
            return createImmediateDebounce();
          },
          responseMessage(requestId, payload) {
            responses.push({ requestId, payload });
          },
        },
        '../../../../components/appointmentsPage/appointmentsPage': {
          async getAppointmentsPageWithRecords(args) {
            pageCalls.push(args);
            return {
              id: 'appointmentsPage',
              rows: ['appointment-search-result'],
            };
          },
        },
        '../../../../core/user': {
          getShowAppointmentsTabSetting(userSettings) {
            return {
              value: userSettings.showAppointmentsTab.value,
            };
          },
        },
      },
    }
  );

  const manifest = {
    serverUrl: 'https://server.example.com',
  };
  const searchWithFilters = {
    search: 'Ada',
    filter: 'All',
  };

  await appointmentsPageInputChanged.onEvent({
    data: {
      requestId: 'req-search',
      body: {
        keys: ['searchWithFilters'],
        formData: {
          tab: 'upcoming',
          searchWithFilters,
        },
      },
    },
    manifest,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(responses, [
    {
      requestId: 'req-search',
      payload: {
        data: 'ok',
      },
    },
  ]);
  assert.deepEqual(pageCalls, [
    {
      manifest,
      jwtToken: 'crm-jwt',
      tab: 'upcoming',
      searchWithFilters,
      forceSync: false,
      userSettings: {
        showAppointmentsTab: {
          value: true,
        },
      },
    },
  ]);
  assert.deepEqual(storage.store.appointmentsLastState, {
    tab: 'upcoming',
    search: 'Ada',
    filter: 'All',
  });
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'appointmentsPage',
          rows: ['appointment-search-result'],
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.deepEqual(windowMessages, []);
});
