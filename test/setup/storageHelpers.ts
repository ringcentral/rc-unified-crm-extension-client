import { getChromeStorageSnapshot, setChromeStorage } from './chromeMock';

export function seedStorage(items) {
  setChromeStorage(items);
}

export function readStorage() {
  return getChromeStorageSnapshot();
}
