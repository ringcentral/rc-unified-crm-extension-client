const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

const contactModuleStubs = {
  axios: {},
  '../lib/analytics': {
    contactPop() {},
  },
  '../lib/util': {
    showNotification() {},
  },
  '../components/multiContactPopPromptPage': {},
  '../i18n': {
    t: (key) => key,
  },
  '../service/manifestService': {
    async getManifest() {
      return {
        platforms: {
          acme: {
            page: {},
          },
        },
      };
    },
  },
};

function installAdapterFrame(contactMatcherData = {}) {
  global.document = {
    querySelector() {
      return {
        contentWindow: {
          phone: {
            contactMatcher: {
              data: contactMatcherData,
            },
          },
          postMessage() {},
        },
      };
    },
  };
}

test('contact page fallback refuses unsafe URLs from manifest configuration', async () => {
  const storage = createChromeStorage({
    'platform-info': {
      platformName: 'acme',
      hostname: 'tenant.example.com',
    },
  });
  global.chrome = storage.chrome;
  installAdapterFrame();

  const openedUrls = [];
  global.window = {
    open(url) {
      openedUrls.push(url);
    },
  };

  const contact = await loadBundledModule('src/core/contact.js', {
    stubs: contactModuleStubs,
  });

  await contact.openContactPage({
    manifest: {
      serverUrl: 'https://server.example.com',
      platforms: {
        acme: {
          enableFallbackContactPageUrl: true,
          fallbackContactPageUrl: 'javascript:alert(1)//{hostname}',
          contactPageUrl: 'https://{hostname}/contacts/{contactId}',
        },
      },
    },
    platformName: 'acme',
    phoneNumber: '+15550123',
    fromCallPop: true,
  });

  assert.deepEqual(openedUrls, []);
});

