const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

async function loadApiErrorHandler({
  clearLocalCrmAuthState,
  notifications = [],
  trackingCalls = [],
} = {}) {
  const mod = await loadBundledModule('src/lib/apiErrorHandler.js', {
    stubs: {
      '../core/auth': {
        async clearLocalCrmAuthState() {
          return clearLocalCrmAuthState();
        },
      },
      './util': {
        showNotification(notification) {
          notifications.push(notification);
        },
      },
      './analytics': {
        trackCrmAuthFail() {
          trackingCalls.push({});
        },
      },
    },
  });

  return mod.default ?? mod;
}

test('api error handler ignores errors that are not CRM authorization failures', async () => {
  const notifications = [];
  const trackingCalls = [];
  const apiErrorHandler = await loadApiErrorHandler({
    notifications,
    trackingCalls,
    async clearLocalCrmAuthState() {
      throw new Error('non CRM auth errors should not clear local CRM auth state');
    },
  });

  assert.equal(
    apiErrorHandler.isCrmAuthRequiredResponse({
      status: 500,
      data: 'Please authorize CRM platform',
    }),
    false,
  );
  assert.equal(
    apiErrorHandler.isCrmAuthRequiredError({
      response: {
        status: 400,
        data: {
          message: 'Validation failed',
        },
      },
    }),
    false,
  );
  assert.equal(
    await apiErrorHandler.handleApiError({
      response: {
        status: 500,
        data: {
          returnMessage: {
            message: 'Please authorize CRM platform',
          },
        },
      },
    }),
    false,
  );
  assert.deepEqual(notifications, []);
  assert.deepEqual(trackingCalls, []);
});

test('api error handler clears CRM auth state, tracks the failure, and notifies the user once CRM auth is required', async (t) => {
  const originalDateNow = Date.now;
  t.after(() => {
    Date.now = originalDateNow;
  });
  Date.now = () => 10000;

  const clearCalls = [];
  const notifications = [];
  const trackingCalls = [];
  const callbackCalls = [];

  const apiErrorHandler = await loadApiErrorHandler({
    notifications,
    trackingCalls,
    async clearLocalCrmAuthState() {
      clearCalls.push({});
      return true;
    },
  });

  apiErrorHandler.registerCrmAuthCacheClearedHandler(async () => {
    callbackCalls.push({});
  });

  const handled = await apiErrorHandler.handleApiError({
    response: {
      status: 400,
      data: {
        returnMessage: {
          message: 'Please go to Settings and authorize CRM platform',
        },
      },
    },
  });

  assert.equal(handled, true);
  assert.deepEqual(clearCalls, [{}]);
  assert.deepEqual(trackingCalls, [{}]);
  assert.deepEqual(callbackCalls, [{}]);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Please go to Settings and authorize CRM platform',
      ttl: 60000,
    },
  ]);
});

test('api error handler suppresses duplicate CRM auth cache clears within the throttle window', async (t) => {
  const originalDateNow = Date.now;
  t.after(() => {
    Date.now = originalDateNow;
  });

  let now = 10000;
  Date.now = () => now;

  const clearCalls = [];
  const notifications = [];
  const trackingCalls = [];

  const apiErrorHandler = await loadApiErrorHandler({
    notifications,
    trackingCalls,
    async clearLocalCrmAuthState() {
      clearCalls.push({});
      return true;
    },
  });

  const error = {
    response: {
      status: 400,
      data: 'Please authorize CRM platform before logging',
    },
  };

  assert.equal(await apiErrorHandler.handleApiError(error), true);
  now = 12000;
  assert.equal(await apiErrorHandler.handleApiError(error), false);

  assert.deepEqual(clearCalls, [{}]);
  assert.deepEqual(trackingCalls, [{}]);
  assert.deepEqual(notifications, [
    {
      level: 'warning',
      message: 'Please go to Settings and authorize CRM platform',
      ttl: 60000,
    },
  ]);
});
