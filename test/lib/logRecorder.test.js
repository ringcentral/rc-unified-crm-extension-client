const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function installWidget(widgetMessages) {
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

async function loadLogRecorder({ axios, downloads = [] } = {}) {
  return loadBundledModule('src/lib/logRecorder.js', {
    stubs: {
      axios: axios ?? {
        defaults: {
          headers: {
            common: {},
          },
        },
      },
      './util': {
        downloadTextFile(args) {
          downloads.push(args);
        },
      },
    },
  });
}

test('logRecorder start and stop recording update storage, debug header, and widget banner', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;

  const widgetMessages = [];
  installWidget(widgetMessages);

  const axios = {
    defaults: {
      headers: {
        common: {},
      },
    },
  };
  const logRecorder = await loadLogRecorder({ axios });

  await logRecorder.startRecordingLogs();

  assert.equal(storage.store.errorLogRecordingStatus, 'recording');
  assert.equal(axios.defaults.headers.common['is-debug'], true);
  assert.deepEqual(widgetMessages, [
    {
      message: {
        type: 'rc-adapter-update-customized-banner',
        banner: {
          id: 'log-recording-banner',
          message: 'Recording actions...',
          severity: 'warning',
          action: {
            label: 'Stop',
            color: 'danger.b04',
          },
        },
      },
      targetOrigin: '*',
    },
  ]);
  assert.equal(await logRecorder.isRecordingLogs(), true);

  await logRecorder.stopRecordingLogs();

  assert.equal(storage.store.errorLogRecordingStatus, undefined);
  assert.equal(axios.defaults.headers.common['is-debug'], false);
  assert.equal(await logRecorder.isRecordingLogs(), false);
});

test('logRecorder summarizes user description, API calls, and widget actions', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;
  installWidget([]);

  const logRecorder = await loadLogRecorder();

  await logRecorder.startRecordingLogs();
  logRecorder.logBasicInfo({ platformName: 'acme', extensionVersion: '1.7.35' });
  logRecorder.logAction({
    name: 'API_REQUEST',
    data: {
      method: 'post',
      url: 'https://server.example.com/callLog?jwtToken=secret',
    },
  });
  logRecorder.logAction({
    name: 'API_RESPONSE',
    data: {
      status: 200,
      url: 'https://server.example.com/callLog?jwtToken=secret',
    },
  });
  logRecorder.logAction({
    name: 'rc-route-changed-notify',
    data: {
      path: '/customizedTabs/callLogger',
    },
  });
  logRecorder.logAction({ name: 'user description', data: 'Cannot save call log' });

  const currentLog = logRecorder.getLog();

  assert.deepEqual(currentLog.basicInfo, {
    platformName: 'acme',
    extensionVersion: '1.7.35',
  });
  assert.deepEqual(currentLog.summary, [
    'User description: Cannot save call log',
    'API_REQUEST: POST https://server.example.com/callLog',
    'API_RESPONSE: 200 https://server.example.com/callLog',
    'rc-route-changed-notify: /customizedTabs/callLogger',
  ]);
  assert.equal(currentLog.details.length, 4);
  assert.equal(currentLog.details[0].name, 'API_REQUEST');
  assert.equal(typeof currentLog.details[0].timestamp, 'string');
});

test('logRecorder uploads, downloads, and clears captured logs after a successful report upload', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;
  installWidget([]);

  const calls = [];
  const axios = {
    defaults: {
      headers: {
        common: {},
      },
    },
    async get(url) {
      calls.push({ method: 'get', url });
      return {
        data: {
          presignedUrl: 'https://upload.example.com/report.json',
        },
      };
    },
    async put(url, body, config) {
      calls.push({ method: 'put', url, body, config });
      return { status: 200 };
    },
  };
  const downloads = [];
  const logRecorder = await loadLogRecorder({ axios, downloads });

  await logRecorder.startRecordingLogs();
  logRecorder.logBasicInfo({ platformName: 'acme' });
  logRecorder.logAction({
    name: 'API_RESPONSE',
    data: {
      status: 500,
      url: 'https://server.example.com/callLog?jwtToken=secret',
    },
  });

  const uploaded = await logRecorder.uploadLogs({ serverUrl: 'https://server.example.com' });

  assert.equal(uploaded, true);
  assert.equal(calls[0].url, 'https://server.example.com/debug/report/url');
  assert.equal(calls[1].method, 'put');
  assert.equal(calls[1].url, 'https://upload.example.com/report.json');
  assert.equal(calls[1].config.skipAuthorization, true);
  assert.equal(calls[1].config.headers['Content-Type'], 'application/json');
  assert.match(calls[1].body, /"platformName": "acme"/);
  assert.deepEqual(downloads.map((download) => download.filename), ['error-log-report.json']);
  assert.match(downloads[0].text, /API_RESPONSE/);
  assert.deepEqual(logRecorder.getLog(), {
    summary: [],
    basicInfo: {},
    details: [],
  });
});

test('logRecorder downloads and clears captured logs when report upload fails', async () => {
  const storage = createChromeStorage();
  global.chrome = storage.chrome;
  installWidget([]);

  const axios = {
    defaults: {
      headers: {
        common: {},
      },
    },
    async get() {
      throw new Error('presigned URL unavailable');
    },
  };
  const downloads = [];
  const logRecorder = await loadLogRecorder({ axios, downloads });

  await logRecorder.startRecordingLogs();
  logRecorder.logAction({
    name: 'rc-post-message-request',
    data: {
      path: '/callLogger/createLog',
    },
  });

  const uploaded = await logRecorder.uploadLogs({ serverUrl: 'https://server.example.com' });

  assert.equal(uploaded, false);
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].text, /rc-post-message-request/);
  assert.deepEqual(logRecorder.getLog(), {
    summary: [],
    basicInfo: {},
    details: [],
  });
});