import axios from 'axios';

type GetImplementedInterfacesOptions = {
  manifest: Record<string, any>;
  platformName: string;
};

export async function getImplementedInterfaces({
  manifest,
  platformName,
}: GetImplementedInterfacesOptions): Promise<void> {
  const response = await axios.get(`${manifest.serverUrl}/implementedInterfaces?platform=${platformName}`);
  if (response.data) {
    await chrome.storage.local.set({ implementedInterfaces: response.data });
  }
}

export default {
  getImplementedInterfaces,
};
