// @ts-nocheck
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

function manifest() {
  return {
    serverUrl: 'https://server.example',
  };
}

function context() {
  return {
    manifest: manifest(),
    platformInfo: {
      platformName: 'salesforce',
    },
    platformName: 'salesforce',
    platform: {
      name: 'salesforce',
    },
  };
}

function searchButtonData(pageId = 'search-1') {
  return {
    body: {
      button: {
        formData: {
          contactNameToSearch: 'Jane',
          contactPhoneNumber: '+16505550100',
        },
      },
    },
    requestId: pageId,
  };
}

function selectedContactData() {
  return {
    body: {
      keys: ['contactList'],
      page: {
        formData: {
          contactInfo: [
            {
              id: 'contact-2',
              type: 'Lead',
              name: 'Jane Lead',
              isNewContact: true,
            },
          ],
        },
      },
      formData: {
        contactList: 'contact-2',
        contactPhoneNumber: '+16505550100',
      },
    },
  };
}

async function loadSearchButtonHandler(modulePath) {
  vi.resetModules();
  const contactSearch = {
    getCustomContactSearchData: vi.fn(async ({ pageId }) => ({ id: pageId })),
  };
  vi.doMock('../../src/core/customContactSearch.ts', () => ({ default: contactSearch }));
  const handler = await loadModule(modulePath);
  return {
    handler,
    contactSearch,
  };
}

async function loadSearchResultHandler(modulePath) {
  vi.resetModules();
  const logPage = {
    getLogPageRender: vi.fn(() => ({
      id: 'initialLogPage',
      formData: {
        note: 'draft',
      },
    })),
    getUpdatedLogPageRender: vi.fn(() => ({ id: 'updatedLogPage' })),
  };
  vi.doMock('../../src/components/logPage.ts', () => ({ default: logPage }));
  const handler = await loadModule(modulePath);
  return {
    handler,
    logPage,
  };
}

describe('contact search custom-button and selection handlers', () => {
  beforeEach(() => {
    seedStorage({
      cacheLogPageData: {
        id: 'session-1',
        logType: 'Call',
        triggerType: 'createLog',
        contactInfo: [
          {
            id: 'contact-1',
            type: 'Contact',
            name: 'Existing Contact',
          },
        ],
      },
    });
  });

  it('opens call-log and message-log contact search result pages', async () => {
    let loaded = await loadSearchButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonCallLog.ts',
    );

    await loaded.handler.onEvent({
      data: searchButtonData(),
      ...context(),
    });

    expect(loaded.contactSearch.getCustomContactSearchData).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: { name: 'salesforce' },
      contactSearch: 'Jane',
      pageId: 'contactSearchResultCallLog',
      contactPhoneNumber: '+16505550100',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'contactSearchResultCallLog' },
        },
        targetOrigin: undefined,
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/contactSearchResultCallLog',
        },
        targetOrigin: '*',
      },
    ]));

    loaded = await loadSearchButtonHandler(
      '../../src/eventHandlers/rc-post-message-request/custom-button-click/contactSearch/contactSearchAdapterButtonMessageLog.ts',
    );
    await loaded.handler.onEvent({
      data: searchButtonData(),
      ...context(),
    });

    expect(loaded.contactSearch.getCustomContactSearchData).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      platform: { name: 'salesforce' },
      contactSearch: 'Jane',
      pageId: 'contactSearchResultMessageLog',
      contactPhoneNumber: '+16505550100',
    });
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-register-customized-page',
          page: { id: 'contactSearchResultMessageLog' },
        },
        targetOrigin: undefined,
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/contactSearchResultMessageLog',
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('writes a selected search contact back to the cached call-log page', async () => {
    const { handler, logPage } = await loadSearchResultHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultCallLog.ts',
    );

    await handler.onEvent({
      data: selectedContactData(),
      ...context(),
    });

    expect(readStorage()['rc-crm-search-contact-+16505550100']).toEqual([
      {
        id: 'contact-2',
        type: 'Lead',
        name: 'Jane Lead',
      },
    ]);
    expect(logPage.getLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-1',
      contactInfo: [
        expect.objectContaining({ id: 'contact-1' }),
        {
          id: 'contact-2',
          type: 'Lead',
          name: 'Jane Lead',
          isNewContact: undefined,
        },
      ],
    }));
    expect(logPage.getUpdatedLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      logType: 'Call',
      updateData: expect.objectContaining({
        formData: expect.objectContaining({
          contact: 'contact-2',
          contactType: 'Lead',
          contactName: 'Jane Lead',
          returnToHistoryPage: true,
        }),
      }),
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-update-call-log-page',
          page: { id: 'updatedLogPage' },
        },
        targetOrigin: undefined,
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/call/session-1',
        },
        targetOrigin: '*',
      },
    ]));
  });

  it('writes a selected search contact back to the cached message-log page', async () => {
    seedStorage({
      cacheLogPageData: {
        id: 'message-1',
        logType: 'Message',
        triggerType: 'manual',
        contactInfo: [
          {
            id: 'contact-1',
            type: 'Contact',
            name: 'Existing Contact',
          },
        ],
      },
    });
    const { handler, logPage } = await loadSearchResultHandler(
      '../../src/eventHandlers/rc-post-message-request/customizedPage/inputChanged/pages/contactSearchResultMessageLog.ts',
    );

    await handler.onEvent({
      data: selectedContactData(),
      ...context(),
    });

    expect(readStorage()['rc-crm-search-contact-+16505550100']).toEqual([
      {
        id: 'contact-2',
        type: 'Lead',
        name: 'Jane Lead',
      },
    ]);
    expect(logPage.getUpdatedLogPageRender).toHaveBeenCalledWith(expect.objectContaining({
      updateData: expect.objectContaining({
        formData: expect.objectContaining({
          contact: 'contact-2',
          contactType: 'Lead',
          contactName: 'Jane Lead',
        }),
      }),
    }));
    expect(getWidgetPostMessages()).toEqual(expect.arrayContaining([
      {
        message: {
          type: 'rc-adapter-update-messages-log-page',
          page: { id: 'updatedLogPage' },
        },
        targetOrigin: undefined,
      },
      {
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/messages/message-1',
        },
        targetOrigin: '*',
      },
    ]));
  });
});
