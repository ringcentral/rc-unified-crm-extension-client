// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { chromeMock } from '../setup/chromeMock';
import { getWidgetFrameWindow, getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

describe('test harness', () => {
  it('mocks chrome storage get/set/remove forms', async () => {
    await chrome.storage.local.set({ alpha: 1, beta: { nested: true } });

    await expect(chrome.storage.local.get('alpha')).resolves.toEqual({ alpha: 1 });
    await expect(chrome.storage.local.get(['alpha', 'missing'])).resolves.toEqual({ alpha: 1 });
    await expect(chrome.storage.local.get({ alpha: 0, missing: 'fallback' })).resolves.toEqual({
      alpha: 1,
      missing: 'fallback',
    });

    await chrome.storage.local.remove('alpha');

    expect(readStorage()).toEqual({ beta: { nested: true } });
  });

  it('lets tests seed storage directly', async () => {
    seedStorage({ platform: 'test' });

    await expect(chrome.storage.local.get(null)).resolves.toEqual({ platform: 'test' });
  });

  it('records widget frame postMessage calls', () => {
    const frameWindow = getWidgetFrameWindow();

    frameWindow.postMessage({ type: 'example' }, '*');

    expect(getWidgetPostMessages()).toEqual([
      {
        message: { type: 'example' },
        targetOrigin: '*',
      },
    ]);
  });

  it('provides runtime and window message spies', async () => {
    await chrome.runtime.sendMessage({ type: 'ping' });
    window.postMessage({ type: 'pong' }, '*');

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'ping' });
    expect(window.postMessage).toHaveBeenCalledWith({ type: 'pong' }, '*');
    expect(vi.isMockFunction(window.postMessage)).toBe(true);
  });
});
