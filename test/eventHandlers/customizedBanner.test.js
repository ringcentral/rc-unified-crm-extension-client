const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

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

test('customized banner dismiss stores the current dismissal day without navigating', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const customizedBanner = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.js',
    {
      stubs: {
        '../../../../components/logRecordSubmissionPage': {
          getLogRecordSubmissionPageRender() {
            throw new Error('dismissed webinar banner should not open the log submission page');
          },
        },
        '../../../../lib/logRecorder': {},
      },
    }
  );

  await customizedBanner.onEvent({
    data: {
      body: {
        button: {
          id: 'temp-webinar-banner',
          dismissed: true,
        },
      },
    },
  });

  assert.equal(storage.store.myBannerDismissedDate, new Date().getDate());
  assert.deepEqual(widgetMessages, []);
});

test('customized banner click hides the recording banner and opens log submission page', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];
  const customizedBanner = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/navigation/customizedBanner.js',
    {
      stubs: {
        '../../../../components/logRecordSubmissionPage': {
          getLogRecordSubmissionPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'logRecordSubmissionPage',
              title: 'Submit diagnostic logs',
            };
          },
        },
        '../../../../lib/logRecorder': {},
      },
    }
  );

  await customizedBanner.onEvent({
    data: {
      body: {
        button: {
          id: 'log-recording-banner',
          dismissed: false,
        },
      },
    },
  });

  assert.deepEqual(renderCalls, [{}]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-customized-banner',
        banner: {
          id: 'log-recording-banner',
          hidden: true,
        },
      },
      targetOrigin: '*',
    },
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'logRecordSubmissionPage',
          title: 'Submit diagnostic logs',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/logRecordSubmissionPage',
      },
      targetOrigin: '*',
    },
  ]);
});
