import axios from 'axios';
import { showNotification } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(),
}));

async function loadCustomContactSearch() {
  vi.resetModules();
  return loadModule('../../src/core/customContactSearch.ts');
}

describe('customContactSearch', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(showNotification).mockReset();
  });

  it('builds the custom contact search page with form data', async () => {
    const customContactSearch = await loadCustomContactSearch();

    expect(customContactSearch.getCustomContactSearch({
      contactSearchAdapterButton: 'searchButton',
      contactPhoneNumber: '16505550100',
      appointment: true,
      formData: { appointmentId: 'appt-1' },
    })).toMatchObject({
      id: 'searchContact',
      schema: {
        properties: {
          contactNameToSearch: { type: 'string' },
          searchButton: { type: 'string' },
        },
      },
      formData: {
        contactPhoneNumber: '16505550100',
        appointment: true,
        appointmentId: 'appt-1',
      },
    });
  });

  it('notifies user when custom contact search returns no contacts', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        contact: [],
        returnMessage: {
          messageType: 'warning',
          message: 'No contacts',
          ttl: 3000,
        },
      },
    });
    const customContactSearch = await loadCustomContactSearch();

    await expect(customContactSearch.getCustomContactSearchData({
      serverUrl: 'https://server.example',
      contactSearch: 'Jane',
      pageId: 'resultPage',
    })).resolves.toBeUndefined();

    expect(axios.get).toHaveBeenCalledWith('https://server.example/custom/contact/search', {
      params: {
        jwtToken: 'jwt-1',
        name: 'Jane',
      },
    });
    expect(showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'No contacts',
      ttl: 3000,
    });
  });

  it('returns appointment contact list with contacts without email disabled by default', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        contact: [
          { id: 'c1', name: 'Has Email', type: 'Lead', email: 'person@example.test' },
          { id: 'c2', name: 'No Email', type: 'Lead' },
        ],
      },
    });
    const customContactSearch = await loadCustomContactSearch();

    await expect(customContactSearch.getCustomContactSearchData({
      serverUrl: 'https://server.example',
      contactSearch: 'Jane',
      pageId: 'resultPage',
      contactPhoneNumber: '16505550100',
      appointment: true,
    })).resolves.toMatchObject({
      id: 'resultPage',
      schema: {
        properties: {
          appointmentContactEmailWarning: expect.any(Object),
          contactList: {
            type: 'array',
            items: {
              enum: ['c1', 'c2'],
              enumNames: ['Has Email', 'No Email'],
              enumDisabled: ['c2'],
            },
          },
        },
      },
      uiSchema: {
        contactList: {
          'ui:widget': 'checkboxes',
          'ui:enumDisabled': ['c2'],
        },
      },
      formData: {
        search: 'Jane',
        contactPhoneNumber: '16505550100',
        contactInfo: [
          { id: 'c1', name: 'Has Email', type: 'Lead', email: 'person@example.test' },
          { id: 'c2', name: 'No Email', type: 'Lead' },
        ],
      },
    });
  });
});
