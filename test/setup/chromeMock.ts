// @ts-nocheck
import { vi } from 'vitest';

const storageData = {};
const storageListeners = new Set();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getStorageResult(keys) {
  if (keys == null) {
    return clone(storageData);
  }
  if (typeof keys === 'string') {
    return Object.prototype.hasOwnProperty.call(storageData, keys)
      ? { [keys]: clone(storageData[keys]) }
      : {};
  }
  if (Array.isArray(keys)) {
    return keys.reduce((result, key) => {
      if (Object.prototype.hasOwnProperty.call(storageData, key)) {
        result[key] = clone(storageData[key]);
      }
      return result;
    }, {});
  }
  if (typeof keys === 'object') {
    return Object.keys(keys).reduce((result, key) => {
      result[key] = Object.prototype.hasOwnProperty.call(storageData, key)
        ? clone(storageData[key])
        : clone(keys[key]);
      return result;
    }, {});
  }
  return {};
}

function emitStorageChanges(changes) {
  if (Object.keys(changes).length === 0) {
    return;
  }
  for (const listener of storageListeners) {
    listener(changes, 'local');
  }
}

export const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys) => getStorageResult(keys)),
      set: vi.fn(async (items) => {
        const changes = {};
        for (const [key, value] of Object.entries(items || {})) {
          changes[key] = {
            oldValue: clone(storageData[key]),
            newValue: clone(value),
          };
          storageData[key] = clone(value);
        }
        emitStorageChanges(changes);
      }),
      remove: vi.fn(async (keys) => {
        const list = Array.isArray(keys) ? keys : [keys];
        const changes = {};
        for (const key of list) {
          if (Object.prototype.hasOwnProperty.call(storageData, key)) {
            changes[key] = {
              oldValue: clone(storageData[key]),
              newValue: undefined,
            };
          }
          delete storageData[key];
        }
        emitStorageChanges(changes);
      }),
      clear: vi.fn(async () => {
        const keys = Object.keys(storageData);
        await chromeMock.storage.local.remove(keys);
      }),
    },
    onChanged: {
      addListener: vi.fn((listener) => storageListeners.add(listener)),
      removeListener: vi.fn((listener) => storageListeners.delete(listener)),
      hasListener: vi.fn((listener) => storageListeners.has(listener)),
    },
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test-extension/${path}`),
    sendMessage: vi.fn(async () => ({ result: 'ok' })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onMessageExternal: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  windows: {
    create: vi.fn(async (options) => ({ id: 1, ...options })),
    get: vi.fn(async (id) => ({ id, focused: true, state: 'normal', width: 450, height: 848 })),
    update: vi.fn(async (id, updateInfo) => ({ id, ...updateInfo })),
    remove: vi.fn(async () => {}),
    onFocusChanged: {
      addListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
    },
    onBoundsChanged: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => ({ result: 'ok' })),
    onUpdated: {
      addListener: vi.fn(),
    },
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn((id, options, callback) => {
      callback?.(id);
      return Promise.resolve(id);
    }),
    clear: vi.fn((id, callback) => {
      callback?.(true);
      return Promise.resolve(true);
    }),
    getAll: vi.fn((callback) => {
      callback?.({});
      return Promise.resolve({});
    }),
    onClicked: {
      addListener: vi.fn(),
    },
    onButtonClicked: {
      addListener: vi.fn(),
    },
  },
};

export function installChromeMock() {
  globalThis.chrome = chromeMock;
  return chromeMock;
}

export function resetChromeMock() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key];
  }
  storageListeners.clear();
  vi.mocked(chromeMock.storage.local.get).mockClear();
  vi.mocked(chromeMock.storage.local.set).mockClear();
  vi.mocked(chromeMock.storage.local.remove).mockClear();
  vi.mocked(chromeMock.storage.local.clear).mockClear();
  vi.mocked(chromeMock.storage.onChanged.addListener).mockClear();
  vi.mocked(chromeMock.storage.onChanged.removeListener).mockClear();
  vi.mocked(chromeMock.storage.onChanged.hasListener).mockClear();
  vi.mocked(chromeMock.runtime.getURL).mockClear();
  vi.mocked(chromeMock.runtime.sendMessage).mockClear();
  vi.mocked(chromeMock.runtime.onMessage.addListener).mockClear();
  vi.mocked(chromeMock.runtime.onMessageExternal.addListener).mockClear();
  vi.mocked(chromeMock.action.onClicked.addListener).mockClear();
  vi.mocked(chromeMock.windows.create).mockClear();
  vi.mocked(chromeMock.windows.get).mockClear();
  vi.mocked(chromeMock.windows.update).mockClear();
  vi.mocked(chromeMock.windows.remove).mockClear();
  vi.mocked(chromeMock.tabs.query).mockClear();
  vi.mocked(chromeMock.tabs.sendMessage).mockClear();
  vi.mocked(chromeMock.alarms.create).mockClear();
  vi.mocked(chromeMock.notifications.create).mockClear();
  vi.mocked(chromeMock.notifications.clear).mockClear();
  vi.mocked(chromeMock.notifications.getAll).mockClear();
}

export function setChromeStorage(items) {
  for (const [key, value] of Object.entries(items || {})) {
    storageData[key] = clone(value);
  }
}

export function getChromeStorageSnapshot() {
  return clone(storageData);
}
