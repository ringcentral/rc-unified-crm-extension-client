const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

test('appointmentService lists appointments with query params and normalizes backend records', async () => {
  const getCalls = [];

  const appointmentService = await loadBundledModule('src/service/appointmentService.js', {
    stubs: {
      axios: {
        async get(url, options) {
          getCalls.push({ url, options });
          return {
            data: {
              records: [
                {
                  id: 'appointment-1',
                  subject: 'Discovery call',
                },
              ],
            },
          };
        },
      },
    },
  });

  const appointments = await appointmentService.listAppointments({
    serverUrl: 'https://server.example.com',
    jwtToken: 'crm-jwt',
    range: 'past',
    mineOnly: false,
    forceSync: true,
  });

  assert.deepEqual(getCalls, [
    {
      url: 'https://server.example.com/appointments',
      options: {
        params: {
          jwtToken: 'crm-jwt',
          range: 'past',
          mineOnly: 'false',
          forceSync: 'true',
        },
      },
    },
  ]);
  assert.deepEqual(appointments, [
    {
      id: 'appointment-1',
      subject: 'Discovery call',
    },
  ]);
});

test('appointmentService falls back to generic status endpoint when canonical status route fails', async () => {
  const postCalls = [];

  const appointmentService = await loadBundledModule('src/service/appointmentService.js', {
    stubs: {
      axios: {
        async post(url, body, options) {
          postCalls.push({ url, body, options });
          if (url.endsWith('/confirm')) {
            throw new Error('confirm route unavailable');
          }
          return {
            data: {
              id: 'appointment-1',
              status: 'confirmed',
            },
          };
        },
      },
    },
  });

  const result = await appointmentService.updateAppointmentStatus({
    serverUrl: 'https://server.example.com',
    jwtToken: 'crm-jwt',
    appointmentId: 'appointment-1',
    status: 'confirmed',
  });

  assert.deepEqual(postCalls, [
    {
      url: 'https://server.example.com/appointments/appointment-1/confirm',
      body: null,
      options: {
        params: {
          jwtToken: 'crm-jwt',
        },
      },
    },
    {
      url: 'https://server.example.com/appointments/appointment-1/status',
      body: {
        status: 'confirmed',
      },
      options: {
        params: {
          jwtToken: 'crm-jwt',
        },
      },
    },
  ]);
  assert.deepEqual(result, {
    id: 'appointment-1',
    status: 'confirmed',
  });
});
