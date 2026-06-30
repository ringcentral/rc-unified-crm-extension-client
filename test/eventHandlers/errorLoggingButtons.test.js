const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWindowAndAdapter(windowMessages, widgetMessages) {
  global.window = {
    postMessage(message, targetOrigin) {
      windowMessages.push({ message, targetOrigin });
    },
  };
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

test('report issue button opens the error log record page with RingCentral user email', async () => {
  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pageCalls = [];

  const reportIssueButton = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/reportIssueButton.js',
    {
      stubs: {
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  extensionInfo: {
                    contact: {
                      email: 'ada@example.com',
                    },
                  },
                },
              },
            };
          },
        },
        '../../../../components/errorLogRecordPage': {
          getErrorLogRecordPageRender(args) {
            pageCalls.push(args);
            return {
              id: 'errorLogRecordPage',
              email: args.email,
            };
          },
        },
      },
    }
  );

  await reportIssueButton.onEvent({
    data: {
      body: {
        button: {},
      },
    },
  });

  assert.deepEqual(pageCalls, [
    {
      email: 'ada@example.com',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'errorLogRecordPage',
          email: 'ada@example.com',
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
  assert.deepEqual(windowMessages, []);
});

test('error log next step stores the user description and opens the confirmation step', async () => {
  const storage = createChromeStorage({});
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pageCalls = [];

  const errorLogRecordPageNextStep = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageNextStep.js',
    {
      stubs: {
        '../../../../components/errorLogRecordPage': {
          getErrorLogRecordPageRender(args) {
            pageCalls.push(args);
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

  await errorLogRecordPageNextStep.onEvent({
    data: {
      body: {
        button: {
          formData: {
            email: 'ada@example.com',
            issueDescription: 'Call log upload failed.',
          },
        },
      },
    },
  });

  assert.equal(storage.store.issueDescription, 'Call log upload failed.');
  assert.deepEqual(pageCalls, [
    {
      step: 2,
      email: 'ada@example.com',
      issueDescription: 'Call log upload failed.',
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'errorLogRecordPage',
          step: 2,
          email: 'ada@example.com',
          issueDescription: 'Call log upload failed.',
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
  assert.deepEqual(windowMessages, []);
});

test('error log record start opens recording step and saves basic RingCentral context', async () => {
  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const pageCalls = [];
  const recorderCalls = [];

  const errorLogRecordPageStart = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/errorLogRecordPageStart.js',
    {
      stubs: {
        '../../../../lib/util': {
          async getRcInfo() {
            return {
              value: {
                cachedData: {
                  accountInfo: {
                    id: 'rc-account-1',
                  },
                  extensionInfo: {
                    id: 'rc-extension-1',
                  },
                },
              },
            };
          },
        },
        '../../../../lib/logRecorder': {
          async startRecordingLogs() {
            recorderCalls.push({
              type: 'startRecordingLogs',
            });
          },
          logBasicInfo(info) {
            recorderCalls.push({
              type: 'logBasicInfo',
              info,
            });
          },
        },
        '../../../../components/errorLogRecordPage': {
          getErrorLogRecordPageRender(args) {
            pageCalls.push(args);
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

  const platformInfo = {
    platformName: 'salesforce',
  };

  await errorLogRecordPageStart.onEvent({
    data: {
      body: {
        button: {
          formData: {
            email: 'ada@example.com',
            issueDescription: 'Logs are missing.',
          },
        },
      },
    },
    manifest: {
      version: '1.7.35',
    },
    platformInfo,
  });

  assert.deepEqual(pageCalls, [
    {
      step: 3,
      email: 'ada@example.com',
      issueDescription: 'Logs are missing.',
    },
  ]);
  assert.deepEqual(recorderCalls, [
    {
      type: 'startRecordingLogs',
    },
    {
      type: 'logBasicInfo',
      info: {
        platformInfo,
        rcUserInfo: {
          accountInfo: {
            id: 'rc-account-1',
          },
          extensionInfo: {
            id: 'rc-extension-1',
          },
        },
        version: '1.7.35',
      },
    },
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-register-customized-page',
        page: {
          id: 'errorLogRecordPage',
          step: 3,
          email: 'ada@example.com',
          issueDescription: 'Logs are missing.',
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
  assert.deepEqual(windowMessages, []);
});

test('log record submit uploads recorded logs, notifies success, and returns to previous page', async () => {
  const storage = createChromeStorage({
    issueDescription: 'Upload failed after save.',
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const recorderCalls = [];
  const notifications = [];

  const logRecordSubmit = await loadBundledModule(
    'src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.js',
    {
      stubs: {
        '../../../../lib/logRecorder': {
          logAction(action) {
            recorderCalls.push({
              type: 'logAction',
              action,
            });
          },
          async stopRecordingLogs() {
            recorderCalls.push({
              type: 'stopRecordingLogs',
            });
          },
          async uploadLogs(args) {
            recorderCalls.push({
              type: 'uploadLogs',
              args,
            });
          },
        },
        '../../../../lib/util': {
          showNotification(notification) {
            notifications.push(notification);
          },
        },
      },
    }
  );

  await logRecordSubmit.onEvent({
    data: {
      body: {
        button: {},
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
  });

  assert.deepEqual(recorderCalls, [
    {
      type: 'logAction',
      action: {
        name: 'user description',
        data: 'Upload failed after save.',
      },
    },
    {
      type: 'stopRecordingLogs',
    },
    {
      type: 'uploadLogs',
      args: {
        serverUrl: 'https://server.example.com',
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Successfully uploaded.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      },
      targetOrigin: '*',
    },
  ]);
});

test('log record submit reports upload failure and still exits loading state', async () => {
  const storage = createChromeStorage({
    issueDescription: 'Upload failed after save.',
  });
  global.chrome = storage.chrome;

  const widgetMessages = [];
  const windowMessages = [];
  installWindowAndAdapter(windowMessages, widgetMessages);

  const notifications = [];
  const errors = [];
  const previousConsoleError = console.error;
  console.error = (...args) => {
    errors.push(args);
  };

  try {
    const logRecordSubmit = await loadBundledModule(
      'src/eventHandlers/rc-post-message-request/custom-button-click/errorLogging/logRecordSubmit.js',
      {
        stubs: {
          '../../../../lib/logRecorder': {
            logAction() {},
            async stopRecordingLogs() {},
            async uploadLogs() {
              throw new Error('network down');
            },
          },
          '../../../../lib/util': {
            showNotification(notification) {
              notifications.push(notification);
            },
          },
        },
      }
    );

    await logRecordSubmit.onEvent({
      data: {
        body: {
          button: {},
        },
      },
      manifest: {
        serverUrl: 'https://server.example.com',
      },
    });
  } finally {
    console.error = previousConsoleError;
  }

  assert.equal(errors.length, 1);
  assert.deepEqual(notifications, [
    {
      level: 'error',
      message: 'Failed to upload logs. Please try again.',
      ttl: 3000,
    },
  ]);
  assert.deepEqual(windowMessages.map(({ message }) => message.type), [
    'rc-log-modal-loading-on',
    'rc-log-modal-loading-off',
  ]);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      },
      targetOrigin: '*',
    },
  ]);
});
