const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

function createMixpanel({ initThrows = false } = {}) {
  const calls = [];
  return {
    calls,
    init(...args) {
      calls.push({ name: 'init', args });
      if (initThrows) {
        throw new Error('mixpanel unavailable');
      }
    },
    reset() {
      calls.push({ name: 'reset', args: [] });
    },
    identify(...args) {
      calls.push({ name: 'identify', args });
    },
    people: {
      set(...args) {
        calls.push({ name: 'people.set', args });
      },
    },
    add_group(...args) {
      calls.push({ name: 'add_group', args });
    },
    set_group(...args) {
      calls.push({ name: 'set_group', args });
    },
    track(...args) {
      calls.push({ name: 'track', args });
    },
    track_pageview(...args) {
      calls.push({ name: 'track_pageview', args });
    },
  };
}

async function loadAnalytics(mixpanel) {
  return loadBundledModule('src/lib/analytics.js', {
    stubs: {
      'mixpanel-browser': mixpanel,
    },
  });
}

async function withMixpanelToken(token, callback) {
  const previous = process.env.MIXPANEL_TOKEN;
  if (token === undefined) {
    delete process.env.MIXPANEL_TOKEN;
  } else {
    process.env.MIXPANEL_TOKEN = token;
  }

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.MIXPANEL_TOKEN;
    } else {
      process.env.MIXPANEL_TOKEN = previous;
    }
  }
}

test('analytics is a no-op when MIXPANEL_TOKEN is not configured', async () => {
  await withMixpanelToken(undefined, async () => {
    const mixpanel = createMixpanel();
    const analytics = await loadAnalytics(mixpanel);

    analytics.setAuthor('Acme');
    analytics.reset();
    analytics.identify({ platformName: 'salesforce', rcAccountId: 'acct-1', extensionId: 'ext-1' });
    analytics.group({ rcAccountId: 'acct-1' });
    analytics.trackRcLogin();
    analytics.trackCallEnd({ durationInSeconds: 10, direction: 'Inbound', result: 'Accepted', callWith: 'Ada', callingMode: 'WebRTC' });

    assert.deepEqual(mixpanel.calls, []);
  });
});

test('analytics falls back to no-op when mixpanel init fails', async () => {
  await withMixpanelToken('test-token', async () => {
    const mixpanel = createMixpanel({ initThrows: true });
    const analytics = await loadAnalytics(mixpanel);

    analytics.identify({ platformName: 'hubspot', rcAccountId: 'acct-2', extensionId: 'ext-2' });
    analytics.trackCrmLogin();

    assert.deepEqual(mixpanel.calls, [
      {
        name: 'init',
        args: ['test-token', { persistence: 'localStorage' }],
      },
    ]);
  });
});

test('analytics identify persists CRM platform for subsequent CRM events', async () => {
  await withMixpanelToken('test-token', async () => {
    const mixpanel = createMixpanel();
    const analytics = await loadAnalytics(mixpanel);

    analytics.setAuthor('Acme Dev');
    analytics.identify({ platformName: 'salesforce', rcAccountId: 'acct-1', extensionId: 'ext-1' });
    analytics.group({ rcAccountId: 'acct-1' });
    analytics.trackCrmLogin();

    assert.deepEqual(mixpanel.calls[0], {
      name: 'init',
      args: ['test-token', { persistence: 'localStorage' }],
    });
    assert.deepEqual(mixpanel.calls.find((call) => call.name === 'identify'), {
      name: 'identify',
      args: ['ext-1'],
    });
    assert.deepEqual(mixpanel.calls.find((call) => call.name === 'people.set'), {
      name: 'people.set',
      args: [{
        crmPlatform: 'salesforce',
        rcAccountId: 'acct-1',
        version: '1.7.35',
        author: 'Acme Dev',
      }],
    });

    const crmLoginTrack = mixpanel.calls.find((call) => call.name === 'track' && call.args[0] === 'Login with CRM account');
    assert.equal(crmLoginTrack.args[1].crmPlatform, 'salesforce');
    assert.equal(crmLoginTrack.args[1].author, 'Acme Dev');
    assert.equal(crmLoginTrack.args[1].via, 'client');
    assert.equal(crmLoginTrack.args[1].collectedFrom, 'client');
  });
});