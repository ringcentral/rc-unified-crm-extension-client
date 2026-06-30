const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

async function loadRcAPI(axiosStub) {
  return loadBundledModule('src/lib/rcAPI.js', {
    stubs: {
      axios: axiosStub,
    },
  });
}

test('rcAPI generates interop code with RingCentral bearer token and client id', async () => {
  const postCalls = [];
  const { RcAPI } = await loadRcAPI({
    async post(url, body, config) {
      postCalls.push({ url, body, config });
      return {
        data: {
          code: 'interop-code',
        },
      };
    },
  });

  const rcAPI = new RcAPI();
  const code = await rcAPI.getInteropCode({
    rcAccessToken: 'rc-access-token',
    rcClientId: 'rc-client-id',
  });

  assert.equal(code, 'interop-code');
  assert.deepEqual(postCalls, [
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/interop/generate-code',
      body: {
        clientId: 'rc-client-id',
      },
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
  ]);
});

test('rcAPI paginates RingCentral call logs with calculated date range and bearer token', async (t) => {
  const originalDateNow = Date.now;
  Date.now = () => Date.parse('2026-06-29T12:00:00.000Z');
  t.after(() => {
    Date.now = originalDateNow;
  });

  const getCalls = [];
  const { RcAPI } = await loadRcAPI({
    async get(url, config) {
      getCalls.push({ url, config });
      if (getCalls.length === 1) {
        return {
          data: {
            records: [
              {
                id: 'call-1',
              },
            ],
            navigation: {
              nextPage: 'page-2',
            },
          },
        };
      }
      return {
        data: {
          records: [
            {
              id: 'call-2',
            },
          ],
          navigation: {},
        },
      };
    },
  });

  const rcAPI = new RcAPI();
  const result = await rcAPI.getRcCallLog({
    rcAccessToken: 'rc-access-token',
    dateRange: 'Last 7 days',
  });

  assert.deepEqual(result, {
    records: [
      {
        id: 'call-1',
      },
      {
        id: 'call-2',
      },
    ],
  });
  assert.deepEqual(getCalls, [
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log?dateFrom=2026-06-22T12:00:00.000Z&dateTo=2026-06-29T12:00:00.000Z&page=1&view=Simple&perPage=1000',
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log?dateFrom=2026-06-22T12:00:00.000Z&dateTo=2026-06-29T12:00:00.000Z&page=2&view=Simple&perPage=1000',
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
  ]);
});

test('rcAPI paginates RingCentral SMS logs with selected custom date range', async () => {
  const getCalls = [];
  const { RcAPI } = await loadRcAPI({
    async get(url, config) {
      getCalls.push({ url, config });
      if (getCalls.length === 1) {
        return {
          data: {
            records: [
              {
                id: 'sms-1',
              },
            ],
            navigation: {
              nextPage: 'page-2',
            },
          },
        };
      }
      return {
        data: {
          records: [
            {
              id: 'sms-2',
            },
          ],
          navigation: {},
        },
      };
    },
  });

  const rcAPI = new RcAPI();
  const result = await rcAPI.getRcSMSLog({
    rcAccessToken: 'rc-access-token',
    dateRange: 'Select date range...',
    customStartDate: '2026-06-01T00:00:00.000Z',
    customEndDate: '2026-06-29T23:59:59.000Z',
  });

  assert.deepEqual(result, {
    records: [
      {
        id: 'sms-1',
      },
      {
        id: 'sms-2',
      },
    ],
  });
  assert.deepEqual(getCalls, [
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/message-store?dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-29T23:59:59.000Z&page=1&perPage=100',
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/message-store?dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-29T23:59:59.000Z&page=2&perPage=100',
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
  ]);
});

test('rcAPI filters RingCentral extension list to users, maps display fields, and caches per instance', async () => {
  const getCalls = [];
  const { RcAPI } = await loadRcAPI({
    async get(url, config) {
      getCalls.push({ url, config });
      if (getCalls.length === 1) {
        return {
          data: {
            records: [
              {
                id: 'extension-1',
                type: 'User',
                name: 'Named User',
                extensionNumber: '101',
                contact: {
                  email: 'named@example.com',
                },
              },
              {
                id: 'department-1',
                type: 'Department',
                name: 'Support Queue',
                extensionNumber: '800',
                contact: {
                  email: 'support@example.com',
                },
              },
            ],
            navigation: {
              nextPageUrl: 'page-2',
            },
          },
        };
      }
      return {
        data: {
          records: [
            {
              id: 'extension-2',
              type: 'User',
              contact: {
                firstName: 'Grace',
                lastName: 'Hopper',
                email: 'grace@example.com',
              },
            },
          ],
          navigation: {},
        },
      };
    },
  });

  const rcAPI = new RcAPI();
  const firstResult = await rcAPI.getRcExtensionList({
    rcAccessToken: 'rc-access-token',
  });
  const secondResult = await rcAPI.getRcExtensionList({
    rcAccessToken: 'different-token',
  });

  assert.deepEqual(firstResult, [
    {
      id: 'extension-1',
      name: 'Named User',
      extensionNumber: '101',
      email: 'named@example.com',
    },
    {
      id: 'extension-2',
      name: 'Grace Hopper',
      extensionNumber: '',
      email: 'grace@example.com',
    },
  ]);
  assert.deepEqual(secondResult, firstResult);
  assert.deepEqual(getCalls, [
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension?page=1&perPage=100',
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
    {
      url: 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension?page=2&perPage=100',
      config: {
        headers: {
          Authorization: 'Bearer rc-access-token',
        },
      },
    },
  ]);
});