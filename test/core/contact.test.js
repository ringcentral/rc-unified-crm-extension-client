import axios from 'axios';
import analytics from '../../src/lib/analytics.js';
import { showNotification } from '../../src/lib/util.js';
import { getManifest } from '../../src/service/manifestService.js';
import multiContactPopPromptPage from '../../src/components/multiContactPopPromptPage.js';
import { loadModule } from '../helpers/loadModule';
import { getWidgetFrameWindow, getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/lib/analytics.js', () => ({
  default: {
    createNewContact: vi.fn(),
    contactPop: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.js', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../src/service/manifestService.js', () => ({
  getManifest: vi.fn(),
}));

vi.mock('../../src/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../../src/components/multiContactPopPromptPage.js', () => ({
  default: {
    getMultiContactPopPromptPageRender: vi.fn(() => ({ id: 'multiContactPopPromptPage' })),
  },
}));

async function loadContactCore() {
  vi.resetModules();
  return loadModule('../../src/core/contact.js');
}

function manifest() {
  return {
    serverUrl: 'https://server.example',
    platforms: {
      salesforce: {
        contactPageUrl: 'https://{hostname}/contact/{contactId}/{contactType}',
        callPopUrl: 'https://{hostname}/call-pop/{contactId}',
        enableFallbackContactPageUrl: true,
        fallbackContactPageUrl: 'https://{hostname}/search',
        page: {
          disableContactCache: true,
        },
      },
    },
  };
}

describe('contact core', () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockResolvedValue(manifest());
    vi.spyOn(window, 'open').mockImplementation(() => ({ blur: vi.fn() }));
    vi.spyOn(window, 'focus').mockImplementation(() => {});
  });

  it('reads locally cached widget contacts by phone number and platform', async () => {
    getWidgetFrameWindow().phone.contactMatcher.data = {
      '16505550100': {
        salesforce: {
          data: [
            {
              id: 'contact-1',
              name: 'Jane Doe',
              contactType: 'Lead',
              isNewContact: false,
              mostRecentActivityDate: '2026-07-01',
              additionalInfo: { owner: 'Jane' },
            },
          ],
        },
      },
    };
    const contactCore = await loadContactCore();

    expect(contactCore.getLocalCachedContact({
      phoneNumber: '16505550100',
      platformName: 'salesforce',
    })).toEqual([
      {
        id: 'contact-1',
        name: 'Jane Doe',
        type: 'Lead',
        phone: '16505550100',
        isNewContact: false,
        mostRecentActivityDate: '2026-07-01',
        additionalInfo: { owner: 'Jane' },
      },
    ]);
  });

  it('returns cached contact match without calling the server', async () => {
    getWidgetFrameWindow().phone.contactMatcher.data = {
      '16505550100': {
        salesforce: {
          data: [{ id: 'contact-1', name: 'Jane Doe', contactType: 'Lead' }],
        },
      },
    };
    const contactCore = await loadContactCore();

    await expect(contactCore.getContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550100',
      platformName: 'salesforce',
    })).resolves.toMatchObject({
      matched: true,
      contactInfo: [{ id: 'contact-1', name: 'Jane Doe', type: 'Lead' }],
    });

    expect(axios.get).not.toHaveBeenCalled();
  });

  it('fetches server contacts with overriding formats and merges cached search contacts', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      userSettings: {
        overridingPhoneNumberFormat: { value: 'format-1' },
        overridingPhoneNumberFormat2: { value: 'format-2' },
      },
      'rc-crm-search-contact-16505550100': [
        { id: 'cached-contact', name: 'Cached Contact', type: 'Lead' },
      ],
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: true,
        contact: [{ id: 'server-contact', name: 'Server Contact', type: 'Contact', isNewContact: false }],
        returnMessage: { message: 'Matched' },
      },
    });
    const contactCore = await loadContactCore();

    await expect(contactCore.getContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550100',
      platformName: 'salesforce',
      isToTriggerContactMatch: true,
    })).resolves.toMatchObject({
      matched: true,
      contactInfo: [
        { id: 'cached-contact', name: 'Cached Contact', type: 'Lead' },
        { id: 'server-contact', name: 'Server Contact', type: 'Contact', isNewContact: false },
      ],
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://server.example/contact?phoneNumber=16505550100&overridingFormat=format-1%2Cformat-2&isExtension=false&isForceRefreshAccountData=true',
    );
    expect(readStorage()['tempContactMatchTask-16505550100']).toEqual([
      { id: 'server-contact', name: 'Server Contact', type: 'Contact', isNewContact: false },
    ]);
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-contact-match',
        phoneNumbers: ['16505550100'],
      },
      targetOrigin: '*',
    });
  });

  it('returns connect-to-CRM warning when no JWT exists', async () => {
    const contactCore = await loadContactCore();

    await expect(contactCore.getContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550100',
      platformName: 'salesforce',
    })).resolves.toEqual({
      matched: false,
      returnMessage: {
        message: 'notifications.warning.connectToCrm',
        messageType: 'warning',
        ttl: 3000,
      },
      contactInfo: null,
    });
  });

  it('creates a contact, caches match task, and triggers widget rematch', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        successful: true,
        contact: {
          id: 'new-contact',
          additionalInfo: { owner: 'Jane' },
        },
        returnMessage: { message: 'Created' },
      },
    });
    const contactCore = await loadContactCore();

    await expect(contactCore.createContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550100',
      newContactName: 'Jane Doe',
      newContactType: 'Lead',
      additionalSubmission: { source: 'App Connect' },
    })).resolves.toMatchObject({
      matched: true,
      contactInfo: { id: 'new-contact' },
    });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/contact', {
      phoneNumber: '16505550100',
      newContactName: 'Jane Doe',
      newContactType: 'Lead',
      additionalSubmission: { source: 'App Connect' },
    });
    expect(analytics.createNewContact).toHaveBeenCalled();
    expect(readStorage()['tempContactMatchTask-16505550100']).toEqual([
      {
        id: 'new-contact',
        phone: '16505550100',
        name: 'Jane Doe',
        type: 'Lead',
        additionalInfo: { owner: 'Jane' },
      },
    ]);
  });

  it('opens direct contact URL from manifest templates', async () => {
    seedStorage({
      'platform-info': {
        hostname: 'crm.example',
      },
      userSettings: {},
    });
    const contactCore = await loadContactCore();

    await contactCore.openContactPage({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '16505550100',
      contactId: 'contact-1',
      contactType: 'Lead',
      fromCallPop: true,
    });

    expect(window.open).toHaveBeenCalledWith('https://crm.example/call-pop/contact-1');
    expect(showNotification).toHaveBeenCalled();
  });

  it('shows multi-contact prompt when multiple contacts are matched and prompt behavior is selected', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': {
        hostname: 'crm.example',
      },
      userSettings: {},
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: true,
        contact: [
          { id: 'contact-1', name: 'One', type: 'Lead', isNewContact: false },
          { id: 'contact-2', name: 'Two', type: 'Lead', isNewContact: false },
        ],
      },
    });
    const contactCore = await loadContactCore();

    await contactCore.openContactPage({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '16505550100',
      multiContactMatchBehavior: 'promptToSelect',
    });

    expect(multiContactPopPromptPage.getMultiContactPopPromptPageRender).toHaveBeenCalledWith({
      contactInfo: [
        { id: 'contact-1', name: 'One', type: 'Lead', isNewContact: false },
        { id: 'contact-2', name: 'Two', type: 'Lead', isNewContact: false },
      ],
    });
    expect(getWidgetPostMessages().map(({ message }) => message.type)).toEqual(expect.arrayContaining([
      'rc-adapter-register-customized-page',
      'rc-adapter-navigate-to',
      'rc-adapter-control-call',
    ]));
  });

  it('returns server no-contact messages and default no-contact fallback', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1', userSettings: {} });
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: {
          successful: false,
          contact: null,
          returnMessage: { message: 'No CRM match', messageType: 'warning', ttl: 1000 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          successful: false,
          contact: null,
        },
      });
    const contactCore = await loadContactCore();

    await expect(contactCore.getContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550100',
      platformName: 'salesforce',
      isForceRefresh: true,
      isExtensionNumber: true,
      isForceRefreshAccountData: true,
      isToTriggerContactMatch: false,
    })).resolves.toEqual({
      matched: false,
      returnMessage: { message: 'No CRM match', messageType: 'warning', ttl: 1000 },
      contactInfo: null,
    });
    await expect(contactCore.getContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550101',
      platformName: 'salesforce',
      isForceRefresh: true,
      isToTriggerContactMatch: false,
    })).resolves.toEqual({
      matched: false,
      returnMessage: {
        message: 'notifications.warning.noContactFound',
        messageType: 'warning',
        ttl: 3000,
      },
      contactInfo: null,
    });
    expect(axios.get.mock.calls[0][0]).toContain('isExtension=true&isForceRefreshAccountData=true');
  });

  it('returns connect-to-CRM warning when creating contacts without JWT', async () => {
    const contactCore = await loadContactCore();

    await expect(contactCore.createContact({
      serverUrl: 'https://server.example',
      phoneNumber: '16505550100',
      newContactName: 'Jane Doe',
      newContactType: 'Lead',
      additionalSubmission: {},
    })).resolves.toEqual({
      matched: false,
      returnMessage: {
        message: 'notifications.warning.connectToCrm',
        messageType: 'warning',
        ttl: 3000,
      },
      contactInfo: null,
    });
  });

  it('opens fallback contact page for unmatched call-pop contacts and blocks unsafe fallback URLs', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': { hostname: 'temp' },
      userSettings: {},
    });
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: 'crm.example' })
      .mockResolvedValueOnce({
        data: {
          successful: false,
          contact: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          successful: false,
          contact: null,
        },
      });
    const contactCore = await loadContactCore();

    await contactCore.openContactPage({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '16505550100',
      fromCallPop: true,
    });
    expect(window.open).toHaveBeenCalledWith('https://crm.example/search');

    await contactCore.openContactPage({
      manifest: {
        serverUrl: 'https://server.example',
        platforms: {
          salesforce: {
            contactPageUrl: 'https://{hostname}/contact/{contactId}',
            enableFallbackContactPageUrl: true,
            fallbackContactPageUrl: 'javascript:alert(1)',
          },
        },
      },
      platformName: 'salesforce',
      phoneNumber: '16505550101',
      fromCallPop: true,
    });
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it('opens all multi-matched contacts and Bullhorn ATS windows', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      'platform-info': { hostname: 'crm.example' },
      userSettings: {},
      crm_extension_bullhorn_user_urls: {
        atsUrl: 'https://ats.example',
      },
    });
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        data: {
          successful: true,
          contact: [
            { id: 'contact-1', name: 'One', type: 'Lead', isNewContact: false },
            { id: 'contact-2', name: 'Two', type: 'Contact', isNewContact: false },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          successful: true,
          contact: [
            { id: 'candidate-1', name: 'Candidate', type: 'Candidate', isNewContact: false },
          ],
        },
      });
    const contactCore = await loadContactCore();

    await contactCore.openContactPage({
      manifest: manifest(),
      platformName: 'salesforce',
      phoneNumber: '16505550100',
      multiContactMatchBehavior: 'openAllMatches',
    });
    expect(window.open).toHaveBeenCalledWith('https://crm.example/contact/contact-1/Lead');
    expect(window.open).toHaveBeenCalledWith('https://crm.example/contact/contact-2/Contact');

    await contactCore.openContactPage({
      manifest: {
        serverUrl: 'https://server.example',
        platforms: {
          bullhorn: {
            contactPageUrl: 'https://{hostname}/contact/{contactId}',
          },
        },
      },
      platformName: 'bullhorn',
      phoneNumber: '16505550200',
    });
    expect(window.open).toHaveBeenCalledWith(
      'https://ats.example/BullhornStaffing/OpenWindow.cfm?Entity=Candidate&id=candidate-1&view=Overview',
      '_blank',
      'popup',
    );
  });

  it('refreshes the multi-contact prompt page with search text', async () => {
    const contactCore = await loadContactCore();

    contactCore.refreshContactPromptPage({
      contactInfo: [{ id: 'contact-1' }],
      searchWord: 'Jane',
    });

    expect(multiContactPopPromptPage.getMultiContactPopPromptPageRender).toHaveBeenCalledWith({
      contactInfo: [{ id: 'contact-1' }],
      searchWord: 'Jane',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-navigate-to',
        path: '/customized/multiContactPopPromptPage',
      },
      targetOrigin: '*',
    });
  });
});
