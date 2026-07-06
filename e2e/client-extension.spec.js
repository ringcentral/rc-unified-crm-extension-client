const { expect, test } = require('@playwright/test');
const {
  launchExtensionContext,
  readExtensionStorage,
  seedExtensionStorage,
  sendExtensionMessage,
} = require('./support/extensionHarness');
const { startFixtureServer } = require('./support/fixtureServer');

const defaultExtensionState = {
  allowEmbeddingForAllPages: true,
  renderQuickAccessButton: true,
  c2dMatcherType: 'libPhone',
  selectedRegion: 'US',
  userPermissions: {
    c2sms: true,
  },
  userSettings: {
    quickAccessButtonSize: {
      value: 'small',
    },
  },
};

async function getPhoneNumberTextRect(page) {
  return page.evaluate(() => {
    const textNode = document.querySelector('#contact-phone').firstChild;
    const text = textNode.nodeValue;
    const phoneNumberStart = text.indexOf('+1');
    const range = document.createRange();
    range.setStart(textNode, phoneNumberStart);
    range.setEnd(textNode, text.length);
    const rect = range.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function showClickToDialWidgetForPhone(page) {
  const callButton = page.getByTitle('Call with RingCentral');
  await expect(callButton).toHaveCount(1);

  let moveAttempt = 0;
  await expect.poll(async () => {
    const xRatios = [0.2, 0.5, 0.8];
    const phoneRect = await getPhoneNumberTextRect(page);
    const xRatio = xRatios[moveAttempt % xRatios.length];
    moveAttempt += 1;
    await page.mouse.move(phoneRect.x + phoneRect.width * xRatio, phoneRect.y + phoneRect.height / 2);
    await page.waitForTimeout(100);
    return callButton.isVisible();
  }).toBe(true);
  return callButton;
}

async function seedRingCentralWidgetIdentity(page) {
  await page.evaluate(() => {
    localStorage.setItem('sdk-rc-widgetplatform', JSON.stringify({
      owner_id: 'e2e-owner',
      access_token: 'e2e-rc-access-token',
    }));
  });
}

async function seedRingCentralWidgetIndexedDb(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('rc-widget-storage-e2e-owner', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('keyvaluepairs')) {
          db.createObjectStore('keyvaluepairs');
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('keyvaluepairs', 'readwrite');
        transaction.objectStore('keyvaluepairs').put({
          value: {
            cachedData: {
              extensionInfo: {
                id: 'e2e-extension',
                extensionNumber: '101',
                account: {
                  id: 'e2e-account',
                },
                contact: {
                  email: 'agent@example.com',
                },
              },
            },
          },
        }, 'dataFetcherV2-storageData');
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
}

async function openPopupPage(extension) {
  const popupPage = await extension.context.newPage();
  await popupPage.goto(`chrome-extension://${extension.extensionId}/options.html`);
  await seedRingCentralWidgetIdentity(popupPage);
  await seedRingCentralWidgetIndexedDb(popupPage);
  await popupPage.goto(`chrome-extension://${extension.extensionId}/popup.html`);
  await popupPage.locator('#rc-widget-adapter-frame').waitFor();
  await seedRingCentralWidgetIdentity(popupPage);
  await seedRingCentralWidgetIndexedDb(popupPage);
  return popupPage;
}

function e2eCallLogManifest(serverOrigin) {
  return {
    serverUrl: serverOrigin,
    platforms: {
      salesforce: {
        name: 'salesforce',
        displayName: 'Salesforce',
        contactTypes: [
          { value: 'Lead', display: 'Lead' },
        ],
        page: {
          callLog: {
            additionalFields: [],
          },
        },
      },
    },
  };
}

function e2eCallLogEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-call-log-request',
    path: '/callLogger',
    body: {
      triggerType: 'callLogSync',
      redirect: false,
      call: {
        sessionId: 'e2e-session-1',
        telephonySessionId: 'e2e-telephony-1',
        direction: 'Inbound',
        result: 'Completed',
        action: 'log',
        startTime: '2026-07-06T07:00:00Z',
        duration: 90,
        from: {
          phoneNumber: '+16505550100',
          name: 'Jane Caller',
        },
        to: {
          phoneNumber: '+16505550200',
          name: 'App Connect Agent',
        },
      },
    },
  };
}

test.describe('App Connect extension smoke', () => {
  let server;
  let extension;

  test.beforeAll(async () => {
    server = await startFixtureServer();
  });

  test.afterAll(async () => {
    await server?.close();
  });

  test.beforeEach(async () => {
    extension = await launchExtensionContext();
    await seedExtensionStorage(extension, defaultExtensionState);
  });

  test.afterEach(async () => {
    await extension?.close();
  });

  test('injects the content experience and opens the extension popup from quick access', async () => {
    const page = await extension.context.newPage();

    await page.goto(`${server.origin}/contact/123`);

    const quickAccessButton = page.locator('#rc-crm-extension-quick-access-button button').first();
    await expect(quickAccessButton).toBeVisible();
    await expect(page.locator('#contact-phone')).toContainText('+1 (650) 555-0100');

    const popupPagePromise = extension.context.waitForEvent('page');
    await quickAccessButton.click();
    const popupPage = await popupPagePromise;

    await expect.poll(() => popupPage.url()).toContain(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect.poll(async () => {
      const { popupWindowId } = await readExtensionStorage(extension, ['popupWindowId']);
      return typeof popupWindowId;
    }).toBe('number');
  });

  test('honors quick-access URL whitelist settings', async () => {
    await seedExtensionStorage(extension, {
      ...defaultExtensionState,
      allowEmbeddingForAllPages: false,
      'platform-info': {
        platformName: 'salesforce',
        hostname: '127.0.0.1',
      },
      customCrmManifest: {
        platforms: {
          salesforce: {
            embedUrls: ['*allowed*'],
          },
        },
      },
      userSettings: {
        ...defaultExtensionState.userSettings,
        quickAccessButtonEmbedMode: {
          value: 'whitelist',
        },
        quickAccessButtonUrls: {
          value: ['*allowed*'],
        },
      },
    });

    const blockedPage = await extension.context.newPage();
    await blockedPage.goto(`${server.origin}/blocked/contact/123`);
    await expect(blockedPage.locator('#rc-crm-extension-quick-access-button button')).toHaveCount(0);

    const allowedPage = await extension.context.newPage();
    await allowedPage.goto(`${server.origin}/allowed/contact/123`);
    await expect(allowedPage.locator('#rc-crm-extension-quick-access-button button').first()).toBeVisible();
  });

  test('opens the popup and caches click-to-dial intent from a local page', async () => {
    const page = await extension.context.newPage();

    await page.goto(`${server.origin}/contact/123`);
    await expect(page.locator('#contact-phone')).toContainText('+1 (650) 555-0100');

    const callButton = await showClickToDialWidgetForPhone(page);

    const popupPagePromise = extension.context.waitForEvent('page');
    await callButton.click();
    const popupPage = await popupPagePromise;

    await expect.poll(() => popupPage.url()).toContain(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect.poll(async () => sendExtensionMessage(extension, { type: 'checkForClickToXCache' })).toMatchObject({
      type: 'c2d',
      phoneNumber: '+16505550100',
    });
  });

  test('logs an inbound call through the popup call logger flow', async () => {
    await seedExtensionStorage(extension, {
      ...defaultExtensionState,
      customCrmManifest: e2eCallLogManifest(server.origin),
      'platform-info': {
        platformName: 'salesforce',
        hostname: '127.0.0.1',
      },
      rcUnifiedCrmExtJwt: 'e2e-crm-jwt',
      crmAuthed: true,
      rcUserInfo: {
        rcAccountId: 'e2e-account',
        rcExtensionId: 'e2e-hashed-extension',
      },
      userSettings: {
        ...defaultExtensionState.userSettings,
        autoLogCall: {
          value: true,
        },
        allowExtensionNumberLogging: {
          value: true,
        },
      },
    });
    const popupPage = await openPopupPage(extension);
    await popupPage.evaluate(async ({ manifest, serverOrigin }) => {
      await chrome.storage.local.set({
        customCrmManifest: manifest,
        'platform-info': {
          platformName: 'salesforce',
          hostname: '127.0.0.1',
        },
        rcUnifiedCrmExtJwt: 'e2e-crm-jwt',
        crmAuthed: true,
        rcUserInfo: {
          rcAccountId: 'e2e-account',
          rcExtensionId: 'e2e-hashed-extension',
        },
        userSettings: {
          autoLogCall: {
            value: true,
          },
          allowExtensionNumberLogging: {
            value: true,
          },
          quickAccessButtonSize: {
            value: 'small',
          },
        },
      });
      window.__e2eServerOrigin = serverOrigin;
    }, {
      manifest: e2eCallLogManifest(server.origin),
      serverOrigin: server.origin,
    });

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eCallLogEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST' && request.path === '/callLog'
    ))).toBeTruthy();

    const callLogRequest = server.requests.find((request) => (
      request.method === 'POST' && request.path === '/callLog'
    ));
    expect(callLogRequest.body).toMatchObject({
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      contactName: 'E2E Caller',
      note: '',
      logInfo: {
        sessionId: 'e2e-session-1',
        telephonySessionId: 'e2e-telephony-1',
        direction: 'Inbound',
        from: {
          phoneNumber: '+16505550100',
        },
      },
      extensionNumber: '101',
      hashedExtensionId: 'e2e-hashed-extension',
    });
    expect(callLogRequest.body.logInfo.customSubject).toBe('Inbound Call from E2E Caller');

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, ['rc-crm-call-log-e2e-session-1']);
      return storage['rc-crm-call-log-e2e-session-1'];
    }).toMatchObject({
      contact: {
        id: 'e2e-contact-1',
      },
      logId: 'e2e-call-log-1',
    });
  });
});
