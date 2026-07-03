import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';
import { CONSTANTS } from '../../src/misc/constant';

async function loadMessageLogger() {
  vi.resetModules();

  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
  };
  vi.doMock('../../src/lib/util.js', () => util);

  const userCore = {
    getSMSPopSetting: vi.fn((settings) => ({ value: settings?.messageAutoPopup?.value ?? false })),
    getopenContactPageAfterCreationSetting: vi.fn((settings) => ({ value: settings?.openContactPageAfterCreation?.value ?? false })),
    getUnknownContactPreferenceSetting: vi.fn((settings) => ({ value: settings?.unknownContactPreference?.value ?? 'skipLogging' })),
    getMultipleContactsPreferenceSetting: vi.fn((settings) => ({ value: settings?.multipleContactsPreference?.value ?? 'skipLogging' })),
    getNewContactTypeSetting: vi.fn((settings) => ({ value: settings?.newContactType?.value ?? null })),
    getNewContactNamePrefixSetting: vi.fn((settings) => ({ value: settings?.newContactNamePrefix?.value ?? 'PlaceholderContact' })),
  };
  vi.doMock('../../src/core/user.js', () => ({ default: userCore }));

  const logCore = {
    addLog: vi.fn(async () => ({})),
    getConflictContentFromUnresolvedLog: vi.fn(() => ({ description: 'Multiple contacts found' })),
  };
  vi.doMock('../../src/core/log.js', () => ({ default: logCore }));

  const contactCore = {
    getContact: vi.fn(async () => ({
      contactInfo: [{ id: 'contact-1', type: 'Lead', name: 'Jane Smith' }],
    })),
    createContact: vi.fn(async () => ({
      contactInfo: { id: 'new-contact', type: 'Lead', name: 'New Contact' },
    })),
    openContactPage: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/contact.js', () => ({ default: contactCore }));

  const logUtil = {
    getLogConflictInfo: vi.fn(async () => ({
      hasConflict: false,
      autoSelectAdditionalSubmission: { disposition: 'sms' },
      requireManualDisposition: false,
    })),
    logPageFormDataDefaulting: vi.fn(async ({ targetPage }) => ({
      ...targetPage,
      defaulted: true,
    })),
    cacheLogPageData: vi.fn(async () => {}),
  };
  vi.doMock('../../src/lib/logUtil.js', () => logUtil);

  const logPage = {
    getLogPageRender: vi.fn(() => ({ id: 'messageLogPage' })),
  };
  vi.doMock('../../src/components/logPage.js', () => ({ default: logPage }));

  const groupLogPage = {
    getGroupLogPageRender: vi.fn(() => ({ id: 'groupMessageLogPage' })),
  };
  vi.doMock('../../src/components/groupLogPage.js', () => ({ default: groupLogPage }));

  const messageLogger = await loadModule('../../src/eventHandlers/rc-post-message-request/messageLogger/index.js');
  return {
    messageLogger,
    util,
    userCore,
    logCore,
    contactCore,
    logUtil,
    logPage,
    groupLogPage,
  };
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        page: {
          messageLog: {
            additionalFields: [
              { const: 'messageType' },
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

function conversation(overrides = {}) {
  return {
    conversationId: 'conversation-1',
    conversationLogId: 'conversation-log-1',
    type: 'SMS',
    messages: [
      {
        creationTime: '2026-07-03T08:00:00Z',
        direction: 'Outbound',
      },
    ],
    correspondents: [
      {
        phoneNumber: '+16505550100',
      },
    ],
    ...overrides,
  };
}

function eventFor(overrides = {}) {
  return {
    requestId: 'request-1',
    body: {
      triggerType: 'auto',
      conversation: conversation(),
      redirect: false,
      ...overrides,
    },
  };
}

const context = {
  manifest: manifest(),
  platformInfo: { platformName: 'salesforce' },
  platformName: 'salesforce',
  platform: {},
};

describe('messageLogger', () => {
  it('rejects extension numbers and unsupported group auto logs early', async () => {
    seedStorage({ userSettings: {} });
    const { messageLogger, util, logCore } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          correspondents: [{ extensionNumber: '101' }],
        }),
      }),
      ...context,
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Extension numbers cannot be logged',
    }));
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
    expect(logCore.addLog).not.toHaveBeenCalled();

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          type: 'Fax',
          correspondents: [
            { phoneNumber: '+16505550100' },
            { phoneNumber: '+16505550200' },
          ],
        }),
      }),
      ...context,
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Group messages of this type are not supported'),
    }));
  });

  it('auto logs group SMS members independently and reports skipped conflicts', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
      },
    });
    const { messageLogger, contactCore, logUtil, logCore, util } = await loadMessageLogger();

    contactCore.getContact
      .mockResolvedValueOnce({
        contactInfo: [{ id: 'contact-1', type: 'Lead', name: 'Jane Smith' }],
      })
      .mockResolvedValueOnce({
        contactInfo: [],
      })
      .mockResolvedValueOnce({
        contactInfo: [
          { id: 'contact-3a', type: 'Lead', name: 'Zoe Zeta' },
          { id: 'contact-3b', type: 'Lead', name: 'Amy Alpha' },
        ],
      });
    logUtil.getLogConflictInfo
      .mockResolvedValueOnce({
        hasConflict: false,
        autoSelectAdditionalSubmission: { disposition: 'sms' },
        requireManualDisposition: true,
      })
      .mockResolvedValueOnce({
        hasConflict: true,
        conflictType: CONSTANTS.UNKNOWN_CONTACT_CONFLICT_TYPE,
        autoSelectAdditionalSubmission: {},
        requireManualDisposition: false,
      })
      .mockResolvedValueOnce({
        hasConflict: true,
        conflictType: CONSTANTS.MULTIPLE_CONTACTS_CONFLICT_TYPE,
        autoSelectAdditionalSubmission: {},
        requireManualDisposition: false,
      });

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          correspondents: [
            { phoneNumber: '+16505550100' },
            { phoneNumber: '+16505550200' },
            { phoneNumber: '+16505550300' },
          ],
        }),
      }),
      ...context,
    });

    expect(contactCore.getContact).toHaveBeenCalledTimes(3);
    expect(logCore.addLog).toHaveBeenCalledTimes(1);
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      contactName: 'Jane Smith',
      contactPhoneNumber: '+16505550100',
      additionalSubmission: { disposition: 'sms' },
    }));
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: '2 group member(s) could not be auto-logged (no match or multiple matches). Please log them manually.',
    }));
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Manual disposition might be needed'),
    }));
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('auto logs messages from stored preferences or contact match results', async () => {
    const prefKey = 'rc-crm-conversation-pref-conversation-log-1';
    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
      },
      [prefKey]: {
        additionalSubmission: { messageType: 'pref' },
        contact: {
          id: 'pref-contact',
          type: 'Contact',
          name: 'Preferred Contact',
        },
      },
    });
    const { messageLogger, logCore, contactCore, logUtil } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor(),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      logType: 'Message',
      additionalSubmission: { messageType: 'pref' },
      contactId: 'pref-contact',
      contactType: 'Contact',
      contactName: 'Preferred Contact',
    }));

    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
      },
    });
    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({ conversationId: 'conversation-2', conversationLogId: 'conversation-log-2' }),
      }),
      ...context,
    });
    expect(contactCore.getContact).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      phoneNumber: '+16505550100',
      platformName: 'salesforce',
    });
    expect(logUtil.getLogConflictInfo).toHaveBeenCalledWith(expect.objectContaining({
      logType: 'messageLog',
      isAutoLog: true,
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      additionalSubmission: { disposition: 'sms' },
    }));
  });

  it('handles voicemail and fax auto-log conflicts and manual-disposition warnings', async () => {
    seedStorage({
      userSettings: {
        autoLogVoicemail: { value: true },
        autoLogOutboundFax: { value: true },
      },
    });
    const { messageLogger, logUtil, util, logCore } = await loadMessageLogger();

    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: true,
      autoSelectAdditionalSubmission: {},
      requireManualDisposition: true,
    });
    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'voicemail-1',
          conversationLogId: 'voicemail-log-1',
          type: 'VoiceMail',
        }),
      }),
      ...context,
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Voicemail not logged'),
    }));
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Manual disposition might be needed'),
    }));

    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: false,
      autoSelectAdditionalSubmission: { faxType: 'outbound' },
      requireManualDisposition: false,
    });
    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'fax-1',
          conversationLogId: 'fax-log-1',
          type: 'Fax',
          messages: [{ creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' }],
        }),
      }),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      additionalSubmission: { faxType: 'outbound' },
    }));
  });

  it('submits single and grouped manual message log forms', async () => {
    seedStorage({
      userSettings: {
        openContactPageAfterCreation: { value: true },
      },
    });
    const { messageLogger, contactCore, logCore } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        redirect: true,
        formData: {
          contact: 'createNewContact',
          newContactName: 'New Contact',
          newContactType: 'Lead',
          contactType: '',
          contactName: '',
          messageType: 'sms',
          ignoreNone: 'none',
          newCategory: 'prospect',
        },
      }),
      ...context,
    });
    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550100',
      newContactName: 'New Contact',
      newContactType: 'Lead',
      additionalSubmission: {
        messageType: 'sms',
        newCategory: 'prospect',
      },
    }));
    expect(contactCore.openContactPage).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
      contactType: 'Lead',
      contactName: 'New Contact',
    }));

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        formData: {
          section_0: {
            contact: 'contact-1',
            contactName: 'Jane Smith',
            contactType: 'Lead',
            newContactName: '',
            newContactType: '',
            contactPhoneNumber: '+16505550200',
            messageType: 'sms',
          },
        },
      }),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      contactName: 'Jane Smith',
      contactPhoneNumber: '+16505550200',
      additionalSubmission: expect.objectContaining({
        messageType: 'sms',
      }),
    }));
  });

  it('opens single and group message log pages with cached contacts and defaulted form data', async () => {
    seedStorage({
      userSettings: {
        messageAutoPopup: { value: true },
      },
      implementedInterfaces: {
        findContactWithName: true,
      },
      'rc-crm-search-contact-+16505550100': [
        { id: 'cached-contact', type: 'Lead', name: 'Cached Contact' },
      ],
    });
    const { messageLogger, logUtil, logPage, groupLogPage } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'manual',
        redirect: true,
        conversation: conversation({
          conversationId: 'single-open',
          conversationLogId: 'single-log',
          type: 'Thread',
        }),
      }),
      ...context,
    });
    expect(logUtil.cacheLogPageData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'single-open',
      logType: 'Message',
      getContactMatchResult: expect.objectContaining({
        '+16505550100': expect.arrayContaining([
          expect.objectContaining({ id: 'cached-contact' }),
        ]),
      }),
    }));
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'single-open',
      logType: 'Message',
      useContactSearch: true,
    }));
    expect(logUtil.logPageFormDataDefaulting).toHaveBeenCalledWith(expect.objectContaining({
      caseType: 'message',
      logType: 'messageLog',
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-update-messages-log-page',
          page: expect.objectContaining({ id: 'messageLogPage', defaulted: true }),
        },
        targetOrigin: '*',
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/messages/single-open',
        },
        targetOrigin: '*',
      },
    ]));

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'manual',
        redirect: true,
        conversation: conversation({
          conversationId: 'group-open',
          conversationLogId: 'group-log',
          type: 'Fax',
          correspondents: [
            { phoneNumber: '+16505550100' },
            { phoneNumber: '+16505550300' },
          ],
        }),
      }),
      ...context,
    });
    expect(groupLogPage.getGroupLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'group-open',
      useContactSearch: true,
    }));
    expect(logUtil.logPageFormDataDefaulting).toHaveBeenCalledWith(expect.objectContaining({
      caseType: 'fax',
    }));
  });
});
