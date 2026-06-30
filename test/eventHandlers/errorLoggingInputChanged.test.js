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

test('error log record input change rebuilds step one when issue fields change', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];
  const pageHandler = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getErrorLogRecordPage.js',
    {
      stubs: {
        '../../../../../components/errorLogRecordPage': {
          getErrorLogRecordPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'errorLogRecordPage',
              step: args.step,
              email: args.email,
              issueDescription: args.issueDescription,
            };
          },
        },
      },
    }
  );

  await pageHandler.onEvent({
    data: {
      body: {
        keys: ['issueDescription'],
        formData: {
          email: 'ada@example.com',
          issueDescription: 'The sync page fails after submit.',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      step: 1,
      email: 'ada@example.com',
      issueDescription: 'The sync page fails after submit.',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'errorLogRecordPage',
          step: 1,
          email: 'ada@example.com',
          issueDescription: 'The sync page fails after submit.',
        },
      },
      targetOrigin: undefined,
    },
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/errorLogRecordPage',
      },
      targetOrigin: '*',
    },
  ]);
});

test('error log record input change ignores unrelated field updates', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const pageHandler = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/getErrorLogRecordPage.js',
    {
      stubs: {
        '../../../../../components/errorLogRecordPage': {
          getErrorLogRecordPageRender() {
            throw new Error('unrelated field changes should not rebuild the error log page');
          },
        },
      },
    }
  );

  await pageHandler.onEvent({
    data: {
      body: {
        keys: ['email'],
        formData: {
          email: 'ada@example.com',
          issueDescription: 'unchanged',
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(widgetMessages, []);
});

test('log record submission input change rebuilds the page with current PII consent', async () => {
  const widgetMessages = [];
  installAdapter(widgetMessages);

  const renderCalls = [];
  const pageHandler = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/logRecordSubmissionPage.js',
    {
      stubs: {
        '../../../../../components/logRecordSubmissionPage': {
          getLogRecordSubmissionPageRender(args) {
            renderCalls.push(args);
            return {
              id: 'logRecordSubmissionPage',
              piiConsent: args.piiConsent,
            };
          },
        },
      },
    }
  );

  await pageHandler.onEvent({
    data: {
      body: {
        formData: {
          piiConsent: true,
        },
      },
    },
    manifest: {},
    platformInfo: {},
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(renderCalls, [
    {
      piiConsent: true,
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'logRecordSubmissionPage',
          piiConsent: true,
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