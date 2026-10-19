function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.get(String(key)) ?? null;
    },
    key(index: number): string | null {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(String(key));
    },
    setItem(key: string, value: string): void {
      entries.set(String(key), String(value));
    },
  } as Storage;
}

// Node 26 owns a global localStorage/sessionStorage accessor that resolves to undefined unless the
// process gets --localstorage-file. Because the property already exists, jsdom never installs its
// own Storage, so extension code reading bare localStorage throws. Fill the gap when it is missing.
export function installDomStorageMock(): void {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    if (globalThis[key] !== undefined) {
      continue;
    }
    Object.defineProperty(globalThis, key, {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
