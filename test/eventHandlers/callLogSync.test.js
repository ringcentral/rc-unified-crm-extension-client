const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');

test('callLogSync updates matched call data and clears pending recording marker', async () => {
  const syncCallDataCalls = [];
  const trackingCalls = [];
  const removedPendingRecordingSessionIds = [];

  const callLogSync = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/callLogSync.js', {
    stubs: {
      '../../../service/logService': {
        async syncCallData(args) {
          syncCallDataCalls.push(args);
        },
      },
      '../../../lib/analytics': {
        trackUpdateCallRecordingLink(args) {
          trackingCalls.push(args);
        },
      },
      '../../../lib/logUtil': {
        async removePendingRecordingSessionId(args) {
          removedPendingRecordingSessionIds.push(args);
        },
      },
    },
  });

  const dataBody = {
    call: {
      sessionId: 'session-1',
      recording: {
        link: 'https://recordings.example.com/recording-1',
      },
    },
  };

  await callLogSync.onEvent({
    data: {
      body: dataBody,
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    existingCalls: [
      {
        matched: true,
      },
    ],
  });

  assert.deepEqual(trackingCalls, [
    {
      processState: 'start',
    },
    {
      processState: 'finish',
    },
  ]);
  assert.deepEqual(syncCallDataCalls, [
    {
      serverUrl: 'https://server.example.com',
      dataBody,
    },
  ]);
  assert.deepEqual(removedPendingRecordingSessionIds, [
    {
      sessionId: 'session-1',
    },
  ]);
});

test('callLogSync does not sync when no matched call log exists', async () => {
  const syncCallDataCalls = [];
  const trackingCalls = [];
  const removedPendingRecordingSessionIds = [];

  const callLogSync = await loadBundledModule('src/eventHandlers/rc-post-message-request/callLogger/callLogSync.js', {
    stubs: {
      '../../../service/logService': {
        async syncCallData(args) {
          syncCallDataCalls.push(args);
        },
      },
      '../../../lib/analytics': {
        trackUpdateCallRecordingLink(args) {
          trackingCalls.push(args);
        },
      },
      '../../../lib/logUtil': {
        async removePendingRecordingSessionId(args) {
          removedPendingRecordingSessionIds.push(args);
        },
      },
    },
  });

  await callLogSync.onEvent({
    data: {
      body: {
        call: {
          sessionId: 'session-2',
          recording: {
            link: 'https://recordings.example.com/recording-2',
          },
        },
      },
    },
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    existingCalls: [],
  });

  assert.deepEqual(trackingCalls, [
    {
      processState: 'start',
    },
  ]);
  assert.deepEqual(syncCallDataCalls, []);
  assert.deepEqual(removedPendingRecordingSessionIds, []);
});
