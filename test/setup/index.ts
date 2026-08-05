import { afterEach, beforeEach, vi } from 'vitest';
import { installChromeMock, resetChromeMock } from './chromeMock';
import { resetWidgetFrameMock } from './widgetFrameMock';

installChromeMock();

beforeEach(() => {
  globalThis.exports = {};
  resetChromeMock();
  resetWidgetFrameMock();
  vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  (globalThis as typeof globalThis & { RCAdapter: typeof RCAdapter }).RCAdapter = {
    alertMessage: vi.fn(async () => 'notification-id'),
    dismissAlertMessage: vi.fn(),
    refreshLoginSession: vi.fn(async () => {}),
    setAutoLog: vi.fn(),
    getUnloggedCalls: vi.fn(async () => ({ calls: [], hasMore: false })),
    getCallLog: vi.fn(async () => null),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});
