import axios from 'axios';
import contactCore from '../../src/core/contact.ts';
import calldownPage from '../../src/components/calldownPage.ts';
import { getSchedulePageRender } from '../../src/components/schedulePage.ts';
import { cacheCalldownContact } from '../../src/lib/util.ts';
import { getManifest } from '../../src/service/manifestService.ts';
import { getPlatformInfo } from '../../src/service/platformService.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../../src/core/contact.ts', () => ({
  default: {
    getContact: vi.fn(),
  },
}));

vi.mock('../../src/components/calldownPage.ts', () => ({
  default: {
    getCalldownPageWithRecords: vi.fn(),
  },
}));

vi.mock('../../src/components/schedulePage.ts', () => ({
  getSchedulePageRender: vi.fn(),
}));

vi.mock('../../src/lib/util.ts', () => ({
  cacheCalldownContact: vi.fn(),
}));

vi.mock('../../src/service/manifestService.ts', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/service/platformService.ts', () => ({
  getPlatformInfo: vi.fn(),
}));

async function loadC2scheduleHandler() {
  vi.resetModules();
  return loadModule('../../src/messageHandlers/c2schedule.ts');
}

function seedScheduleStorage() {
  seedStorage({
    rcUserInfo: { rcAccountId: 'account-1' },
    userSettings: { showCalldownTab: { value: true } },
  });
}

function mockMatchedScheduleContacts() {
  vi.mocked(contactCore.getContact).mockResolvedValueOnce({
    contactInfo: [
      { id: 'contact-1', name: 'Jane Smith', type: 'Lead' },
      { id: 'new-1', name: 'New', isNewContact: true },
    ],
  });
}

function dispatchSchedulePageSubmit() {
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      type: 'rc-post-message-request',
      path: '/custom-button-click',
      requestId: 'request-1',
      body: {
        page: { id: 'c2dSchedulePage' },
        formData: {
          phone: '+16505550100',
          contact: 'contact-1',
          note: 'Call later',
          callbackDateTime: '2026-07-02T10:00:00Z',
        },
      },
    },
  }));
}

describe('c2schedule message handler', () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockReset();
    vi.mocked(contactCore.getContact).mockReset();
    vi.mocked(calldownPage.getCalldownPageWithRecords).mockReset().mockResolvedValue({ id: 'calldownPage' });
    vi.mocked(getSchedulePageRender).mockReset().mockReturnValue({ id: 'c2dSchedulePage' });
    vi.mocked(cacheCalldownContact).mockReset();
    vi.mocked(getManifest).mockReset().mockResolvedValue({
      serverUrl: 'https://server.example',
      platforms: {
        salesforce: {
          contactTypes: ['Lead', 'Contact'],
        },
      },
    });
    vi.mocked(getPlatformInfo).mockReset().mockResolvedValue({ platformName: 'salesforce' });
  });

  it('registers a schedule page with matched contact options', async () => {
    seedScheduleStorage();
    mockMatchedScheduleContacts();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const sendResponse = vi.fn();
    const handler = await loadC2scheduleHandler();

    try {
      await handler.onMessage({
        request: { phoneNumber: '+16505550100' },
        sendResponse,
      });

      expect(getSchedulePageRender).toHaveBeenCalledWith({
        phoneNumber: '+16505550100',
        listOneOf: [
          { const: 'contact-1', title: 'Jane Smith' },
          { const: 'newContact', title: 'Create new contact' },
        ],
        isDefaultNew: false,
        preselect: 'contact-1',
        contactTypes: ['Lead', 'Contact'],
      });
      expect(getWidgetPostMessages()).toContainEqual({
        message: { type: 'rc-adapter-register-customized-page', page: { id: 'c2dSchedulePage' } },
        targetOrigin: '*',
      });
      expect(getWidgetPostMessages()).toContainEqual({
        message: { type: 'rc-adapter-navigate-to', path: '/customized/c2dSchedulePage' },
        targetOrigin: '*',
      });
      expect(sendResponse).toHaveBeenCalledWith({ result: 'ok' });
    } finally {
      const messageListener = addEventListenerSpy.mock.calls.find(([type]) => type === 'message')?.[1] as EventListener | undefined;
      if (messageListener) {
        window.removeEventListener('message', messageListener);
      }
      addEventListenerSpy.mockRestore();
    }
  });

  it('submits callback details from the schedule page event', async () => {
    seedScheduleStorage();
    mockMatchedScheduleContacts();
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { id: 'callback-1' } });
    const handler = await loadC2scheduleHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550100' },
      sendResponse: vi.fn(),
    });

    dispatchSchedulePageSubmit();

    await vi.waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        'https://server.example/calldown?rcAccountId=account-1',
        {
          phoneNumber: '+16505550100',
          scheduledAt: '2026-07-02T10:00:00Z',
          contactId: 'contact-1',
          note: 'Call later',
        },
      );
    });
    expect(cacheCalldownContact).toHaveBeenCalledWith({
      contactId: 'contact-1',
      contactName: 'Jane Smith',
      phoneNumber: '+16505550100',
      contactType: 'Lead',
    });
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith({
      manifest: expect.objectContaining({ serverUrl: 'https://server.example' }),
      filterStatus: 'All',
      userSettings: { showCalldownTab: { value: true } },
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-post-message-response',
        responseId: 'request-1',
        response: { data: 'ok' },
      },
      targetOrigin: '*',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: { type: 'rc-adapter-navigate-to', path: 'goBack' },
      targetOrigin: '*',
    });
  });

  it('defaults to creating a new contact when no existing contacts match', async () => {
    seedStorage({});
    vi.mocked(getPlatformInfo).mockResolvedValueOnce(null);
    vi.mocked(contactCore.getContact).mockResolvedValueOnce({
      contactInfo: [
        { id: 'new-1', name: 'New', isNewContact: true },
      ],
    });
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const handler = await loadC2scheduleHandler();

    try {
      await handler.onMessage({
        request: { phoneNumber: '+16505550200' },
        sendResponse: vi.fn(),
      });

      expect(getSchedulePageRender).toHaveBeenCalledWith({
        phoneNumber: '+16505550200',
        listOneOf: [
          { const: 'newContact', title: 'Create new contact' },
        ],
        isDefaultNew: true,
        preselect: 'newContact',
        contactTypes: [],
      });
    } finally {
      const messageListener = addEventListenerSpy.mock.calls.find(([type]) => type === 'message')?.[1] as EventListener | undefined;
      if (messageListener) {
        window.removeEventListener('message', messageListener);
      }
      addEventListenerSpy.mockRestore();
    }
  });

  it('ignores unrelated schedule page events and skips submissions without a callback time', async () => {
    seedScheduleStorage();
    mockMatchedScheduleContacts();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const handler = await loadC2scheduleHandler();

    try {
      await handler.onMessage({
        request: { phoneNumber: '+16505550100' },
        sendResponse: vi.fn(),
      });

      window.dispatchEvent(new MessageEvent('message', { data: null }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-post-message-request',
          path: '/custom-button-click',
          requestId: 'request-other',
          body: {
            page: { id: 'otherPage' },
            formData: { callbackDateTime: '2026-07-02T10:00:00Z' },
          },
        },
      }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'rc-post-message-request',
          path: '/custom-button-click',
          requestId: 'request-missing-time',
          body: {
            page: { id: 'c2dSchedulePage' },
            formData: {
              phone: '+16505550100',
              contact: 'contact-1',
            },
          },
        },
      }));

      await vi.waitFor(() => {
        expect(getWidgetPostMessages()).toContainEqual({
          message: {
            type: 'rc-post-message-response',
            responseId: 'request-missing-time',
            response: { data: 'ok' },
          },
          targetOrigin: '*',
        });
      });
      expect(axios.post).not.toHaveBeenCalled();
      expect(cacheCalldownContact).not.toHaveBeenCalled();
      expect(calldownPage.getCalldownPageWithRecords).not.toHaveBeenCalled();
    } finally {
      const messageListener = addEventListenerSpy.mock.calls.find(([type]) => type === 'message')?.[1] as EventListener | undefined;
      if (messageListener) {
        window.removeEventListener('message', messageListener);
      }
      addEventListenerSpy.mockRestore();
    }
  });

  it('submits callbacks without account query and skips cache for new contacts', async () => {
    seedStorage({
      rcUserInfo: {},
      userSettings: {},
    });
    mockMatchedScheduleContacts();
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { id: 'callback-2' } });
    const handler = await loadC2scheduleHandler();

    await handler.onMessage({
      request: { phoneNumber: '+16505550300' },
      sendResponse: vi.fn(),
    });

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'rc-post-message-request',
        path: '/custom-button-click',
        requestId: 'request-new-contact',
        body: {
          page: { id: 'c2dSchedulePage' },
          formData: {
            phone: '+16505550300',
            contact: 'newContact',
            note: '',
            callbackDateTime: '2026-07-03T10:00:00Z',
          },
        },
      },
    }));

    await vi.waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        'https://server.example/calldown',
        {
          phoneNumber: '+16505550300',
          scheduledAt: '2026-07-03T10:00:00Z',
          contactId: 'newContact',
          note: '',
        },
      );
    });
    expect(cacheCalldownContact).not.toHaveBeenCalled();
    expect(calldownPage.getCalldownPageWithRecords).toHaveBeenCalledWith({
      manifest: expect.objectContaining({ serverUrl: 'https://server.example' }),
      filterStatus: 'All',
      userSettings: {},
    });
  });
});
