import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

function baseCall(overrides: Record<string, any> = {}) {
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

function eventFor(overrides: Record<string, any> = {}) {
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

  const handlers: Record<string, any> = {};
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

  const contactCore: Record<string, any> = {
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

  const logCore: Record<string, any> = {
    getCachedNote: vi.fn(async () => 'cached note'),
    addLog: vi.fn(async () => ({})),
    updateLog: vi.fn(async () => ({})),
    getConflictContentFromUnresolvedLog: vi.fn(() => ({ description: 'Contact conflict' })),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const userCore: Record<string, any> = {
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

  const logUtil: Record<string, any> = {
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
        contact: [...existingContacts].sort(
          (a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime(),
        )[0] ?? null,
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

  const userCore: Record<string, any> = {
    getopenContactPageAfterCreationSetting: vi.fn((settings) => ({ value: settings?.openContactPageAfterCreation?.value ?? false })),
    getOneTimeLogSetting: vi.fn((settings) => ({ value: settings?.oneTimeLog?.value ?? false })),
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
  it('notifies and triggers matching when a missed queue call was answered elsewhere', async () => {
    const { callLogger, util } = await loadCallLoggerIndex();
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
  });

  it('acknowledges ringing queue calls without dispatching a log handler', async () => {
    const { callLogger, util, handlers } = await loadCallLoggerIndex();
    seedStorage({});

    await callLogger.onEvent({
      data: eventFor({
        call: baseCall({ queueCall: true, result: 'Ringing' }),
      }),
      ...context,
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(handlers.createLog.onEvent).not.toHaveBeenCalled();
  });

  it('handles queue-forwarded calls answered elsewhere without requiring cached queue state', async () => {
    const { callLogger, util, handlers } = await loadCallLoggerIndex();
    seedStorage({});

    await callLogger.onEvent({
      data: eventFor({
        call: baseCall({
          delegationType: 'QueueForwarding',
          result: 'Answered Elsewhere',
        }),
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
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(handlers.createLog.onEvent).not.toHaveBeenCalled();
  });

  it('marks ringing queue calls as answered elsewhere after disconnect', async () => {
    const { callLogger, util } = await loadCallLoggerIndex();
    seedStorage({});

    await callLogger.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({
          queueCall: true,
          telephonyStatus: 'Ringing',
          result: 'Disconnected',
        }),
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
  });

  it('opens one-time log wait state as a temporary note page', async () => {
    const { callLogger, logCore, tempLogNotePage } = await loadCallLoggerIndex();
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
          duration: undefined,
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
    expect(logCore.getCachedNote).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('allows a manual one-time log when call data is complete without the final action marker', async () => {
    const { callLogger, handlers, tempLogNotePage } = await loadCallLoggerIndex();
    seedStorage({
      userSettings: {
        oneTimeLog: { value: true },
      },
    });

    await callLogger.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({ action: undefined }),
      }),
      ...context,
    });

    expect(handlers.createLog.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        body: expect.objectContaining({
          call: expect.objectContaining({ sessionId: 'session-1' }),
        }),
      }),
    }));
    expect(tempLogNotePage.getTempLogNotePageRender).not.toHaveBeenCalled();
  });

  it('blocks extension-number logging when extension logging is disabled', async () => {
    const { callLogger, util } = await loadCallLoggerIndex();
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
  });

  it('allows outbound extension-number logging when explicitly enabled', async () => {
    const { callLogger, handlers } = await loadCallLoggerIndex();
    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: true },
      },
    });

    await callLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        call: baseCall({
          direction: 'Outbound',
          to: { extensionNumber: '202' },
        }),
      }),
      ...context,
    });

    expect(handlers.logForm.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      contactPhoneNumber: '202',
    }));
  });

  it('dispatches call-log sync to createLog when auto logging is enabled and no log exists', async () => {
    const { callLogger, logCore, handlers } = await loadCallLoggerIndex();
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
  });

  it('dispatches viewLog when matched logs already exist', async () => {
    const { callLogger, logCore, handlers } = await loadCallLoggerIndex();
    logCore.getLog.mockResolvedValueOnce({ callLogs: [{ matched: true, sessionId: 'session-1' }] });

    await callLogger.onEvent({
      data: eventFor({ triggerType: 'viewLog' }),
      ...context,
    });
    expect(handlers.viewLog.onEvent).toHaveBeenCalled();
  });

  it('switches createLog to editLog when a matched log already exists', async () => {
    const { callLogger, logCore, handlers } = await loadCallLoggerIndex();
    logCore.getLog
      .mockResolvedValueOnce({ callLogs: [{ matched: true, sessionId: 'session-1' }] })
      .mockResolvedValueOnce({ callLogs: [{ matched: true, sessionId: 'session-1', logData: { note: 'existing' } }] });

    await callLogger.onEvent({
      data: eventFor({ triggerType: 'createLog' }),
      ...context,
    });

    expect(handlers.createLog.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      triggerTypeInUse: 'editLog',
      existingCalls: [{ matched: true, sessionId: 'session-1', logData: { note: 'existing' } }],
    }));
  });

  it('dispatches logForm trigger types to the log form handler', async () => {
    const { callLogger, handlers } = await loadCallLoggerIndex();

    await callLogger.onEvent({
      data: eventFor({ triggerType: 'logForm' }),
      ...context,
    });
    expect(handlers.logForm.onEvent).toHaveBeenCalled();
  });

  it('acknowledges ringing presence updates without logging', async () => {
    const { callLogger, util, handlers } = await loadCallLoggerIndex();

    await callLogger.onEvent({
      data: eventFor({
        triggerType: 'presenceUpdate',
        call: baseCall({ result: 'Ringing' }),
      }),
      ...context,
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(handlers.createLog.onEvent).not.toHaveBeenCalled();
  });

  it('auto logs call-connected presence updates', async () => {
    const { callLogger, handlers } = await loadCallLoggerIndex();

    await callLogger.onEvent({
      data: eventFor({
        triggerType: 'presenceUpdate',
        call: baseCall({ result: 'CallConnected' }),
      }),
      ...context,
    });

    expect(handlers.createLog.onEvent).toHaveBeenCalledWith(expect.objectContaining({
      triggerTypeInUse: 'createLog',
      isAutoLog: true,
    }));
  });
});

describe('callLogger createLog', () => {
  it('returns early when contact matching fails', async () => {
    const { createLog, contactCore, util, logCore } = await loadCreateLog();
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
    expect(logCore.addLog).not.toHaveBeenCalled();
  });

  it('returns early without a platform notification when non-Google contact matching fails', async () => {
    const { createLog, contactCore, util } = await loadCreateLog();
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
    });

    expect(util.showNotification).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('opens a manual call log page when redirected', async () => {
    const { createLog, logUtil, logPage } = await loadCreateLog();
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

  it('auto creates an unknown contact and logs the call with disposition data', async () => {
    seedStorage({
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { createLog, contactCore, logCore, dispositionCore, logUtil } = await loadCreateLog();

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
  });

  it('uses cached contacts, toNumberEntity, and empty note fallback during auto logging', async () => {
    seedStorage({
      'rc-crm-search-contact-+16505550100': [
        { id: 'contact-b', type: 'Lead', name: 'Duplicate Cached' },
        { id: 'cached-contact', type: 'Lead', name: 'Cached Contact' },
      ],
    });
    const { createLog, logCore, dispositionCore } = await loadCreateLog();
    logCore.getCachedNote.mockResolvedValueOnce(null);

    await createLog.onEvent({
      data: eventFor({
        call: baseCall({
          toNumberEntity: 'contact-a',
        }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      existingCalls: [],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });

    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-a',
      contactName: 'Alpha Contact',
      subject: 'Inbound Call from Alpha Contact',
      note: '',
    }));
    expect(dispositionCore.upsertDisposition).not.toHaveBeenCalled();
  });

  it('warns instead of creating placeholders when unknown-contact preference skips logging', async () => {
    const { createLog, contactCore, logCore, logUtil, userCore, util } = await loadCreateLog();
    userCore.getUnknownContactPreferenceSetting.mockReturnValueOnce({ value: 'skipLogging' });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Unknown contact',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: false,
    });
    contactCore.getContact.mockResolvedValueOnce({
      matched: true,
      contactInfo: [],
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

    expect(contactCore.createContact).not.toHaveBeenCalled();
    expect(logCore.addLog).not.toHaveBeenCalled();
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Call not logged. Contact conflict.'),
    }));
  });

  it('auto updates the first alphabetical contact when manual disposition is required', async () => {
    seedStorage({
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { createLog, logCore, userCore, logUtil } = await loadCreateLog();
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
  });

  it('auto updates the most recently active contact for multiple-contact conflicts', async () => {
    seedStorage({
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { createLog, logCore, userCore, logUtil } = await loadCreateLog();
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
  });

  it('auto updates the earliest-created contact for multiple-contact conflicts', async () => {
    seedStorage({
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { createLog, logCore, userCore, logUtil } = await loadCreateLog();
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
  });

  it('warns and skips auto logging when earliest-created contact comparison lacks createdDate', async () => {
    seedStorage({
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
    });
    const { createLog, contactCore, logCore, userCore, logUtil, util } = await loadCreateLog();
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
    expect(logCore.addLog).not.toHaveBeenCalled();
    expect(logCore.updateLog).not.toHaveBeenCalled();
  });

  it('opens an inbound manual call page with cached logged contact id', async () => {
    seedStorage({
      'rc-crm-call-log-session-1': {
        contact: {
          id: 'logged-contact',
        },
      },
      implementedInterfaces: {
        findContactWithName: true,
      },
    });
    const { createLog, logUtil, logPage } = await loadCreateLog();

    await createLog.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({ direction: 'Inbound' }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      existingCalls: [],
      isAutoLog: false,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });

    expect(logUtil.cacheLogPageData).toHaveBeenCalledWith(expect.objectContaining({
      loggedContactId: 'logged-contact',
    }));
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      loggedContactId: 'logged-contact',
      useContactSearch: true,
    }));
    expect(logUtil.logPageFormDataDefaulting).toHaveBeenCalledWith(expect.objectContaining({
      caseType: 'inboundCall',
      logType: 'callLog',
    }));
  });

  it('auto creates outbound placeholder contacts without optional new-contact config', async () => {
    const { createLog, contactCore, logCore, logUtil } = await loadCreateLog();
    contactCore.getContact.mockResolvedValueOnce({
      matched: true,
      contactInfo: [
        {
          id: 'unknown-template',
          type: 'Lead',
          name: '',
          additionalInfo: {},
        },
      ],
    });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Unknown contact',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: false,
    });

    await createLog.onEvent({
      data: eventFor({
        call: baseCall({
          direction: 'Outbound',
          to: {
            phoneNumber: '+16505550200',
            name: '',
          },
        }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550200',
      userSettings: {},
      existingCalls: [],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
      platform: {
        contactTypes: [{ value: 'Lead', display: 'Lead' }],
        page: {},
      },
    });

    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550200',
      newContactName: expect.stringContaining('+16505550200'),
      additionalSubmission: {},
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
      subject: 'Outbound Call to Created Contact',
    }));
  });

  it('warns for skipped multiple-contact auto conflicts and unmatched toNumberEntity values', async () => {
    const { createLog, logCore, logUtil, userCore, util } = await loadCreateLog();
    userCore.getMultipleContactsPreferenceSetting.mockReturnValueOnce({ value: 'skipLogging' });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      conflictType: 'Multiple contacts',
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: false,
    });

    await createLog.onEvent({
      data: eventFor({
        call: baseCall({
          toNumberEntity: 'missing-contact',
        }),
      }),
      triggerTypeInUse: 'createLog',
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      existingCalls: [],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });

    expect(logCore.addLog).not.toHaveBeenCalled();
    expect(logCore.updateLog).not.toHaveBeenCalled();
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Call not logged. Contact conflict.'),
    }));
  });

  it('uses existing call notes when cached notes are unavailable during auto update', async () => {
    const { createLog, logCore, logUtil } = await loadCreateLog();
    logCore.getCachedNote.mockResolvedValueOnce(null);
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: false,
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
      existingCalls: [{ matched: true, sessionId: 'session-1', logData: { note: 'existing note', subject: '' } }],
      isAutoLog: true,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });

    expect(logCore.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      note: 'existing note',
      subject: 'Outbound Call to Beta Contact',
    }));
  });

  it('opens redirected edit call pages without create-log defaulting', async () => {
    const { createLog, logUtil, logPage } = await loadCreateLog();

    await createLog.onEvent({
      data: eventFor({
        redirect: true,
        call: baseCall({ direction: 'Inbound' }),
      }),
      triggerTypeInUse: 'editLog',
      contactPhoneNumber: '+16505550100',
      userSettings: {},
      existingCalls: [],
      isAutoLog: false,
      isCallAutoPopup: false,
      isExtensionNumber: false,
      ...context,
    });

    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      triggerType: 'editLog',
    }));
    expect(logUtil.logPageFormDataDefaulting).not.toHaveBeenCalled();
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
      call: expect.objectContaining({ sessionId: 'session-1' }),
    }));
    expect(dispositionCore.upsertDisposition).toHaveBeenCalledWith(expect.objectContaining({
      dispositions: { disposition: 'support', note: 'Updated note' },
    }));
  });

  it('creates existing-contact logs without optional callback or disposition work', async () => {
    seedStorage({
      userSettings: {},
      implementedInterfaces: {
        upsertCallDisposition: true,
      },
      rcUserInfo: {},
    });
    const { logForm, contactCore, logCore, dispositionCore, calldownPage } = await loadLogForm();
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('schedule failed'));

    await logForm.onEvent({
      data: eventFor({
        formData: {
          triggerType: 'createLog',
          contact: 'contact-1',
          contactName: 'Existing Contact',
          contactType: 'Lead',
          newContactName: '',
          newContactType: '',
          activityTitle: undefined,
          note: undefined,
          disposition: 'none',
          scheduleCallback: true,
          callbackDateTime: '2026-07-04T10:00:00',
        },
      }),
      contactPhoneNumber: '+16505550100',
      ...context,
    });

    expect(contactCore.createContact).not.toHaveBeenCalled();
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      subject: '',
      note: '',
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Existing Contact',
      additionalSubmission: {},
    }));
    expect(calldownPage.getCalldownPageWithRecords).not.toHaveBeenCalled();
    expect(dispositionCore.upsertDisposition).not.toHaveBeenCalled();
  });

  it('updates existing call logs without disposition when one-time logging is enabled', async () => {
    seedStorage({
      userSettings: {
        oneTimeLog: { value: true },
      },
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
          activityTitle: undefined,
          note: undefined,
          disposition: 'support',
        },
      }),
      contactPhoneNumber: '+16505550100',
      ...context,
    });

    expect(logCore.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      subject: '',
      note: '',
      sessionId: 'session-1',
    }));
    expect(dispositionCore.upsertDisposition).not.toHaveBeenCalled();
  });
});
