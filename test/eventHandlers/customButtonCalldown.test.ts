import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        contactTypes: [{ value: 'Lead', display: 'Lead' }],
      },
    },
  };
}

function dataFor(formData = {}, additionalInfo = {}) {
  return {
    requestId: 'request-1',
    body: {
      button: {
        formData,
        additionalInfo,
      },
      page: {
        formData: {
          searchWithFilters: { search: 'Jane', filter: 'Open' },
        },
      },
    },
  };
}

async function loadCalldownHandler(modulePath, overrides = {}) {
  vi.resetModules();
  vi.mocked(axios.post).mockReset().mockResolvedValue({ data: { ok: true } });
  vi.mocked(axios.patch).mockReset().mockResolvedValue({ data: { ok: true } });
  vi.mocked(axios.delete).mockReset().mockResolvedValue({ data: { ok: true } });

  const util = {
    showNotification: vi.fn(),
    responseMessage: vi.fn(),
    cacheCalldownContact: vi.fn(async () => {}),
    ...overrides.util,
  };
  vi.doMock('../../src/lib/util.ts', () => util);

  const contactCore = {
    getContact: vi.fn(async () => ({
      matched: true,
      contactInfo: [
        { id: 'contact-1', type: 'Lead', name: 'Jane Lead' },
        { id: 'new-contact', isNewContact: true, type: 'Lead', name: 'Create new' },
      ],
    })),
    openContactPage: vi.fn(async () => {}),
    createContact: vi.fn(async () => ({
      contactInfo: { id: 'created-contact', type: 'Lead', name: 'Created Contact' },
    })),
    ...overrides.contactCore,
  };
  vi.doMock('../../src/core/contact.ts', () => ({ default: contactCore }));

  const calldownPage = {
    getCalldownPageWithRecords: vi.fn(async (props) => ({ id: 'calldownPage', props })),
    ...overrides.calldownPage,
  };
  vi.doMock('../../src/components/calldownPage.ts', () => ({ default: calldownPage }));

  const schedulePage = {
    getSchedulePageRender: vi.fn((props) => ({
      id: 'schedulePage',
      title: 'Schedule call',
      schema: { properties: { scheduleSubmit: { title: 'Submit' } } },
      formData: {},
      props,
    })),
  };
  vi.doMock('../../src/components/schedulePage.ts', () => schedulePage);

  const logCore = {
    cacheCallNote: vi.fn(async () => {}),
  };
  vi.doMock('../../src/core/log.ts', () => ({ default: logCore }));

  const handler = await loadModule(modulePath);
  return {
    handler,
    util,
    contactCore,
    calldownPage,
    schedulePage,
    logCore,
  };
}

describe('custom-button calldown handlers', () => {
  beforeEach(() => {
    seedStorage({
      rcUserInfo: { rcAccountId: 'account-1' },
      userSettings: {},
      calldownListCache: [
        {
          id: 'record-1',
          phoneNumber: '+16505550100',
          contactId: 'contact-1',
          contactType: 'Lead',
          contactName: 'Jane Lead',
          scheduledAt: '2026-07-04T10:30:00Z',
        },
      ],
    });
  });

  it('opens calldown contacts from cached row contact metadata', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionOpen.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformName: 'salesforce',
      listButtonItemId: 'record-1',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      contactId: 'contact-1',
      contactType: 'Lead',
    });
  });

  it('opens calldown fallback contact metadata when phone matching misses', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionOpen.ts',
      {
        contactCore: {
          getContact: vi.fn(async () => ({ matched: false, contactInfo: [] })),
          openContactPage: vi.fn(async () => {}),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({}, {
        contactId: 'fallback-contact',
        contactType: 'Account',
        phoneNumber: '+16505550200',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      contactId: 'fallback-contact',
      contactType: 'Account',
    });
  });

  it('opens the matched calldown contact for a phone number', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionOpen.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({}, {
        phoneNumber: '+16505550300',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      contactId: 'contact-1',
      contactType: 'Lead',
    });
  });

  it('falls back to phone lookup when the matched calldown contact is only a new-contact placeholder', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionOpen.ts',
      {
        contactCore: {
          getContact: vi.fn(async () => ({
            matched: true,
            contactInfo: [
              { id: 'new-contact', isNewContact: true, type: 'Lead', name: 'Create new' },
            ],
          })),
          openContactPage: vi.fn(async () => {}),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({}, {
        phoneNumber: '+16505550400',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.openContactPage).toHaveBeenCalledWith({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '+16505550400',
      multiContactMatchBehavior: 'disabled',
    });
  });

  it('opens the schedule edit page with resolved contacts and existing record data', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionEdit.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformName: 'salesforce',
      listButtonItemId: 'record-1',
    });

    expect(loaded.schedulePage.getSchedulePageRender).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550100',
      preselect: 'contact-1',
      isDefaultNew: false,
      listOneOf: [
        { const: 'contact-1', title: 'Jane Lead' },
        { const: 'newContact', title: 'Create new contact' },
      ],
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/schedulePage',
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('turns off log modal loading when a calldown edit record is missing', async () => {
    const missing = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionEdit.ts',
    );

    await missing.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      platformName: 'salesforce',
      listButtonItemId: 'missing-record',
    });
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'rc-log-modal-loading-off' }, '*');
  });

  it('places a calldown call and marks the record called', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionCall.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      listButtonItemId: 'record-1',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-call',
        phoneNumber: '+16505550100',
        toCall: true,
      },
      targetOrigin: '*',
    });
    expect(axios.patch).toHaveBeenCalledWith('https://server.example/calldown/record-1?rcAccountId=account-1', expect.objectContaining({
      status: 'called',
    }));
  });

  it('starts a calldown SMS conversation from the selected row', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionText.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor(),
      manifest: manifest(),
      listButtonItemId: 'contact-1',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-new-sms',
        phoneNumber: '+16505550100',
        conversation: true,
      },
        targetOrigin: '*',
      });
  });

  it('marks a calldown record complete from the selected row', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionComplete.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ searchWithFilters: { search: 'Jane', filter: 'Open' } }),
      manifest: manifest(),
      listButtonItemId: 'record-1',
    });
    expect(axios.patch).toHaveBeenCalledWith('https://server.example/calldown/record-1?rcAccountId=account-1', expect.objectContaining({
      status: 'called',
    }));
  });

  it('removes a calldown record from the selected row', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/calldownActionRemove.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ searchWithFilters: { search: 'Jane', filter: 'Open' } }),
      manifest: manifest(),
      listButtonItemId: 'record-1',
    });
    expect(axios.delete).toHaveBeenCalledWith('https://server.example/calldown/record-1');
  });

  it('saves temporary call notes by session ID', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/saveTempNoteButton.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({ sessionId: 'session-1', note: 'Call later' }),
      manifest: manifest(),
    });
    expect(loaded.logCore.cacheCallNote).toHaveBeenCalledWith({
      sessionId: 'session-1',
      note: 'Call later',
    });
  });

  it('creates a new CRM contact before scheduling a calldown record', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/scheduleSubmit.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        phone: '+16505550100',
        callbackDateTime: '2026-07-04T10:30:00',
        note: 'Call back',
        contact: 'newContact',
        newContactName: 'New Lead',
        newContactType: 'Lead',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.contactCore.createContact).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+16505550100',
      newContactName: 'New Lead',
      newContactType: 'Lead',
    }));
    expect(axios.post).toHaveBeenCalledWith('https://server.example/calldown?rcAccountId=account-1', {
      phoneNumber: '+16505550100',
      scheduledAt: '2026-07-04T10:30:00',
      contactId: 'created-contact',
      contactType: 'Lead',
      note: 'Call back',
    });
    expect(loaded.util.cacheCalldownContact).toHaveBeenCalledWith({
      contactId: 'created-contact',
      contactName: 'New Lead',
      phoneNumber: '+16505550100',
      contactType: 'Lead',
    });
  });

  it('updates an existing calldown record for a selected contact', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/scheduleSubmit.ts',
    );

    await loaded.handler.onEvent({
      data: dataFor({
        phone: '+16505550100',
        callbackDateTime: '2026-07-04T10:30:00',
        note: 'Updated call back',
        contact: 'contact-1',
        editingRecordId: 'record-1',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(axios.patch).toHaveBeenCalledWith('https://server.example/calldown/record-1?rcAccountId=account-1', {
      phoneNumber: '+16505550100',
      scheduledAt: '2026-07-04T10:30:00',
      contactId: 'contact-1',
      contactType: 'Lead',
      note: 'Updated call back',
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Schedule updated successfully',
      ttl: 3000,
    });
  });

  it('warns and skips scheduling when new-contact creation fails', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/scheduleSubmit.ts',
      {
        contactCore: {
          createContact: vi.fn(async () => ({ contactInfo: {} })),
        },
      },
    );

    await loaded.handler.onEvent({
      data: dataFor({
        phone: '+16505550100',
        callbackDateTime: '2026-07-04T10:30:00',
        contact: 'newContact',
        newContactName: 'Broken Contact',
      }),
      manifest: manifest(),
      platformName: 'salesforce',
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Contact creation failed',
      ttl: 3000,
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('warns when scheduling an inbound call from an extension number', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLater.ts',
    );

    await loaded.handler.onEvent({
      data: {
        requestId: 'request-1',
        body: {
          resource: {
            direction: 'Inbound',
            from: { extensionNumber: '101' },
          },
        },
      },
      manifest: manifest(),
    });
    expect(loaded.util.showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Extension numbers cannot be scheduled',
      ttl: 3000,
    });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'c2schedule',
    }));
  });

  it('starts a schedule flow from an outbound call phone number', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLater.ts',
    );

    await loaded.handler.onEvent({
      data: {
        requestId: 'request-1',
        body: {
          resource: {
            direction: 'Outbound',
            to: { phoneNumber: '+16505550100' },
          },
        },
      },
      manifest: manifest(),
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'c2schedule',
      phoneNumber: '+16505550100',
    });
  });

  it('starts a schedule flow from the direct number on a contact', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInContact.ts',
    );

    await loaded.handler.onEvent({
      data: {
        body: {
          resource: {
            phoneType: 'extension',
            phoneNumbers: [
              { phoneType: 'extension', phoneNumber: '101' },
              { phoneType: 'direct', phoneNumber: '+16505550200' },
            ],
          },
        },
      },
      manifest: manifest(),
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'c2schedule',
      phoneNumber: '+16505550200',
    });
  });

  it('starts a schedule flow from an outbound message phone number', async () => {
    const loaded = await loadCalldownHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/calldown/callLaterInMessage.ts',
    );

    await loaded.handler.onEvent({
      data: {
        body: {
          resource: {
            direction: 'Outbound',
            to: [{ phoneNumber: '+16505550300' }],
          },
        },
      },
      manifest: manifest(),
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'c2schedule',
      phoneNumber: '+16505550300',
    });
  });
});
