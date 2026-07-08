import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';
import { chromeMock } from '../setup/chromeMock';

const openDB = vi.fn();

vi.mock('idb', () => ({
  openDB,
}));

vi.mock('../../src/i18n/index.ts', () => ({
  t: vi.fn((key) => key),
}));

async function loadUtil() {
  vi.resetModules();
  return loadModule('../../src/lib/util.ts');
}

describe('util', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  it('formats durations and detects plain empty objects', async () => {
    const util = await loadUtil();

    expect(util.secondsToHourMinuteSecondString(3661)).toBe('1h1m1s');
    expect(util.secondsToHourMinuteSecondString(59)).toBe('0h0m59s');
    expect(util.isObjectEmpty({})).toBe(true);
    expect(util.isObjectEmpty({ value: true })).toBe(false);
  });

  it('shows, suppresses, and dismisses adapter notifications', async () => {
    const util = await loadUtil();
    RCAdapter.dismissMessage = vi.fn(async () => {});

    await expect(util.showNotification({ level: 'success', message: 'Saved', ttl: 1000 })).resolves.toBe('notification-id');
    expect(RCAdapter.alertMessage).toHaveBeenCalledWith({
      level: 'success',
      message: 'Saved',
      ttl: 1000,
      details: null,
    });

    seedStorage({ notificationLevelSetting: ['error'] });
    await util.showNotification({ level: 'success', message: 'Hidden', ttl: 1000 });
    expect(RCAdapter.alertMessage).toHaveBeenCalledTimes(1);

    await util.showNotification({ message: '', ttl: 1000 });
    expect(RCAdapter.alertMessage).toHaveBeenCalledTimes(1);

    await util.dismissNotification({ notificationId: 'notification-id' });
    expect(RCAdapter.dismissMessage).toHaveBeenCalledWith('notification-id');
    await util.dismissNotification({});
    expect(RCAdapter.dismissMessage).toHaveBeenCalledTimes(1);
  });

  it('posts widget responses and reads RingCentral storage values', async () => {
    const util = await loadUtil();
    localStorage.setItem('sdk-rc-widgetplatform', JSON.stringify({
      owner_id: 'ext-1',
      access_token: 'token-1',
    }));
    seedStorage({
      rcUserInfo: {
        rcExtensionId: 'hashed-ext-1',
      },
    });
    openDB.mockResolvedValue({
      get: vi.fn(async (_store, key) => {
        if (key === 'dataFetcherV2-storageData') {
          return {
            value: {
              cachedData: {
                extensionInfo: {
                  extensionNumber: '101',
                },
              },
            },
          };
        }
        return {
          value: [{ id: 'company-contact-1' }],
        };
      }),
    });

    util.responseMessage('request-1', { data: 'ok' });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-post-message-response',
        responseId: 'request-1',
        response: { data: 'ok' },
      },
      targetOrigin: '*',
    });
    await expect(util.getRcInfo()).resolves.toEqual(expect.objectContaining({
      value: expect.objectContaining({
        cachedData: expect.any(Object),
      }),
    }));
    await expect(util.getRcContactInfo()).resolves.toEqual([{ id: 'company-contact-1' }]);
    expect(util.getRcAccessToken()).toBe('token-1');
    expect(util.getRcAccessTokenHeaderConfig({
      headers: { Authorization: 'Bearer jwt-1' },
      params: { platform: 'salesforce' },
    })).toEqual({
      headers: {
        Authorization: 'Bearer jwt-1',
        'X-RC-Access-Token': 'token-1',
      },
      params: { platform: 'salesforce' },
    });
    await expect(util.getRcUserInfo()).resolves.toEqual({ rcExtensionId: 'hashed-ext-1' });
    await expect(util.getRcCallLogIdentity()).resolves.toEqual({
      extensionNumber: '101',
      hashedExtensionId: 'hashed-ext-1',
    });
    expect(openDB).toHaveBeenCalledWith('rc-widget-storage-ext-1', 2);
  });

  it('detects click-to-dial extension collision once and opens help from notification action', async () => {
    const util = await loadUtil();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({ status: 200 });

    await util.checkC2DCollision();

    expect(chrome.notifications.create).toHaveBeenCalledWith('rc-c2d-collision', expect.objectContaining({
      type: 'basic',
      title: 'misc.clickToDialCollisionTitle',
      message: 'misc.clickToDialCollision',
    }));
    expect(readStorage().rcForGoogleCollisionChecked).toBe(true);

    const listener = vi.mocked(chrome.notifications.onButtonClicked.addListener).mock.calls[0][0];
    listener('other-id', 0);
    listener('rc-c2d-collision', 0);
    expect(openSpy).toHaveBeenCalledWith('https://youtu.be/tbCOM27GUbc');

    vi.mocked(fetch).mockRejectedValue(new Error('network'));
    await expect(util.checkC2DCollision()).resolves.toBeUndefined();
  });

  it('downloads text files and removes expired storage entries', async () => {
    const util = await loadUtil();
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = clickSpy;
      }
      return element;
    });

    util.downloadTextFile({ filename: 'export.txt', text: 'hello world' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('a')).toBeNull();

    const getMock = vi.mocked(chromeMock.storage.local.get);
    getMock.mockImplementationOnce((_keys, callback) => {
      callback({
        active: { value: true, expiry: Date.now() + 1000 },
        expired: { value: true, expiry: Date.now() - 1000 },
      });
    });
    util.cleanUpExpiredStorage();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('expired', expect.any(Function));
  });

  it('debounces handlers and logs handler failures without throwing', async () => {
    const util = await loadUtil();
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn(async () => 'ok');
    const debounced = util.createDebounceHandler('search', 50);

    debounced({ query: 'a' }, handler);
    debounced({ query: 'ab' }, handler);
    await vi.advanceTimersByTimeAsync(50);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ query: 'ab' });

    const failing = vi.fn(async () => {
      throw new Error('failed');
    });
    debounced({ query: 'err' }, failing);
    await vi.advanceTimersByTimeAsync(50);
    expect(consoleError).toHaveBeenCalledWith('Debounced handler error for search:', expect.any(Error));
    vi.useRealTimers();
  });

  it('caches calldown contacts and maps RC additional submissions', async () => {
    const util = await loadUtil();

    await util.cacheCalldownContact({
      contactId: 'contact-1',
      contactName: 'Jane',
      phoneNumber: '+16505550100',
      contactType: 'Lead',
    });
    expect(readStorage().calldownContactCache['contact-1']).toEqual(expect.objectContaining({
      contactName: 'Jane',
      phoneNumber: '+16505550100',
      contactType: 'Lead',
    }));

    await util.cacheCalldownContact({ contactId: '', contactName: 'Jane', phoneNumber: '+1' });
    expect(Object.keys(readStorage().calldownContactCache)).toEqual(['contact-1']);

    await expect(util.setRcAdditionalSubmission({
      rcInfo: {
        value: {
          cachedData: {
            extensionInfo: {
              extensionNumber: '101',
            },
          },
        },
      },
      platform: {
        rcAdditionalSubmission: [
          { id: 'extensionNumber', path: 'cachedData.extensionInfo.extensionNumber' },
          { id: 'missing', path: 'cachedData.missing.value' },
        ],
      },
    })).resolves.toEqual({ extensionNumber: '101' });
    expect(readStorage().rcAdditionalSubmission).toEqual({ extensionNumber: '101' });
  });
});
