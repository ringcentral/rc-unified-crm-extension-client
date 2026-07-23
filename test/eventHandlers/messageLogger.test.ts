import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage, readStorage } from '../setup/storageHelpers';
import { CONSTANTS } from '../../src/misc/constant';

async function loadMessageLogger() {
  vi.resetModules();

  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const userCore: Record<string, any> = {
    getSMSPopSetting: vi.fn((settings) => ({ value: settings?.messageAutoPopup?.value ?? false })),
    getopenContactPageAfterCreationSetting: vi.fn((settings) => ({ value: settings?.openContactPageAfterCreation?.value ?? false })),
    getUnknownContactPreferenceSetting: vi.fn((settings) => ({ value: settings?.unknownContactPreference?.value ?? 'skipLogging' })),
    getMultipleContactsPreferenceSetting: vi.fn((settings) => ({ value: settings?.multipleContactsPreference?.value ?? 'skipLogging' })),
    getNewContactTypeSetting: vi.fn((settings) => ({ value: settings?.newContactType?.value ?? null })),
    getNewContactNamePrefixSetting: vi.fn((settings) => ({ value: settings?.newContactNamePrefix?.value ?? 'PlaceholderContact' })),
  };
  vi.doMock('../../src/core/user.ts', () => ({ default: userCore }));

  const logCore: Record<string, any> = {
    addLog: vi.fn(async () => ({})),
    getConflictContentFromUnresolvedLog: vi.fn(() => ({ description: 'Multiple contacts found' })),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const contactCore: Record<string, any> = {
    getContact: vi.fn(async () => ({
      contactInfo: [{ id: 'contact-1', type: 'Lead', name: 'Jane Smith' }],
    })),
    createContact: vi.fn(async () => ({
      contactInfo: { id: 'new-contact', type: 'Lead', name: 'New Contact' },
    })),
    openContactPage: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const logUtil: Record<string, any> = {
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
  vi.doMock('../../src/lib/logUtil.ts', () => logUtil);

  const logPage = {
    getLogPageRender: vi.fn(() => ({ id: 'messageLogPage' })),
  };
  vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));

  const groupLogPage = {
    getGroupLogPageRender: vi.fn(() => ({ id: 'groupMessageLogPage' })),
  };
  vi.doMock('../../src/components/groupLogPage.ts', () => ({ default: groupLogPage }));

  const messageLogger = await loadModule('../../src/eventHandlers/rc-post-message-request/messageLogger/index.ts');
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

function conversation(overrides: Record<string, any> = {}) {
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

function eventFor(overrides: Record<string, any> = {}) {
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

  it('warns when voicemail auto logging hits a conflict requiring manual disposition', async () => {
    seedStorage({
      userSettings: {
        autoLogVoicemail: { value: true },
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
    expect(logCore.addLog).not.toHaveBeenCalled();
  });

  it('auto logs outbound fax messages with selected additional submission', async () => {
    seedStorage({
      userSettings: {
        autoLogOutboundFax: { value: true },
      },
    });
    const { messageLogger, logUtil, logCore } = await loadMessageLogger();

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

  it('submits a manual message log form for a new contact and opens it after creation', async () => {
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
  });

  it('submits a grouped manual message log form section for an existing contact', async () => {
    seedStorage({
      userSettings: {},
    });
    const { messageLogger, logCore } = await loadMessageLogger();

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

  it('opens a single message log page with cached contacts and defaulted form data', async () => {
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
    const { messageLogger, logUtil, logPage } = await loadMessageLogger();

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
  });

  it('opens a group message log page with fax-specific defaulted form data', async () => {
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
    const { messageLogger, logUtil, groupLogPage } = await loadMessageLogger();

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

  it('creates placeholder contacts for unknown group SMS members when configured', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
        unknownContactPreference: { value: 'createNewPlaceholderContact' },
        newContactType: { value: 'Lead' },
        newContactNamePrefix: { value: 'Prefix ' },
      },
    });
    const { messageLogger, contactCore, logUtil, logCore } = await loadMessageLogger();

    contactCore.getContact
      .mockResolvedValueOnce({
        contactInfo: [{
          additionalInfo: {
            Lead: {
              category: [{ const: 'prospect', title: 'Prospect' }],
              region: 'West',
            },
          },
        }],
      })
      .mockResolvedValueOnce({
        contactInfo: [{ id: 'contact-2', type: 'Contact', name: 'Alex Green' }],
      });
    logUtil.getLogConflictInfo
      .mockResolvedValueOnce({
        hasConflict: true,
        conflictType: CONSTANTS.UNKNOWN_CONTACT_CONFLICT_TYPE,
        autoSelectAdditionalSubmission: {},
        requireManualDisposition: false,
      })
      .mockResolvedValueOnce({
        hasConflict: false,
        conflictType: 'No conflict',
        autoSelectAdditionalSubmission: { disposition: 'sms' },
        requireManualDisposition: false,
      });

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          correspondents: [
            { phoneNumber: '+16505550100', name: 'Jane' },
            { phoneNumber: '+16505550200' },
          ],
        }),
      }),
      ...context,
      platform: {
        page: {
          newContact: {
            additionalFields: [{ const: 'category' }, { const: 'region' }],
          },
        },
      },
    });

    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550100',
      newContactName: 'Prefix Jane +16505550100',
      newContactType: 'Lead',
      additionalSubmission: {
        category: 'prospect',
        region: 'West',
      },
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
      contactPhoneNumber: '+16505550100',
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-2',
      contactPhoneNumber: '+16505550200',
    }));
  });

  it('selects group SMS multiple contacts by configured preference', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
        multipleContactsPreference: { value: 'firstAlphabetical' },
      },
    });
    const { messageLogger, contactCore, logUtil, logCore } = await loadMessageLogger();

    contactCore.getContact.mockResolvedValue({
      contactInfo: [
        { id: 'z-contact', type: 'Lead', name: 'Zoe Zeta', mostRecentActivityDate: '2026-07-01T08:00:00Z' },
        { id: 'a-contact', type: 'Lead', name: 'Amy Alpha', mostRecentActivityDate: '2026-07-02T08:00:00Z' },
      ],
    });
    logUtil.getLogConflictInfo.mockResolvedValue({
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
          ],
        }),
      }),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'a-contact',
    }));

    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
        multipleContactsPreference: { value: 'mostRecentActivity' },
      },
    });
    logCore.addLog.mockClear();

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'conversation-activity',
          conversationLogId: 'conversation-log-activity',
          correspondents: [
            { phoneNumber: '+16505550300' },
            { phoneNumber: '+16505550400' },
          ],
        }),
      }),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'a-contact',
    }));
  });

  it('skips SMS auto logging when disabled and logs voicemail without conflicts', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
    });
    const { messageLogger, logCore, logUtil } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor(),
      ...context,
    });
    expect(logCore.addLog).not.toHaveBeenCalled();

    seedStorage({
      userSettings: {
        autoLogVoicemail: { value: true },
      },
    });
    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: false,
      autoSelectAdditionalSubmission: { voicemailType: 'vm' },
      requireManualDisposition: false,
    });

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'voicemail-2',
          conversationLogId: 'voicemail-log-2',
          type: 'VoiceMail',
        }),
      }),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      additionalSubmission: { voicemailType: 'vm' },
      contactId: 'contact-1',
    }));
  });

  it('warns on inbound fax conflicts and ignores fax directions without enabled auto log', async () => {
    seedStorage({
      userSettings: {
        autoLogInboundFax: { value: true },
        autoLogOutboundFax: { value: false },
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
          conversationId: 'fax-inbound',
          conversationLogId: 'fax-inbound-log',
          type: 'Fax',
          messages: [{ creationTime: '2026-07-03T08:00:00Z', direction: 'Inbound' }],
        }),
      }),
      ...context,
    });
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Fax not logged'),
    }));
    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Manual disposition might be needed'),
    }));
    expect(logCore.addLog).not.toHaveBeenCalled();

    logUtil.getLogConflictInfo.mockResolvedValueOnce({
      hasConflict: false,
      autoSelectAdditionalSubmission: { faxType: 'outbound' },
      requireManualDisposition: false,
    });
    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'fax-outbound-disabled',
          conversationLogId: 'fax-outbound-disabled-log',
          type: 'Fax',
          messages: [{ creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' }],
        }),
      }),
      ...context,
    });
    expect(logCore.addLog).not.toHaveBeenCalled();
  });

  it('submits manual existing-contact forms and grouped new-contact forms', async () => {
    seedStorage({
      userSettings: {
        openContactPageAfterCreation: { value: true },
      },
    });
    const { messageLogger, contactCore, logCore } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        redirect: false,
        formData: {
          contact: 'contact-1',
          newContactName: '',
          newContactType: '',
          contactType: 'Lead',
          contactName: 'Jane Smith',
          messageType: 'sms',
          ignoreNone: 'none',
          newCategory: 'none',
        },
      }),
      ...context,
    });
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Jane Smith',
    }));

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        redirect: true,
        formData: {
          section_0: {
            contact: 'createNewContact',
            contactName: '',
            contactType: '',
            newContactName: 'Group New',
            newContactType: 'Lead',
            contactPhoneNumber: '+16505550999',
            messageType: 'sms',
            newCategory: 'prospect',
          },
        },
      }),
      ...context,
    });
    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550999',
      newContactName: 'Group New',
      newContactType: 'Lead',
    }));
    expect(contactCore.openContactPage).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
      contactName: 'Group New',
      contactPhoneNumber: '+16505550999',
    }));
  });

  it('handles disabled group auto logging and placeholder creation without optional group data', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
    });
    const { messageLogger, contactCore, logUtil, logCore, util } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'group-disabled',
          conversationLogId: 'group-disabled-log',
          correspondents: [
            { phoneNumber: '+16505550100' },
            { phoneNumber: '+16505550200' },
          ],
        }),
      }),
      ...context,
    });

    expect(contactCore.getContact).not.toHaveBeenCalled();
    expect(logCore.addLog).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });

    seedStorage({
      userSettings: {
        autoLogSMS: { value: true },
        unknownContactPreference: { value: 'createNewPlaceholderContact' },
        newContactType: { value: 'Lead' },
        newContactNamePrefix: { value: 'Prefix ' },
      },
    });
    contactCore.getContact
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        contactInfo: [{ id: 'contact-2', type: 'Lead', name: 'Alex Green' }],
      });
    logUtil.getLogConflictInfo
      .mockResolvedValueOnce({
        hasConflict: true,
        conflictType: CONSTANTS.UNKNOWN_CONTACT_CONFLICT_TYPE,
        autoSelectAdditionalSubmission: {},
        requireManualDisposition: false,
      })
      .mockResolvedValueOnce({
        hasConflict: false,
        conflictType: 'No conflict',
        autoSelectAdditionalSubmission: { disposition: 'sms' },
        requireManualDisposition: false,
      });

    await messageLogger.onEvent({
      data: eventFor({
        conversation: conversation({
          conversationId: 'group-placeholder-defaults',
          conversationLogId: 'group-placeholder-defaults-log',
          correspondents: [
            { phoneNumber: '+16505550300' },
            { phoneNumber: '+16505550400' },
          ],
        }),
      }),
      ...context,
      platform: {},
    });

    expect(contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550300',
      newContactName: 'Prefix +16505550300',
      additionalSubmission: {},
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'new-contact',
      contactPhoneNumber: '+16505550300',
    }));
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-2',
      contactPhoneNumber: '+16505550400',
    }));
  });

  it('opens SMS and voicemail message pages with cached-contact fallbacks', async () => {
    seedStorage({
      userSettings: {
        messageAutoPopup: { value: true },
      },
      'rc-crm-search-contact-+16505550100': [
        { id: 'contact-1', type: 'Lead', name: 'Duplicate Cached' },
      ],
    });
    const { messageLogger, contactCore, logUtil, logPage } = await loadMessageLogger();

    contactCore.getContact.mockResolvedValueOnce({
      contactInfo: [{ id: 'contact-1', type: 'Lead', name: 'Jane Smith' }],
    });
    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'manual',
        redirect: true,
        conversation: conversation({
          conversationId: 'sms-open',
          conversationLogId: 'sms-open-log',
          type: 'SMS',
        }),
      }),
      ...context,
    });

    expect(logUtil.logPageFormDataDefaulting).toHaveBeenCalledWith(expect.objectContaining({
      caseType: 'message',
    }));
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      contactInfo: [expect.objectContaining({ id: 'contact-1' })],
    }));

    seedStorage({
      userSettings: {
        messageAutoPopup: { value: true },
      },
    });
    contactCore.getContact.mockResolvedValueOnce({});
    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'manual',
        redirect: true,
        conversation: conversation({
          conversationId: 'voicemail-open',
          conversationLogId: 'voicemail-open-log',
          type: 'VoiceMail',
        }),
      }),
      ...context,
    });

    expect(logPage.getLogPageRender).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'voicemail-open',
      contactInfo: [],
      useContactSearch: undefined,
    }));
    expect(logUtil.logPageFormDataDefaulting).toHaveBeenLastCalledWith(expect.objectContaining({
      caseType: 'voicemail',
      logType: 'messageLog',
    }));
  });

  it('submits manual message forms when optional field configuration is absent', async () => {
    seedStorage({
      userSettings: {},
    });
    const { messageLogger, logCore } = await loadMessageLogger();
    const minimalManifest = {
      serverUrl: 'https://server.example',
      platforms: {
        salesforce: {
          page: {},
        },
      },
    };

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        formData: {
          contact: 'contact-1',
          newContactName: 'Renamed Contact',
          newContactType: 'Lead',
          contactType: 'Contact',
          contactName: 'Jane Smith',
        },
      }),
      ...context,
      manifest: minimalManifest,
    });

    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Renamed Contact',
      additionalSubmission: {},
    }));
  });

  it('opens the log form and stores the selection instead of logging immediately', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
    });
    const { messageLogger, logCore, logPage, util } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'selectedLog',
        redirect: false,
        selectedMessageIds: ['m1', 'm3'],
        conversation: conversation({
          conversationId: 'selected-conversation',
          conversationLogId: 'selected-log',
          messages: [
            { id: 'm1', creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' },
            { id: 'm2', creationTime: '2026-07-03T08:05:00Z', direction: 'Inbound' },
            { id: 'm3', creationTime: '2026-07-03T08:10:00Z', direction: 'Outbound' },
          ],
        }),
      }),
      ...context,
      platform: { isSelectedMessageLogSupported: true },
    });

    // No CRM write on click; the contact-selection form is opened instead.
    expect(logCore.addLog).not.toHaveBeenCalled();
    // The page must be rendered with a valid render trigger type so the contact
    // field is present; 'selectedLog' is not a valid render type and would
    // otherwise produce an empty page that drops the contact on submit.
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'selected-conversation',
      logType: 'Message',
      triggerType: 'createLog',
    }));
    expect(readStorage()['rc-crm-message-selection-selected-conversation']).toEqual(['m1', 'm3']);
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/messages/selected-conversation',
        },
        targetOrigin: '*',
      },
    ]));
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('logs selected messages directly with the widget-provided contact and returns the log id', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
    });
    const { messageLogger, logCore, logPage, util } = await loadMessageLogger();
    logCore.addLog.mockResolvedValueOnce({
      successful: true,
      logId: 'crm-entry-1',
      logIds: ['crm-entry-1'],
      messageLogs: { m1: 'crm-entry-1', m3: 'crm-entry-1' },
    });

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'selectedLog',
        selectedMessageIds: ['m1', 'm3'],
        additionalSubmission: {},
        contactId: '2554',
        contactName: 'TestingWithDeepak  SushilTest',
        contactType: 'custjob',
        conversation: conversation({
          conversationId: 'selected-conversation',
          conversationLogId: 'selected-log',
          messages: [
            { id: 'm1', creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' },
            { id: 'm2', creationTime: '2026-07-03T08:05:00Z', direction: 'Inbound' },
            { id: 'm3', creationTime: '2026-07-03T08:10:00Z', direction: 'Outbound' },
          ],
        }),
      }),
      ...context,
      platform: { isSelectedMessageLogSupported: true },
    });

    // Logs directly (no form) using the same payload shape as normal manual
    // SMS logging plus the selected ids.
    expect(logPage.getLogPageRender).not.toHaveBeenCalled();
    expect(logCore.addLog).toHaveBeenCalledTimes(1);
    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      logType: 'Message',
      additionalSubmission: {},
      contactId: '2554',
      contactName: 'TestingWithDeepak  SushilTest',
      contactType: 'custjob',
      selectedMessageIds: ['m1', 'm3'],
    }));
    // Full conversation is forwarded; the server filters to the selected ids.
    expect(logCore.addLog.mock.calls[0][0].logInfo.messages.map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3']);
    // The resulting log id is returned so the widget can mark them logged.
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', {
      data: {
        logId: 'crm-entry-1',
        logIds: ['crm-entry-1'],
        messageLogs: { m1: 'crm-entry-1', m3: 'crm-entry-1' },
      },
    });
  });

  it('forwards the previously selected message ids with the full conversation when the log form is submitted', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
      'rc-crm-message-selection-selected-conversation': ['m1', 'm3'],
    });
    const { messageLogger, logCore } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'logForm',
        redirect: false,
        conversation: conversation({
          conversationId: 'selected-conversation',
          conversationLogId: 'selected-log',
          messages: [
            { id: 'm1', creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' },
            { id: 'm2', creationTime: '2026-07-03T08:05:00Z', direction: 'Inbound' },
            { id: 'm3', creationTime: '2026-07-03T08:10:00Z', direction: 'Outbound' },
          ],
        }),
        formData: {
          contact: 'contact-1',
          contactType: 'Lead',
          contactName: 'Jane Smith',
          newContactName: '',
          newContactType: '',
          messageType: 'sms',
        },
      }),
      ...context,
    });

    expect(logCore.addLog).toHaveBeenCalledTimes(1);
    const addLogArgs = logCore.addLog.mock.calls[0][0];
    // Full conversation is sent; the server filters to the selected ids.
    expect(addLogArgs.logInfo.messages.map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(addLogArgs.selectedMessageIds).toEqual(['m1', 'm3']);
    expect(addLogArgs.contactId).toBe('contact-1');
    // Selection is consumed after logging.
    expect(readStorage()['rc-crm-message-selection-selected-conversation']).toBeUndefined();
  });

  it('ignores selectedLog events when the platform does not support selected message logging', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
    });
    const { messageLogger, logCore, logPage, contactCore, util } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'selectedLog',
        selectedMessageIds: ['m1'],
        conversation: conversation({
          messages: [{ id: 'm1', creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' }],
        }),
      }),
      ...context,
      platform: {},
    });

    expect(contactCore.getContact).not.toHaveBeenCalled();
    expect(logPage.getLogPageRender).not.toHaveBeenCalled();
    expect(logCore.addLog).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('warns and skips opening the form when no messages are selected', async () => {
    seedStorage({
      userSettings: {
        autoLogSMS: { value: false },
      },
    });
    const { messageLogger, logCore, logPage, contactCore, util } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'selectedLog',
        selectedMessageIds: [],
        conversation: conversation({
          messages: [{ id: 'm1', creationTime: '2026-07-03T08:00:00Z', direction: 'Outbound' }],
        }),
      }),
      ...context,
      platform: { isSelectedMessageLogSupported: true },
    });

    expect(util.showNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: 'No messages selected to log.',
    }));
    expect(contactCore.getContact).not.toHaveBeenCalled();
    expect(logPage.getLogPageRender).not.toHaveBeenCalled();
    expect(logCore.addLog).not.toHaveBeenCalled();
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });

  it('does not open message pages when neither redirect nor auto popup is enabled', async () => {
    seedStorage({
      userSettings: {
        messageAutoPopup: { value: false },
      },
    });
    const { messageLogger, logUtil, logPage, groupLogPage, util } = await loadMessageLogger();

    await messageLogger.onEvent({
      data: eventFor({
        triggerType: 'manual',
        redirect: false,
      }),
      ...context,
    });

    expect(logUtil.cacheLogPageData).not.toHaveBeenCalled();
    expect(logPage.getLogPageRender).not.toHaveBeenCalled();
    expect(groupLogPage.getGroupLogPageRender).not.toHaveBeenCalled();
    expect(getWidgetPostMessages()).toEqual([]);
    expect(util.responseMessage).toHaveBeenCalledWith('request-1', { data: 'ok' });
  });
});
