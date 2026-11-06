import axios from 'axios';
import { getContactWidgets } from '../../src/service/contactWidgetService';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('contactWidgetService', () => {
  const contacts = [{ id: 'c1', name: 'Jane' }];

  beforeEach(() => {
    vi.mocked(axios.post).mockReset();
  });

  it('posts the phone number and matched contacts with the user JWT and returns the widgets', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    const widgets = [{ contactId: 'c1', widget: { schema: { type: 'object', properties: {} } } }];
    vi.mocked(axios.post).mockResolvedValue({ data: { successful: true, widgets } });

    const result = await getContactWidgets({ serverUrl: 'https://server.example', phoneNumber: '+1650', contacts });

    expect(axios.post).toHaveBeenCalledWith(
      'https://server.example/contact/widget',
      { phoneNumber: '+1650', contacts },
      { headers: { Authorization: 'Bearer jwt-1' } },
    );
    expect(result).toEqual({ successful: true, returnMessage: null, widgets });
  });

  it('sends no auth header without a JWT and defaults a missing response body', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: undefined });
    vi.mocked(axios.post).mockResolvedValue({ data: undefined });

    const result = await getContactWidgets({ serverUrl: 'https://server.example', phoneNumber: '+1650', contacts });

    expect(vi.mocked(axios.post).mock.calls[0][2]).toBeUndefined();
    expect(result).toEqual({ successful: false, returnMessage: null, widgets: [] });
  });

  it('returns the connector message when the request was not successful', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { successful: false, returnMessage: { message: 'Session expired' }, widgets: [] } });

    const result = await getContactWidgets({ serverUrl: 'https://server.example', phoneNumber: '+1650', contacts });

    expect(result).toEqual({ successful: false, returnMessage: { message: 'Session expired' }, widgets: [] });
  });
});
