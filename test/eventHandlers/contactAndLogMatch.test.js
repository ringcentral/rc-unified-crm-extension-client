import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

function manifest() {
  return {
    serverUrl: 'https://server.example',
  };
}

async function loadMatchHandler(modulePath, overrides = {}) {
  vi.resetModules();

  const contactCore = {
    getContact: vi.fn(async () => ({
      matched: true,
      contactInfo: [
        {
          id: 'contact-1',
          type: 'Lead',
          name: 'Jane Lead',
          additionalInfo: { source: 'crm' },
          mostRecentActivityDate: '2026-07-03',
        },
        {
          id: 'new-contact',
          isNewContact: true,
          type: 'Lead',
          name: 'Create New',
        },
      ],
    })),
    openContactPage: vi.fn(async () => {}),
    ...overrides.contactCore,
  };
  vi.doMock('../../src/core/contact.js', () => ({ default: contactCore }));

  const logCore = {
    getLog: vi.fn(async () => ({
      successful: true,
      callLogs: [],
    })),
    getCachedNote: vi.fn(async () => ''),
    updateLog: vi.fn(async () => {}),
    ...overrides.logCore,
  };
  vi.doMock('../../src/core/log.js', () => ({ default: logCore }));

  const userCore = {
    getOneTimeLogSetting: vi.fn(() => ({ value: true })),
    getCallPopMultiMatchBehavior: vi.fn(() => ({ value: 'prompt' })),
    ...overrides.userCore,
  };
  vi.doMock('../../src/core/user.js', () => ({ default: userCore }));

  const util = {
    showNotification: vi.fn(),
    isObjectEmpty: vi.fn((obj) => Object.keys(obj || {}).length === 0),
    responseMessage: vi.fn((responseId, response) => {
      document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-post-message-response',
        responseId,
        response,
      }, '*');
    }),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const handler = await loadModule(modulePath);
  return {
    handler,
    contactCore,
    logCore,
    userCore,
    util,
  };
}

describe('contact and call-log match handlers', () => {
  beforeEach(() => {
    seedStorage({
      userSettings: {},
    });
  });

  it('registers temporary contact match task results with cached search contacts', async () => {
    seedStorage({
      'tempContactMatchTask-+16505550100': [
        {
          id: 'task-contact',
          type: 'Lead',
          name: 'Task Contact',
          phone: '+16505550100',
          additionalInfo: { task: true },
        },
      ],
      'rc-crm-search-contact-+16505550100': [
        {
          id: 'cached-contact',
          type: 'Contact',
          name: 'Cached Contact',
          phone: '+16505550100',
          additionalInfo: { cached: true },
        },
      ],
    });
    const { handler, util } = await loadMatchHandler(
      '../../src/eventHandlers/rc-post-message-request/contacts/match.js',
    );

    await handler.onEvent({
      data: {
        requestId: 'request-1',
        body: {
          phoneNumbers: ['+16505550100'],
        },
      },
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(readStorage()['tempContactMatchTask-+16505550100']).toBeUndefined();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', {
      data: {
        '+16505550100': [
          expect.objectContaining({ id: 'cached-contact', contactType: 'Contact' }),
          expect.objectContaining({ id: 'task-contact', contactType: 'Lead' }),
        ],
      },
    });
  });

  it('matches direct numbers, triggers remaining phone matches, and reports manual no-match notifications', async () => {
    let loaded = await loadMatchHandler(
      '../../src/eventHandlers/rc-post-message-request/contacts/match.js',
    );
    await loaded.handler.onEvent({
      data: {
        requestId: 'request-2',
        body: {
          phoneNumbers: ['+16505550100', '+16505550200'],
          triggerFrom: 'auto',
        },
      },
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(loaded.contactCore.getContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550100',
      isFromManual: false,
      isExtensionNumber: false,
      isForceRefresh: true,
      isToTriggerContactMatch: false,
    }));
    expect(loaded.util.responseMessage).toHaveBeenCalledWith('request-2', {
      data: {
        '+16505550100': [
          expect.objectContaining({
            id: 'contact-1',
            contactType: 'Lead',
            mostRecentActivityDate: '2026-07-03',
          }),
        ],
      },
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-trigger-contact-match',
          phoneNumbers: ['+16505550200'],
        },
      }),
    ]));

    loaded = await loadMatchHandler(
      '../../src/eventHandlers/rc-post-message-request/contacts/match.js',
      {
        contactCore: {
          getContact: vi.fn(async () => ({
            matched: false,
            returnMessage: {
              messageType: 'warning',
              message: 'No contact',
              ttl: 3000,
              details: ['Try another number'],
            },
            contactInfo: [],
          })),
        },
      },
    );
    await loaded.handler.onEvent({
      data: {
        requestId: 'request-3',
        body: {
          phoneNumbers: ['101'],
          triggerFrom: 'manual',
        },
      },
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.getContact).not.toHaveBeenCalled();

    seedStorage({
      userSettings: {
        allowExtensionNumberLogging: { value: true },
      },
    });
    await loaded.handler.onEvent({
      data: {
        requestId: 'request-4',
        body: {
          phoneNumbers: ['101'],
          triggerFrom: 'manual',
        },
      },
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.getContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '101',
      isFromManual: true,
      isExtensionNumber: true,
    }));
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'No contact',
      ttl: 3000,
      details: ['Try another number'],
    });
  });

  it('matches call logs from local storage, online logs, queue warnings, and one-time preparation status', async () => {
    seedStorage({
      userSettings: {
        oneTimeLog: { value: true },
      },
      'rc-crm-call-log-local-session': {
        contact: { id: 'local-contact' },
      },
      'is-call-queue-queue-session': {
        isQueue: true,
        warning: 'Answered by someone else',
      },
      'call-log-data-ready-pending-session': {
        isReady: false,
      },
    });
    const { handler, logCore, util } = await loadMatchHandler(
      '../../src/eventHandlers/rc-post-message-request/callLogger/match/index.js',
      {
        logCore: {
          getLog: vi.fn(async () => ({
            successful: true,
            callLogs: [
              {
                sessionId: 'online-session',
                matched: true,
                telephonySessionId: 'telephony-1',
                logId: 'log-1',
                contact: { id: 'online-contact' },
              },
              {
                sessionId: 'queue-session',
                matched: false,
              },
              {
                sessionId: 'pending-session',
                matched: false,
              },
            ],
          })),
          getCachedNote: vi.fn(async ({ sessionId }) => (sessionId === 'online-session' ? 'cached note' : '')),
          updateLog: vi.fn(async () => {}),
        },
      },
    );

    await handler.onEvent({
      data: {
        requestId: 'request-5',
        body: {
          sessionIds: ['local-session', 'online-session', 'queue-session', 'pending-session'],
        },
      },
      manifest: manifest(),
      platformName: 'salesforce',
    });

    expect(logCore.getLog).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionIds: 'online-session,queue-session,pending-session',
      requireDetails: false,
    });
    expect(logCore.updateLog).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      logType: 'Call',
      telephonySessionId: 'telephony-1',
      sessionId: 'online-session',
      note: 'cached note',
    });
    expect(readStorage()['rc-crm-call-log-online-session']).toEqual({
      logId: 'log-1',
      contact: { id: 'online-contact' },
    });
    expect(util.responseMessage).toHaveBeenCalledWith('request-5', {
      data: {
        'local-session': [{ id: 'local-session', note: '', contact: { id: 'local-contact' } }],
        'online-session': [{ id: 'online-session', note: 'cached note' }],
        'queue-session': [
          {
            type: 'status',
            status: 'failed',
            message: 'Answered by someone else',
          },
        ],
        'pending-session': [
          {
            type: 'status',
            status: 'failed',
            message: 'preparing data...',
          },
        ],
      },
    });
  });
});
