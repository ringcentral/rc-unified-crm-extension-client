import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

function baseCall(overrides = {}) {
  return {
    sessionId: 'session-1',
    telephonySessionId: 'telephony-1',
    direction: 'Inbound',
    result: 'Completed',
    action: 'log',
    startTime: '2026-07-03T08:00:00Z',
    duration: 60,
    from: {
      phoneNumber: '+16505550100',
      name: 'Jane Caller',
    },
    to: {
      phoneNumber: '+16505550200',
      name: 'Agent',
    },
    ...overrides,
  };
}

function eventFor(overrides = {}) {
  return {
    requestId: 'request-1',
    body: {
      triggerType: 'createLog',
      redirect: false,
      call: baseCall(),
      ...overrides,
    },
  };
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        page: {
          callLog: {
            additionalFields: [
              { const: 'disposition' },
              { const: 'ignoreNone' },
            ],
          },
          newContact: {
            additionalFields: [
              { const: 'newCategory' },
            ],
          },
        },
      },
    },
  };
}

const context = {
  manifest: manifest(),
  platformInfo: { platformName: 'salesforce' },
  platformName: 'salesforce',
  platform: {
    name: 'salesforce',
    contactTypes: [{ value: 'Lead', display: 'Lead' }],
    page: {
      newContact: {
        additionalFields: [{ const: 'newCategory' }],
      },
    },
  },
};

async function loadCallLoggerIndex() {
  vi.resetModules();
  const util = {
    responseMessage: vi.fn(),
    isObjectEmpty: vi.fn((obj) => Object.keys(obj || {}).length === 0),
    showNotification: vi.fn(),
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const logCore = {
    getLog: vi.fn(async () => ({ callLogs: [] })),
    getCachedNote: vi.fn(async () => 'cached note'),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const userCore = {
    getOneTimeLogSetting: vi.fn((settings) => ({ value: settings?.oneTimeLog?.value ?? false })),
    getCallPopSetting: vi.fn((settings) => ({ value: settings?.popupLogPageAfterCall?.value ?? false })),
    getAutoLogCallSetting: vi.fn((settings) => ({ value: settings?.autoLogCall?.value ?? false })),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const tempLogNotePage = {
    getTempLogNotePageRender: vi.fn(() => ({ id: 'tempLogNotePage' })),
  };
  vi.doMock('../../src/components/tempLogNotePage.ts', () => ({ default: tempLogNotePage }));

  const handlers = {};
  for (const [name, modulePath] of Object.entries({
    logForm: '../../src/eventHandlers/rc-post-message-request/callLogger/logForm.ts',
    callLogSync: '../../src/eventHandlers/rc-post-message-request/callLogger/callLogSync.ts',
    viewLog: '../../src/eventHandlers/rc-post-message-request/callLogger/viewLog.ts',
    createLog: '../../src/eventHandlers/rc-post-message-request/callLogger/createLog.ts',
  })) {
    vi.doMock(modulePath, () => {
      handlers[name] = {
        onEvent: vi.fn(async () => {}),
      };
      return { default: handlers[name] };
    });
  }

  const callLogger = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/index.ts');
  return {
    callLogger,
    util,
    logCore,
    userCore,
    tempLogNotePage,
    handlers,
  };
}

async function loadCreateLog() {
  vi.resetModules();
  vi.doUnmock('../../src/eventHandlers/rc-post-message-request/callLogger/createLog.ts');
  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
    isObjectEmpty: vi.fn((obj) => Object.keys(obj || {}).length === 0),
  };
  vi.doMock('../../src/lib/util.ts', () => util);
  vi.doMock('../../src/i18n/index.ts', () => ({
    t: vi.fn((key) => (
      key === 'notifications.warning.earliestCreatedResolverMissingField'
        ? 'Call not logged because createdDate is missing.'
        : key
    )),
  }));

  const contactCore = {
    getContact: vi.fn(async () => ({
      matched: true,
      contactInfo: [
        {
          id: 'contact-b',
          type: 'Lead',
          name: 'Beta Contact',
          createdDate: '2026-07-01T08:00:00Z',
          mostRecentActivityDate: '2026-07-01T08:00:00Z',
          additionalInfo: {
            Lead: {
              newCategory: [{ const: 'prospect' }],
            },
          },
        },
        {
          id: 'contact-a',
          type: 'Lead',
          name: 'Alpha Contact',
          createdDate: '2026-07-02T08:00:00Z',
          mostRecentActivityDate: '2026-07-02T08:00:00Z',
        },
      ],
    })),
    createContact: vi.fn(async () => ({
      contactInfo: { id: 'new-contact', type: 'Lead', name: 'Created Contact' },
    })),
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const logCore = {
    getCachedNote: vi.fn(async () => 'cached note'),
    addLog: vi.fn(async () => ({})),
    updateLog: vi.fn(async () => ({})),
    getConflictContentFromUnresolvedLog: vi.fn(() => ({ description: 'Contact conflict' })),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const userCore = {
    getUnknownContactPreferenceSetting: vi.fn(() => ({ value: 'createNewPlaceholderContact' })),
    getNewContactNamePrefixSetting: vi.fn(() => ({ value: 'Auto ' })),
    getNewContactTypeSetting: vi.fn(() => ({ value: 'Lead' })),
    getMultipleContactsPreferenceSetting: vi.fn(() => ({ value: 'firstAlphabetical' })),
    getOneTimeLogSetting: vi.fn(() => ({ value: false })),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const dispositionCore = {
    upsertDisposition: vi.fn(async () => ({})),
  };
  vi.doMock('../../src/core/disposition.ts', () => ({ default: dispositionCore }));

  const logUtil = {
    getLogConflictInfo: vi.fn(async () => ({
      hasConflict: false,
      autoSelectAdditionalSubmission: { disposition: 'demo' },
      requireManualDisposition: false,
    })),
    logPageFormDataDefaulting: vi.fn(async ({ targetPage }) => ({ ...targetPage, defaulted: true })),
    cacheLogPageData: vi.fn(async () => {}),
    getExistingContacts: vi.fn((contactInfo = []) => (contactInfo || []).filter((contact) => !contact.isNewContact)),
    resolveEarliestCreatedContact: vi.fn((contactInfo = []) => {
      const existingContacts = (contactInfo || []).filter((contact) => !contact.isNewContact);
      const missingCreatedDate = existingContacts.some((contact) => !contact.createdDate);
      if (missingCreatedDate) {
        return { contact: null, missingCreatedDate: true };
      }
      return {
        contact: [...existingContacts].sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate))[0] ?? null,
        missingCreatedDate: false,
      };
    }),
    resolveMostRecentActivityContact: vi.fn((contactInfo = []) => {
      const contactsWithActivityDate = (contactInfo || [])
        .filter((contact) => !contact.isNewContact && contact.mostRecentActivityDate)
        .map((contact) => ({
          contact,
          mostRecentActivityTimestamp: new Date(contact.mostRecentActivityDate).getTime(),
        }))
        .filter((contact) => !Number.isNaN(contact.mostRecentActivityTimestamp));
      return [...contactsWithActivityDate].sort((a, b) => b.mostRecentActivityTimestamp - a.mostRecentActivityTimestamp)[0]?.contact ?? null;
    }),
  };
  vi.doMock('../../src/lib/logUtil.ts', () => logUtil);

  const logPage = {
    getLogPageRender: vi.fn(() => ({ id: 'callLogPage' })),
  };
  vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));

  const createLog = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/createLog.ts');
  return {
    createLog,
    util,
    contactCore,
    logCore,
    userCore,
    dispositionCore,
    logUtil,
    logPage,
  };
}

async function loadLogForm() {
  vi.resetModules();
  vi.doUnmock('../../src/eventHandlers/rc-post-message-request/callLogger/logForm.ts');
  vi.mocked(axios.post).mockReset();
  vi.mocked(axios.post).mockResolvedValue({ data: { ok: true } });

  const util = {
    isObjectEmpty: vi.fn((obj) => Object.keys(obj || {}).length === 0),
    showNotification: vi.fn(),
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const contactCore = {
    createContact: vi.fn(async () => ({
      contactInfo: { id: 'new-contact', type: 'Lead', name: 'New Contact' },
      returnMessage: { messageType: 'success', message: 'Created', ttl: 3000 },
    })),
    openContactPage: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const userCore = {
    getopenContactPageAfterCreationSetting: vi.fn((settings) => ({ value: settings?.openContactPageAfterCreation?.value ?? false })),
    getOneTimeLogSetting: vi.fn(() => ({ value: false })),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const logCore = {
    addLog: vi.fn(async () => ({})),
    updateLog: vi.fn(async () => ({})),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const calldownPage = {
    getCalldownPageWithRecords: vi.fn(async () => ({ id: 'calldownPage' })),
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));

  const dispositionCore = {
    upsertDisposition: vi.fn(async () => ({})),
  };
  vi.doMock('../../src/core/disposition.ts', () => ({ default: dispositionCore }));

  const logPage = {
    getUnloggedCallPageRender: vi.fn(() => ({ id: 'unloggedCallPage' })),
  };
  vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));

  const logForm = await loadModule('../../src/eventHandlers/rc-post-message-request/callLogger/logForm.ts');
  return {
    logForm,
    util,
    contactCore,
    userCore,
    logCore,
    calldownPage,
    dispositionCore,
    logPage,
  };
}

describe('callLogger index', () => {
  it('handles queue calls, one-time log wait state, extension blocking, and trigger dispatch', async () => {
    const { callLogger, util, logCore, tempLogNotePage, handlers } = await loadCallLoggerIndex();

    seedStorage({
      'is-call-queue-session-1': { isQueue: true },
    });
    await callLogger.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({ result: 'Missed' }),
      }),
      ...context,
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-1'],
      },
      targetOrigin: '*',
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('answered by someone else'),
    }));

    seedStorage({});
    await callLogger.onEvent({
      data: eventFor({
        call: baseCall({ queueCall: true, result: 'Ringing' }),
      }),
      ...context,
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });

    seedStorage({
      userSettings: {
        oneTimeLog: { value: true },
      },
    });
    await callLogger.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({
          recording: { link: 'https://recording.example' },
        }),
      }),
      ...context,
    });
    expect(tempLogNotePage.getTempLogNotePageRender).toHaveBeenCalledWith({
      sessionId: 'session-1',
      cachedNote: 'cached note',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/tempLogNotePage',
        },
        targetOrigin: '*',
      },
    ]));

    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: false },
      },
    });
    await callLogger.onEvent({
      data: eventFor({
        call: baseCall({
          from: { extensionNumber: '101' },
        }),
      }),
      ...context,
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Extension numbers cannot be logged',
    }));

    seedStorage({
      userSettings: {
        autoLogCall: { value: true },
      },
    });
    logCore.getLog.mockResolvedValueOnce({ callLogs: [] });
    await callLogger.onEvent({
      data: eventFor({
        triggerType: 'callLogSync',
      }),
      ...context,
    });
    expect(handlers.createLog.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      triggerTypeInUse: 'createLog',
      isAutoLog: true,
    }));

    logCore.getLog.mockResolvedValueOnce({ callLogs: [{ matched: true, sessionId: 'session-1' }] });
    await callLogger.onEvent({
      data: eventFor({ triggerType: 'viewLog' }),
      ...context,
    });
    expect(handlers.viewLog.onEvent).toHaveBeenCalled();

    await callLogger.onEvent({
      data: eventFor({ triggerType: 'logForm' }),
      ...context,
    });
    expect(handlers.logForm.onEvent).toHaveBeenCalled();

    await callLogger.onEvent({
      data: eventFor({
        triggerType: 'presenceUpdate',
        call: baseCall({ result: 'Ringing' }),
      }),
      ...context,
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });
});

describe('callLogger createLog', () => {
  it('returns early when contact matching fails and opens manual call log pages when redirected', async () => {
    const { createLog, contactCore, util, logUtil, logPage } = await loadCreateLog();
    contactCore.getContact.mockResolvedValueOnce({
      matched: false,
      returnMessage: { messageType: 'warning', message: 'No match', ttl: 3000 },
      contactInfo: [],
    });

    await createLog.onEvent({
      data: eventFor(),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      existingCalls: [],
      isAutoLog: false,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
      platformName: 'googleSheets',
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'No match',
    }));
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });

    await createLog.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({ direction: 'Outbound' }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550200',
      userSettings: {},
      existingCalls: [{ sessionId: 'session-1', logData: { note: 'existing', subject: 'Existing' } }],
      isAutoLog: false,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });
    expect(logUtil.cacheLogPageData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-1',
      logType: 'Call',
      logInfo: { note: 'existing', subject: 'Existing' },
    }));
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-1',
      logType: 'Call',
      contactPhoneNumber: '+16505550200',
    }));
    expect(logUtil.logPageFormDataDefaulting).toHaveBeenCalledWith(expect.objectContaining({
      caseType: 'outboundCall',
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-update-call-log-page',
          page: expect.objectContaining({ id: 'callLogPage', defaulted: true }),
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('auto logs unknown and multiple-contact conflict resolutions', async () => {
    seedStorage({
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { createLog, contactCore, logCore, userCore, dispositionCore, logUtil, util } = await loadCreateLog();

    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Unknown contact',
      autoSelectAdditionalSubmission: { disposition: 'demo' },
      requireManualDisposition: false,
    });
    await createLog.onEvent({
      data: eventFor(),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      existingCalls: [],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });
    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      newContactName: 'Auto Jane Caller +16505550100',
      newContactType: 'Lead',
      additionalSubmission: {
        newCategory: 'prospect',
      },
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
      additionalSubmission: { disposition: 'demo' },
    }));
    expect(dispositionCore.upsertDisposition).toHaveBeenCalledWith(expect.objectContaining({
      dispositions: { disposition: 'demo', note: 'cached note' },
    }));

    userCore.getMultipleContactsPreferenceSetting.mockReturnValueOnce({ value: 'firstAlphabetical' });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Multiple contacts',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: true,
    });
    await createLog.onEvent({
      data: eventFor({
        call: baseCall({ direction: 'Outbound' }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550200',
      userSettings: {},
      existingCalls: [{ matched: true, sessionId: 'session-1', logData: { note: 'old note', subject: '' } }],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });
    expect(logCore.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Outbound Call to Alpha Contact',
      note: 'cached note',
    }));

    userCore.getMultipleContactsPreferenceSetting.mockReturnValueOnce({ value: 'mostRecentActivity' });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Multiple contacts',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: false,
    });
    await createLog.onEvent({
      data: eventFor({
        call: baseCall({ direction: 'Outbound' }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550200',
      userSettings: {},
      existingCalls: [{ matched: true, sessionId: 'session-1', logData: { note: 'old note', subject: '' } }],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });
    expect(logUtil.resolveMostRecentActivityContact).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'contact-b', mostRecentActivityDate: '2026-07-01T08:00:00Z' }),
      expect.objectContaining({ id: 'contact-a', mostRecentActivityDate: '2026-07-02T08:00:00Z' }),
    ]));
    expect(logCore.updateLog).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: 'Outbound Call to Alpha Contact',
      note: 'cached note',
    }));

    userCore.getMultipleContactsPreferenceSetting.mockReturnValueOnce({ value: 'earliestCreated' });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Multiple contacts',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: false,
    });
    await createLog.onEvent({
      data: eventFor({
        call: baseCall({ direction: 'Outbound' }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550200',
      userSettings: {},
      existingCalls: [{ matched: true, sessionId: 'session-1', logData: { note: 'old note', subject: '' } }],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });
    expect(logUtil.resolveEarliestCreatedContact).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'contact-b', createdDate: '2026-07-01T08:00:00Z' }),
      expect.objectContaining({ id: 'contact-a', createdDate: '2026-07-02T08:00:00Z' }),
    ]));
    expect(logCore.updateLog).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: 'Outbound Call to Beta Contact',
      note: 'cached note',
    }));

    userCore.getMultipleContactsPreferenceSetting.mockReturnValueOnce({ value: 'earliestCreated' });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Multiple contacts',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: false,
    });
    contactCore.getContact.mockResolvedValueOnce({
      matched: true,
      contactInfo: [
        { id: 'contact-b', type: 'Lead', name: 'Beta Contact', createdDate: '2026-07-01T08:00:00Z' },
        { id: 'contact-a', type: 'Lead', name: 'Alpha Contact' },
      ],
    });
    const addLogCallsBeforeMissingCreatedDate = logCore.addLog.mock.calls.length;
    const updateLogCallsBeforeMissingCreatedDate = logCore.updateLog.mock.calls.length;
    await createLog.onEvent({
      data: eventFor({
        call: baseCall({ direction: 'Outbound' }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550200',
      userSettings: {},
      existingCalls: [{ matched: true, sessionId: 'session-1', logData: { note: 'old note', subject: '' } }],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });
    expect(util.showNotification).toHaveBeenLastCalledWith(expect.objectContaining({
      level: 'warning',
      message: expect.stringContaining('createdDate'),
    }));
    expect(logCore.addLog).toHaveBeenCalledTimes(addLogCallsBeforeMissingCreatedDate);
    expect(logCore.updateLog).toHaveBeenCalledTimes(updateLogCallsBeforeMissingCreatedDate);
  });
});

describe('callLogger logForm', () => {
  it('creates new-contact call logs, schedules callback, updates disposition, and removes unlogged calls', async () => {
    seedStorage({
      userSettings: {
        openContactPageAfterCreation: { value: true },
      },
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
      rcUserInfo: {
        rcAccountId: 'account-1',
      },
      unloggedCallPageDataCache: [
        { sessionId: 'session-1' },
        { sessionId: 'session-2' },
      ],
    });
    const { logForm, contactCore, logCore, dispositionCore, calldownPage, logPage } = await loadLogForm();

    await logForm.onEvent({
      data: eventFor({
        formData: {
          triggerType: 'createLog',
          contact: 'createNewContact',
          contactName: '',
          contactType: '',
          newContactName: 'New Contact',
          newContactType: 'Lead',
          activityTitle: 'Call title',
          note: 'Call note',
          disposition: 'demo',
          ignoreNone: 'none',
          newCategory: 'prospect',
          scheduleCallback: true,
          callbackDateTime: '2026-07-04T10:00:00',
        },
      }),
      contactPhoneNumber: '+16505550100',
      ...context,
    });

    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550100',
      newContactName: 'New Contact',
      additionalSubmission: {
        disposition: 'demo',
        newCategory: 'prospect',
      },
    }));
    expect(contactCore.openContactPage).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Call title',
      note: 'Call note',
      contactId: 'new-contact',
    }));
    expect(axios.post).toHaveBeenCalledWith('https://server.example/calldown?rcAccountId=account-1', expect.objectContaining({
      contactId: 'new-contact',
      scheduledAt: '2026-07-04T10:00:00',
    }));
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalled();
    expect(dispositionCore.upsertDisposition).toHaveBeenCalledWith(expect.objectContaining({
      dispositions: { disposition: 'demo', newCategory: 'prospect', note: 'Call note' },
    }));
    expect(logPage.getUnloggedCallPageRender).toHaveBeenCalledWith({
      unloggedCalls: [{ sessionId: 'session-2' }],
    });
  });

  it('updates existing call logs and dispositions', async () => {
    seedStorage({
      userSettings: {},
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { logForm, logCore, dispositionCore } = await loadLogForm();

    await logForm.onEvent({
      data: eventFor({
        formData: {
          triggerType: 'editLog',
          contact: 'contact-1',
          contactName: 'Jane',
          contactType: 'Lead',
          newContactName: '',
          newContactType: '',
          activityTitle: 'Updated title',
          note: 'Updated note',
          disposition: 'support',
        },
      }),
      contactPhoneNumber: '+16505550100',
      ...context,
    });
    expect(logCore.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Updated title',
      note: 'Updated note',
      sessionId: 'session-1',
    }));
    expect(dispositionCore.upsertDisposition).toHaveBeenCalledWith(expect.objectContaining({
      dispositions: { disposition: 'support', note: 'Updated note' },
    }));
  });
});
