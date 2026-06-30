const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function setting(value, readOnly = false, readOnlyReason = '') {
  return {
    value,
    readOnly,
    readOnlyReason,
  };
}

function createUserCoreStub() {
  let proxy;
  proxy = new Proxy({}, {
    get(_target, prop) {
      if (prop === '__esModule') {
        return false;
      }
      if (prop === 'default') {
        return proxy;
      }
      if (prop === 'getPhoneNumberDisplayFormatTypeSetting') {
        return () => setting('e164');
      }
      if (prop === 'getPhoneNumberDisplayFormatTemplateSetting') {
        return () => setting('');
      }
      if (prop === 'getAutoLogSMSSetting') {
        return (userSettings) => setting(
          userSettings?.autoLogSMS?.value ?? false,
          userSettings?.autoLogSMS?.customizable === false,
          userSettings?.autoLogSMS?.customizable === false ? 'Managed by admin' : ''
        );
      }
      if (prop === 'getDeveloperModeSetting') {
        return (_userSettings, developerMode) => setting(!!developerMode);
      }
      if (prop === 'getClickToDialUrls' || prop === 'getQuickAccessButtonUrls') {
        return () => setting([]);
      }
      if (prop === 'getNewContactTypeSetting') {
        return () => setting('Lead');
      }
      if (prop === 'getNotificationLevelSetting') {
        return () => setting('All');
      }
      if (prop === 'getCallPopMultiMatchBehavior') {
        return () => setting('promptToSelect');
      }
      if (String(prop).startsWith('getShow')) {
        return () => setting(true);
      }
      return () => setting(false);
    },
  });
  return proxy;
}
test('embeddable service manifest exposes widget paths and managed SMS auto-log state', async () => {
  const storage = createChromeStorage({
    isAdmin: true,
    crmAuthed: true,
    crmUserInfo: {
      name: 'Ada Lovelace',
    },
    userSettings: {
      autoLogSMS: {
        value: true,
        customizable: false,
      },
    },
  });
  global.chrome = storage.chrome;

  const postedMessages = [];
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          postMessage(message, targetOrigin) {
            postedMessages.push({ message, targetOrigin });
          },
        },
      };
    },
  };

  const embeddableServices = await loadBundledModule('src/service/embeddableServices.js', {
    stubs: {
      '../core/user': createUserCoreStub(),
      '../core/auth': {},
      './platformService': {
        async getPlatformInfo() {
          return {
            platformName: 'acme',
          };
        },
      },
      './manifestService': {
        async getManifest() {
          return {
            version: '1.2.3',
            author: {
              name: 'App Connect',
            },
            platforms: {
              acme: {
                name: 'acme',
                displayName: 'Acme CRM',
                logoUrl: 'https://cdn.example.com/logo.png',
                contactTypes: [
                  {
                    value: 'Lead',
                    display: 'Lead',
                  },
                ],
                page: {
                  appointment: {
                    supported: true,
                    title: 'Appointments',
                  },
                },
              },
            },
          };
        },
      },
      '../i18n': {
        t(key) {
          return key;
        },
      },
    },
  });

  const serviceManifest = await embeddableServices.getServiceManifest();

  assert.equal(serviceManifest.name, 'acme');
  assert.equal(serviceManifest.displayName, 'Acme CRM');
  assert.equal(serviceManifest.authorized, true);
  assert.equal(serviceManifest.authorizationPath, '/authorize');
  assert.equal(serviceManifest.contactMatchPath, '/contacts/match');
  assert.equal(serviceManifest.viewMatchedContactPath, '/contacts/view');
  assert.equal(serviceManifest.callLoggerPath, '/callLogger');
  assert.equal(serviceManifest.messageLoggerPath, '/messageLogger');
  assert.equal(serviceManifest.messageLoggerAutoSettingReadOnly, true);
  assert.equal(serviceManifest.messageLoggerAutoSettingReadOnlyReason, 'Managed by admin');
  assert.equal(serviceManifest.messageLoggerAutoSettingReadOnlyValue, true);
  assert.deepEqual(serviceManifest.buttons.map((button) => button.id), [
    'callLater',
    'callLaterInMessage',
    'callLaterInContact',
  ]);

  const loggingGroup = serviceManifest.settings.find((group) => group.id === 'logging');
  const autoLogSmsSetting = loggingGroup.items.find((item) => item.id === 'autoLogSMS');
  assert.equal(autoLogSmsSetting.value, true);
  assert.equal(autoLogSmsSetting.readOnly, true);

  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-set-phone-number-format',
        formatType: 'e164',
        template: '',
        readOnly: false,
        readOnlyReason: '',
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-update-sms-typing-time-tracking',
        enabled: false,
      },
      targetOrigin: '*',
    },
  ]);
});



