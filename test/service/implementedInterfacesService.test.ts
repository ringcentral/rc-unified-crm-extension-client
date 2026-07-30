import axios from 'axios';
import { getImplementedInterfaces } from '../../src/service/implementedInterfacesService';
import { readStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('implementedInterfacesService', () => {
  it('fetches and stores the implemented interfaces for the selected platform', async () => {
    const implementedInterfaces = ['contact', 'activity'];
    vi.mocked(axios.get).mockResolvedValue({ data: implementedInterfaces });

    await getImplementedInterfaces({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://server.example/implementedInterfaces?platform=salesforce',
    );
    expect(readStorage().implementedInterfaces).toEqual(implementedInterfaces);
  });

  it('does not overwrite storage when the response has no data', async () => {
    await chrome.storage.local.set({ implementedInterfaces: ['existing'] });
    vi.mocked(axios.get).mockResolvedValue({ data: null });

    await getImplementedInterfaces({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
    });

    expect(readStorage().implementedInterfaces).toEqual(['existing']);
  });
});
