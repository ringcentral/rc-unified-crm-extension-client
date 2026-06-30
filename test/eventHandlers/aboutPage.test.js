const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

function installAdapter(widgetMessages) {
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

test('about page button registers the platform about page and navigates to it', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const manifest = {
    version: '1.7.35',
    platforms: {
      acme: {
        displayName: 'Acme CRM',
      },
    },
  };
  const aboutPageCalls = [];

  const aboutPage = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/navigation/openAboutPage.js',
    {
      stubs: {
        '../../../../components/aboutPage': {
          getAboutPageRender(args) {
            aboutPageCalls.push(args);
            return {
              id: 'aboutPage',
              title: 'About Acme CRM',
            };
          },
        },
      },
    }
  );

  await aboutPage.onEvent({
    data: {},
    manifest,
    platformInfo: {},
    platformName: 'acme',
    platform: manifest.platforms.acme,
  });

  assert.deepEqual(aboutPageCalls, [
    {
      platformName: 'acme',
      manifest,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'aboutPage',
          title: 'About Acme CRM',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/aboutPage',
      },
      targetOrigin: '*',
    },
  ]);
});
