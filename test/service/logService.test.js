const assert = require('node:assert/strict');
const test = require('node:test');
const { loadBundledModule } = require('../helpers/bundledModule.cjs');
const { createChromeStorage } = require('../helpers/chromeStorage.cjs');

function loadLogService(overrides = {}) {
  return loadBundledModule('src/service/logService.js', {
    stubs: {
      '../core/user': overrides.userCore ?? {},
      '../core/log': overrides.logCore ?? {},
      '../core/disposition': overrides.dispositionCore ?? {},
      '../core/contact': overrides.contactCore ?? {},
      '../lib/util': overrides.util ?? {},
      '../lib/logUtil': overrides.logUtil ?? {},
    },
  });
}

test('logService syncs call data with recording download link and call metadata', async () => {
  const storage = createChromeStorage({
    rcAdditionalSubmission: {
      source: 'ringcentral',
    },
  });
  global.chrome = storage.chrome;

  const updateLogCalls = [];
  const logService = await loadLogService({
    logCore: {
      async getCachedNote({ sessionId }) {
        assert.equal(sessionId, 'session-1');
        return 'cached note';
      },
      async updateLog(args) {
        updateLogCalls.push(args);
      },
    },
    util: {
      getRcAccessToken() {
        return 'rc-access-token';
      },
    },
  });

  const call = {
    sessionId: 'session-1',
    telephonySessionId: 'telephony-1',
    recording: {
      link: 'https://recordings.example.com/play/1',
      contentUri: 'https://recordings.example.com/content/1',
    },
    startTime: '2026-06-29T01:00:00.000Z',
    duration: 120,
    result: 'Call connected',
    direction: 'Inbound',
    from: {
      phoneNumber: '+15550100',
    },
    to: {
      phoneNumber: '+15550101',
    },
  };

  await logService.syncCallData({
    serverUrl: 'https://server.example.com',
    dataBody: {
      call,
      aiNote: 'AI summary',
      transcript: 'Transcript text',
    },
  });

  assert.deepEqual(updateLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      rcAdditionalSubmission: {
        source: 'ringcentral',
      },
      telephonySessionId: 'telephony-1',
      sessionId: 'session-1',
      recordingLink: 'https://recordings.example.com/play/1',
      recordingDownloadLink: 'https://recordings.example.com/content/1?accessToken=rc-access-token',
      note: 'cached note',
      aiNote: 'AI summary',
      transcript: 'Transcript text',
      startTime: '2026-06-29T01:00:00.000Z',
      duration: 120,
      result: 'Call connected',
      direction: 'Inbound',
      from: {
        phoneNumber: '+15550100',
      },
      to: {
        phoneNumber: '+15550101',
      },
    },
  ]);
});

test('logService syncs call data without recording fields when recording is unavailable', async () => {
  const storage = createChromeStorage({
    rcAdditionalSubmission: {
      source: 'ringcentral',
    },
  });
  global.chrome = storage.chrome;

  const updateLogCalls = [];
  const logService = await loadLogService({
    logCore: {
      async getCachedNote({ sessionId }) {
        assert.equal(sessionId, 'session-2');
        return 'manual note';
      },
      async updateLog(args) {
        updateLogCalls.push(args);
      },
    },
    util: {
      getRcAccessToken() {
        throw new Error('access token should not be used without recording link');
      },
    },
  });

  const call = {
    sessionId: 'session-2',
    telephonySessionId: 'telephony-2',
    recording: {},
    startTime: '2026-06-29T02:00:00.000Z',
    duration: 45,
    result: 'No Answer',
    direction: 'Outbound',
    from: {
      phoneNumber: '+15550102',
    },
    to: {
      phoneNumber: '+15550103',
    },
  };

  await logService.syncCallData({
    serverUrl: 'https://server.example.com',
    dataBody: {
      call,
      aiNote: 'Missed call summary',
      transcript: 'No transcript',
    },
  });

  assert.deepEqual(updateLogCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      rcAdditionalSubmission: {
        source: 'ringcentral',
      },
      sessionId: 'session-2',
      note: 'manual note',
      aiNote: 'Missed call summary',
      transcript: 'No transcript',
      startTime: '2026-06-29T02:00:00.000Z',
      duration: 45,
      result: 'No Answer',
      direction: 'Outbound',
      from: {
        phoneNumber: '+15550102',
      },
      to: {
        phoneNumber: '+15550103',
      },
    },
  ]);
});
test('logService triggers call matcher for unlogged calls when server-side logging is enabled', async (t) => {
  const storage = createChromeStorage({
    crmAuthed: true,
    userSettings: {
      serverSideLogging: {
        enable: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const originalDocument = global.document;
  const originalRCAdapter = global.RCAdapter;
  t.after(() => {
    global.document = originalDocument;
    global.RCAdapter = originalRCAdapter;
  });

  const adapterCalls = [];
  global.RCAdapter = {
    async getUnloggedCalls(itemsPerPage, pageNumber) {
      adapterCalls.push({ itemsPerPage, pageNumber });
      return {
        calls: [
          { sessionId: 'session-1' },
          { sessionId: 'session-2' },
        ],
        hasMore: false,
      };
    },
  };

  const postedMessages = [];
  global.document = {
    querySelector(selector) {
      assert.equal(selector, '#rc-widget-adapter-frame');
      return {
        contentWindow: {
          postMessage(message, target) {
            postedMessages.push({ message, target });
          },
        },
      };
    },
  };

  const logService = await loadLogService();

  await logService.forceCallLogMatcherCheck();

  assert.deepEqual(adapterCalls, [
    {
      itemsPerPage: 10,
      pageNumber: 1,
    },
  ]);
  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-1', 'session-2'],
      },
      target: '*',
    },
  ]);
});

test('logService does not trigger call matcher when CRM auth or server-side logging is disabled', async (t) => {
  const storage = createChromeStorage({
    crmAuthed: false,
    userSettings: {
      serverSideLogging: {
        enable: true,
      },
    },
  });
  global.chrome = storage.chrome;

  const originalDocument = global.document;
  const originalRCAdapter = global.RCAdapter;
  t.after(() => {
    global.document = originalDocument;
    global.RCAdapter = originalRCAdapter;
  });

  global.RCAdapter = {
    async getUnloggedCalls() {
      throw new Error('unlogged calls should not be requested when CRM is unauthenticated');
    },
  };
  global.document = {
    querySelector() {
      throw new Error('widget should not be notified when matcher check is disabled');
    },
  };

  const logService = await loadLogService();

  await logService.forceCallLogMatcherCheck();
});
test('logService retro auto-logs matched historical calls and syncs disposition defaults', async (t) => {
  const storage = createChromeStorage({
    isAdmin: false,
    userSettings: {
      autoLogCall: {
        value: true,
      },
    },
    rcAdditionalSubmission: {
      source: 'ringcentral',
    },
    retroAutoCallLogMaxAttempt: 1,
    retroAutoCallLogNotificationId: 'existing-notification',
    retroAutoCallLogIntervalId: 42,
    implementedInterfaces: {
      upsertCallDisposition: true,
    },
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  const originalClearInterval = global.clearInterval;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
    global.clearInterval = originalClearInterval;
  });

  const adapterCalls = [];
  global.RCAdapter = {
    async getUnloggedCalls(itemsPerPage, pageNumber) {
      adapterCalls.push({ itemsPerPage, pageNumber });
      return {
        calls: [
          {
            sessionId: 'session-3',
            direction: 'Inbound',
            from: {
              phoneNumber: '+15550104',
            },
            to: {
              phoneNumber: '+15550105',
            },
            aiNote: 'Historical AI note',
            transcript: 'Historical transcript',
          },
        ],
        hasMore: false,
      };
    },
  };

  const clearedIntervals = [];
  global.clearInterval = (intervalId) => {
    clearedIntervals.push(intervalId);
  };

  const addLogCalls = [];
  const dispositionCalls = [];
  const notifications = [];
  const dismissedNotifications = [];
  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync() {
        return { value: true };
      },
      getAutoLogCallSetting(userSettings, isAdmin) {
        assert.equal(isAdmin, false);
        assert.deepEqual(userSettings.autoLogCall, { value: true });
        return { value: true };
      },
      getOneTimeLogSetting() {
        return { value: false };
      },
    },
    contactCore: {
      async getContact({ serverUrl, phoneNumber, platformName }) {
        assert.equal(serverUrl, 'https://server.example.com');
        assert.equal(phoneNumber, '+15550104');
        assert.equal(platformName, 'acme');
        return {
          matched: true,
          returnMessage: 'Matched',
          contactInfo: [
            {
              id: 'contact-1',
              name: 'Ada Lovelace',
              type: 'Lead',
            },
          ],
        };
      },
    },
    logUtil: {
      async getLogConflictInfo({ isAutoLog, contactInfo, logType, direction, isVoicemail }) {
        assert.equal(isAutoLog, true);
        assert.equal(logType, 'callLog');
        assert.equal(direction, 'Inbound');
        assert.equal(isVoicemail, false);
        assert.equal(contactInfo[0].id, 'contact-1');
        return {
          hasConflict: false,
          autoSelectAdditionalSubmission: {
            disposition: 'connected',
          },
        };
      },
    },
    logCore: {
      async getCachedNote({ sessionId }) {
        assert.equal(sessionId, 'session-3');
        return 'cached historical note';
      },
      async getLog({ serverUrl, logType, sessionIds, requireDetails }) {
        assert.equal(serverUrl, 'https://server.example.com');
        assert.equal(logType, 'Call');
        assert.equal(sessionIds, 'session-3');
        assert.equal(requireDetails, false);
        return {
          callLogs: [
            {
              sessionId: 'session-3',
              matched: false,
            },
          ],
        };
      },
      async addLog(args) {
        addLogCalls.push(args);
      },
    },
    dispositionCore: {
      async upsertDisposition(args) {
        dispositionCalls.push(args);
      },
    },
    util: {
      showNotification(notification) {
        notifications.push(notification);
        return 'new-notification';
      },
      dismissNotification(args) {
        dismissedNotifications.push(args);
      },
      isObjectEmpty(value) {
        return Object.keys(value).length === 0;
      },
      getRcAccessToken() {
        return 'unused-token';
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      callLogSettings: {},
    },
  });

  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 0);
  assert.deepEqual(adapterCalls, [
    {
      itemsPerPage: 50,
      pageNumber: 1,
    },
  ]);
  assert.equal(addLogCalls.length, 1);
  assert.deepEqual(addLogCalls[0], {
    serverUrl: 'https://server.example.com',
    logType: 'Call',
    logInfo: {
      sessionId: 'session-3',
      direction: 'Inbound',
      from: {
        phoneNumber: '+15550104',
      },
      to: {
        phoneNumber: '+15550105',
      },
      aiNote: 'Historical AI note',
      transcript: 'Historical transcript',
    },
    isMain: true,
    note: 'cached historical note',
    aiNote: 'Historical AI note',
    transcript: 'Historical transcript',
    subject: 'Inbound Call from Ada Lovelace',
    additionalSubmission: {
      disposition: 'connected',
    },
    contactId: 'contact-1',
    contactType: 'Lead',
    contactName: 'Ada Lovelace',
    isShowNotification: false,
  });
  assert.deepEqual(dispositionCalls, [
    {
      serverUrl: 'https://server.example.com',
      logType: 'Call',
      sessionId: 'session-3',
      dispositions: {
        disposition: 'connected',
        note: 'cached historical note',
      },
      rcAdditionalSubmission: {
        source: 'ringcentral',
      },
    },
  ]);
  assert.deepEqual(clearedIntervals, [42]);
  assert.deepEqual(dismissedNotifications, [
    {
      notificationId: 'existing-notification',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Historical call syncing finished. 1 call(s) synced.',
      ttl: 5000,
    },
  ]);
});
test('logService skips retro auto-log work when retro sync is disabled', async (t) => {
  const storage = createChromeStorage({
    userSettings: {
      retroCallLogSync: {
        value: false,
      },
    },
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
  });

  const adapterCalls = [];
  global.RCAdapter = {
    async getUnloggedCalls() {
      adapterCalls.push(true);
      throw new Error('unlogged calls should not be requested when retro sync is disabled');
    },
  };

  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync(userSettings) {
        assert.deepEqual(userSettings.retroCallLogSync, { value: false });
        return { value: false };
      },
    },
    util: {
      showNotification() {
        throw new Error('notification should not be shown when retro sync is disabled');
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {},
  });

  assert.deepEqual(adapterCalls, []);
  assert.equal(storage.store.retroAutoCallLogMaxAttempt, undefined);
});

test('logService stops retro auto-log interval when max attempts are exhausted', async (t) => {
  const storage = createChromeStorage({
    userSettings: {
      retroCallLogSync: {
        value: true,
      },
    },
    retroAutoCallLogMaxAttempt: 0,
    retroAutoCallLogIntervalId: 99,
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  const originalClearInterval = global.clearInterval;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
    global.clearInterval = originalClearInterval;
  });

  global.RCAdapter = {
    async getUnloggedCalls() {
      throw new Error('unlogged calls should not be requested after max attempts are exhausted');
    },
  };

  const clearedIntervals = [];
  global.clearInterval = (intervalId) => {
    clearedIntervals.push(intervalId);
  };

  const notifications = [];
  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync(userSettings) {
        assert.deepEqual(userSettings.retroCallLogSync, { value: true });
        return { value: true };
      },
    },
    util: {
      showNotification(notification) {
        notifications.push(notification);
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {},
  });

  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 0);
  assert.deepEqual(clearedIntervals, [99]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Historical call syncing finished. 0 call(s) synced.',
      ttl: 5000,
    },
  ]);
});

test('logService skips retro auto-log writes when matched historical calls have conflicts', async (t) => {
  const storage = createChromeStorage({
    isAdmin: false,
    userSettings: {
      autoLogCall: {
        value: true,
      },
      retroCallLogSync: {
        value: true,
      },
    },
    retroAutoCallLogMaxAttempt: 1,
    retroAutoCallLogNotificationId: 'existing-notification',
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  const originalClearInterval = global.clearInterval;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
    global.clearInterval = originalClearInterval;
  });

  const adapterCalls = [];
  global.RCAdapter = {
    async getUnloggedCalls(itemsPerPage, pageNumber) {
      adapterCalls.push({ itemsPerPage, pageNumber });
      return {
        calls: [
          {
            sessionId: 'session-conflict',
            direction: 'Outbound',
            from: {
              phoneNumber: '+15550106',
            },
            to: {
              phoneNumber: '+15550107',
            },
          },
        ],
        hasMore: true,
      };
    },
  };

  const clearedIntervals = [];
  global.clearInterval = (intervalId) => {
    clearedIntervals.push(intervalId);
  };

  const contactCalls = [];
  const conflictChecks = [];
  const notifications = [];
  const dismissedNotifications = [];
  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync(userSettings) {
        assert.deepEqual(userSettings.retroCallLogSync, { value: true });
        return { value: true };
      },
      getAutoLogCallSetting(userSettings, isAdmin) {
        assert.equal(isAdmin, false);
        assert.deepEqual(userSettings.autoLogCall, { value: true });
        return { value: true };
      },
      getOneTimeLogSetting() {
        throw new Error('one-time setting should not be checked when conflict blocks auto-log');
      },
    },
    contactCore: {
      async getContact(args) {
        contactCalls.push(args);
        return {
          matched: true,
          returnMessage: 'Matched',
          contactInfo: [
            {
              id: 'contact-conflict',
              name: 'Grace Hopper',
              type: 'Contact',
            },
          ],
        };
      },
    },
    logUtil: {
      async getLogConflictInfo(args) {
        conflictChecks.push(args);
        return {
          hasConflict: true,
          autoSelectAdditionalSubmission: {
            disposition: 'needs-review',
          },
        };
      },
    },
    logCore: {
      async getCachedNote() {
        throw new Error('cached note should not be read when conflict blocks auto-log');
      },
      async getLog() {
        throw new Error('server log should not be read when conflict blocks auto-log');
      },
      async addLog() {
        throw new Error('call log should not be added when conflict blocks auto-log');
      },
    },
    dispositionCore: {
      async upsertDisposition() {
        throw new Error('disposition should not be updated when conflict blocks auto-log');
      },
    },
    util: {
      showNotification(notification) {
        notifications.push(notification);
      },
      dismissNotification(args) {
        dismissedNotifications.push(args);
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      callLogSettings: {},
    },
  });

  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 0);
  assert.deepEqual(adapterCalls, [
    {
      itemsPerPage: 50,
      pageNumber: 1,
    },
  ]);
  assert.deepEqual(contactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550107',
      platformName: 'acme',
    },
  ]);
  assert.equal(conflictChecks.length, 1);
  assert.equal(conflictChecks[0].isAutoLog, true);
  assert.equal(conflictChecks[0].logType, 'callLog');
  assert.equal(conflictChecks[0].direction, 'Outbound');
  assert.equal(conflictChecks[0].isVoicemail, false);
  assert.equal(conflictChecks[0].contactInfo[0].id, 'contact-conflict');
  assert.deepEqual(clearedIntervals, []);
  assert.deepEqual(notifications, []);
  assert.deepEqual(dismissedNotifications, []);
});
test('logService completes retro auto-log without writes when historical calls are not contact matched', async (t) => {
  const storage = createChromeStorage({
    isAdmin: false,
    userSettings: {
      autoLogCall: {
        value: true,
      },
      retroCallLogSync: {
        value: true,
      },
    },
    retroAutoCallLogMaxAttempt: 1,
    retroAutoCallLogIntervalId: 777,
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  const originalClearInterval = global.clearInterval;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
    global.clearInterval = originalClearInterval;
  });

  const adapterCalls = [];
  global.RCAdapter = {
    async getUnloggedCalls(itemsPerPage, pageNumber) {
      adapterCalls.push({ itemsPerPage, pageNumber });
      return {
        calls: [
          {
            sessionId: 'session-unmatched',
            direction: 'Inbound',
            from: {
              phoneNumber: '+15550108',
            },
            to: {
              phoneNumber: '+15550109',
            },
          },
        ],
        hasMore: false,
      };
    },
  };

  const clearedIntervals = [];
  global.clearInterval = (intervalId) => {
    clearedIntervals.push(intervalId);
  };

  const contactCalls = [];
  const notifications = [];
  const dismissedNotifications = [];
  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync(userSettings) {
        assert.deepEqual(userSettings.retroCallLogSync, { value: true });
        return { value: true };
      },
      getAutoLogCallSetting(userSettings, isAdmin) {
        assert.equal(isAdmin, false);
        assert.deepEqual(userSettings.autoLogCall, { value: true });
        return { value: true };
      },
      getOneTimeLogSetting() {
        throw new Error('one-time setting should not be checked when contact is not matched');
      },
    },
    contactCore: {
      async getContact(args) {
        contactCalls.push(args);
        return {
          matched: false,
          returnMessage: 'No contact found',
          contactInfo: [],
        };
      },
    },
    logUtil: {
      async getLogConflictInfo() {
        throw new Error('conflict info should not be checked when contact is not matched');
      },
    },
    logCore: {
      async getCachedNote() {
        throw new Error('cached note should not be read when contact is not matched');
      },
      async getLog() {
        throw new Error('server log should not be read when contact is not matched');
      },
      async addLog() {
        throw new Error('call log should not be added when contact is not matched');
      },
    },
    dispositionCore: {
      async upsertDisposition() {
        throw new Error('disposition should not be updated when contact is not matched');
      },
    },
    util: {
      showNotification(notification) {
        notifications.push(notification);
        return `notification-${notifications.length}`;
      },
      dismissNotification(args) {
        dismissedNotifications.push(args);
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      callLogSettings: {},
    },
  });

  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 0);
  assert.equal(storage.store.retroAutoCallLogNotificationId, 'notification-1');
  assert.deepEqual(adapterCalls, [
    {
      itemsPerPage: 50,
      pageNumber: 1,
    },
  ]);
  assert.deepEqual(contactCalls, [
    {
      serverUrl: 'https://server.example.com',
      phoneNumber: '+15550108',
      platformName: 'acme',
    },
  ]);
  assert.deepEqual(clearedIntervals, [777]);
  assert.deepEqual(dismissedNotifications, [
    {
      notificationId: 'notification-1',
    },
  ]);
  assert.deepEqual(notifications, [
    {
      level: 'success',
      message: 'Attempting to sync historical call logs in the background...',
      ttl: 5000,
    },
    {
      level: 'success',
      message: 'Historical call syncing finished. 0 call(s) synced.',
      ttl: 5000,
    },
  ]);
});
test('logService triggers matcher instead of writing when retro server log is already matched', async (t) => {
  const storage = createChromeStorage({
    isAdmin: false,
    userSettings: {
      autoLogCall: {
        value: true,
      },
      retroCallLogSync: {
        value: true,
      },
    },
    retroAutoCallLogMaxAttempt: 1,
    retroAutoCallLogNotificationId: 'existing-notification',
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  const originalDocument = global.document;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
    global.document = originalDocument;
  });

  global.RCAdapter = {
    async getUnloggedCalls(itemsPerPage, pageNumber) {
      assert.equal(itemsPerPage, 50);
      assert.equal(pageNumber, 1);
      return {
        calls: [
          {
            sessionId: 'session-already-matched',
            direction: 'Inbound',
            from: {
              phoneNumber: '+15550110',
            },
            to: {
              phoneNumber: '+15550111',
            },
          },
        ],
        hasMore: true,
      };
    },
  };

  const postedMessages = [];
  global.document = {
    querySelector(selector) {
      assert.equal(selector, '#rc-widget-adapter-frame');
      return {
        contentWindow: {
          postMessage(message, target) {
            postedMessages.push({ message, target });
          },
        },
      };
    },
  };

  const addLogCalls = [];
  const dispositionCalls = [];
  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync(userSettings) {
        assert.deepEqual(userSettings.retroCallLogSync, { value: true });
        return { value: true };
      },
      getAutoLogCallSetting(userSettings, isAdmin) {
        assert.equal(isAdmin, false);
        assert.deepEqual(userSettings.autoLogCall, { value: true });
        return { value: true };
      },
      getOneTimeLogSetting() {
        throw new Error('one-time setting should not be checked when server log is already matched');
      },
    },
    contactCore: {
      async getContact(args) {
        assert.deepEqual(args, {
          serverUrl: 'https://server.example.com',
          phoneNumber: '+15550110',
          platformName: 'acme',
        });
        return {
          matched: true,
          returnMessage: 'Matched',
          contactInfo: [
            {
              id: 'contact-already-matched',
              name: 'Katherine Johnson',
              type: 'Contact',
            },
          ],
        };
      },
    },
    logUtil: {
      async getLogConflictInfo(args) {
        assert.equal(args.isAutoLog, true);
        assert.equal(args.logType, 'callLog');
        assert.equal(args.direction, 'Inbound');
        return {
          hasConflict: false,
          autoSelectAdditionalSubmission: {
            disposition: 'connected',
          },
        };
      },
    },
    logCore: {
      async getCachedNote({ sessionId }) {
        assert.equal(sessionId, 'session-already-matched');
        return 'cached note that should not be written';
      },
      async getLog(args) {
        assert.deepEqual(args, {
          serverUrl: 'https://server.example.com',
          logType: 'Call',
          sessionIds: 'session-already-matched',
          requireDetails: false,
        });
        return {
          callLogs: [
            {
              sessionId: 'session-already-matched',
              matched: true,
            },
          ],
        };
      },
      async addLog(args) {
        addLogCalls.push(args);
      },
    },
    dispositionCore: {
      async upsertDisposition(args) {
        dispositionCalls.push(args);
      },
    },
    util: {
      showNotification() {
        throw new Error('notification should not be shown while more retro pages remain');
      },
      dismissNotification() {
        throw new Error('notification should not be dismissed while more retro pages remain');
      },
      isObjectEmpty(value) {
        return Object.keys(value).length === 0;
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      callLogSettings: {},
    },
  });

  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 0);
  assert.deepEqual(addLogCalls, []);
  assert.deepEqual(dispositionCalls, []);
  assert.deepEqual(postedMessages, [
    {
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-already-matched'],
      },
      target: '*',
    },
  ]);
});

test('logService limits each retro auto-log run to ten successful writes', async (t) => {
  const storage = createChromeStorage({
    isAdmin: false,
    userSettings: {
      autoLogCall: {
        value: true,
      },
      retroCallLogSync: {
        value: true,
      },
    },
    retroAutoCallLogMaxAttempt: 1,
    retroAutoCallLogNotificationId: 'existing-notification',
  });
  global.chrome = storage.chrome;

  const originalRCAdapter = global.RCAdapter;
  const originalDocument = global.document;
  t.after(() => {
    global.RCAdapter = originalRCAdapter;
    global.document = originalDocument;
  });

  const calls = Array.from({ length: 12 }, (_, index) => ({
    sessionId: `session-batch-${index + 1}`,
    direction: 'Inbound',
    from: {
      phoneNumber: `+155502${String(index + 1).padStart(2, '0')}`,
    },
    to: {
      phoneNumber: '+15550300',
    },
  }));

  global.RCAdapter = {
    async getUnloggedCalls(itemsPerPage, pageNumber) {
      assert.equal(itemsPerPage, 50);
      assert.equal(pageNumber, 1);
      return {
        calls,
        hasMore: true,
      };
    },
  };

  global.document = {
    querySelector() {
      throw new Error('widget matcher should not be triggered when all processed logs are unmatched');
    },
  };

  const contactCalls = [];
  const noteCalls = [];
  const getLogCalls = [];
  const addLogCalls = [];
  const logService = await loadLogService({
    userCore: {
      getEnableRetroCallLogSync(userSettings) {
        assert.deepEqual(userSettings.retroCallLogSync, { value: true });
        return { value: true };
      },
      getAutoLogCallSetting(userSettings, isAdmin) {
        assert.equal(isAdmin, false);
        assert.deepEqual(userSettings.autoLogCall, { value: true });
        return { value: true };
      },
      getOneTimeLogSetting() {
        throw new Error('one-time setting should not be checked without additional submission');
      },
    },
    contactCore: {
      async getContact(args) {
        contactCalls.push(args);
        return {
          matched: true,
          returnMessage: 'Matched',
          contactInfo: [
            {
              id: `contact-${contactCalls.length}`,
              name: `Contact ${contactCalls.length}`,
              type: 'Contact',
            },
          ],
        };
      },
    },
    logUtil: {
      async getLogConflictInfo(args) {
        assert.equal(args.isAutoLog, true);
        assert.equal(args.logType, 'callLog');
        return {
          hasConflict: false,
          autoSelectAdditionalSubmission: {},
        };
      },
    },
    logCore: {
      async getCachedNote({ sessionId }) {
        noteCalls.push(sessionId);
        return `note for ${sessionId}`;
      },
      async getLog({ sessionIds }) {
        getLogCalls.push(sessionIds);
        return {
          callLogs: [
            {
              sessionId: sessionIds,
              matched: false,
            },
          ],
        };
      },
      async addLog(args) {
        addLogCalls.push(args);
      },
    },
    dispositionCore: {
      async upsertDisposition() {
        throw new Error('disposition should not be updated without additional submission');
      },
    },
    util: {
      showNotification() {
        throw new Error('notification should not be shown while more retro pages remain');
      },
      dismissNotification() {
        throw new Error('notification should not be dismissed while more retro pages remain');
      },
      isObjectEmpty(value) {
        return Object.keys(value).length === 0;
      },
    },
  });

  await logService.retroAutoCallLog({
    manifest: {
      serverUrl: 'https://server.example.com',
    },
    platformName: 'acme',
    platform: {
      callLogSettings: {},
    },
  });

  const expectedSessionIds = calls.slice(0, 10).map((call) => call.sessionId);
  assert.equal(storage.store.retroAutoCallLogMaxAttempt, 0);
  assert.equal(contactCalls.length, 10);
  assert.deepEqual(contactCalls.map((call) => call.phoneNumber), calls.slice(0, 10).map((call) => call.from.phoneNumber));
  assert.deepEqual(noteCalls, expectedSessionIds);
  assert.deepEqual(getLogCalls, expectedSessionIds);
  assert.equal(addLogCalls.length, 10);
  assert.deepEqual(addLogCalls.map((call) => call.logInfo.sessionId), expectedSessionIds);
});