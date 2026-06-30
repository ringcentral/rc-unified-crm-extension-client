const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

const userModuleStubs = {
  axios: {},
  moment: () => ({
    isAfter: () => false,
    isBefore: () => false,
  }),
  '../lib/util': {},
  '../service/manifestService': {},
  '../service/platformService': {},
  './admin': {},
  '../service/embeddableServices': {},
  '../components/reportPage/reportPage': {},
  '../components/calldownPage': {},
  '../lib/rcAPI': {
    RcAPI: class RcAPI {},
  },
};

test('user settings lock auto-log call when account server-side logging is enabled', async () => {
  const user = await loadBundledModule('src/core/user.js', {
    stubs: userModuleStubs,
  });

  const setting = user.getAutoLogCallSetting({
    autoLogCall: {
      value: true,
      customizable: true,
    },
    serverSideLogging: {
      enable: true,
      loggingLevel: 'Account',
    },
  });

  assert.equal(setting.value, false);
  assert.equal(setting.readOnly, true);
  assert.equal(setting.warning, 'Unavailable while server side call logging enabled');
});
