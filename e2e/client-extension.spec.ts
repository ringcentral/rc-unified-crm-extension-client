import { expect, test } from '@playwright/test';
import {
  launchExtensionContext,
  readExtensionStorage,
  seedExtensionStorage,
  sendExtensionMessage,
} from './support/extensionHarness';
import { startFixtureServer } from './support/fixtureServer';

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
    await new Promise<void>((resolve, reject) => {
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

async function registerPopupWindowForRuntimeMessages(popupPage) {
  return popupPage.evaluate(async () => {
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.storage.local.set({ popupWindowId: currentWindow.id });
    return currentWindow.id;
  });
}

async function installWidgetMessageCapture(popupPage) {
  await popupPage.evaluate(() => {
    window.__e2eWidgetMessages = [];
    const frame = document.querySelector<HTMLIFrameElement & {
      __e2ePostMessagePatched?: boolean;
    }>('#rc-widget-adapter-frame');
    if (!frame?.contentWindow) {
      throw new Error('Widget frame is not ready');
    }
    if (frame.__e2ePostMessagePatched) {
      return;
    }
    const widgetWindow = frame.contentWindow;
    const originalPostMessage = widgetWindow.postMessage.bind(widgetWindow);
    widgetWindow.postMessage = ((message, targetOrigin, transfer) => {
      window.__e2eWidgetMessages.push({ message, targetOrigin });
      if (transfer) {
        return originalPostMessage(message, targetOrigin, transfer);
      }
      return originalPostMessage(message, targetOrigin);
    }) as typeof widgetWindow.postMessage;
    frame.__e2ePostMessagePatched = true;
  });
}

async function getWidgetMessages(popupPage) {
  return popupPage.evaluate(() => window.__e2eWidgetMessages ?? []);
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
          messageLog: {
            additionalFields: [],
          },
        },
      },
    },
  };
}

function e2eAppointmentManifest(serverOrigin) {
  const manifest = e2eCallLogManifest(serverOrigin);
  return {
    ...manifest,
    platforms: {
      salesforce: {
        ...manifest.platforms.salesforce,
        page: {
          ...manifest.platforms.salesforce.page,
          appointment: {
            supported: true,
            title: 'Service Visits',
            showConfirm: true,
            status: {
              isVisible: true,
              value: ['scheduled', 'confirmed', 'canceled', 'tentative'],
            },
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

function e2eAppointmentFormData(overrides = {}) {
  return {
    thirdPartyAppointmentId: 'e2e-appt-1',
    title: 'E2E appointment',
    dateTime: '2026-07-08T09:00',
    duration: 'PT45M',
    summary: 'Appointment from extension E2E',
    participantName: 'E2E Caller',
    participantContactId: 'e2e-contact-1',
    participantContactType: 'Lead',
    participantContactIds: ['e2e-contact-1'],
    participantContacts: [
      {
        id: 'e2e-contact-1',
        type: 'Lead',
        name: 'E2E Caller',
      },
    ],
    status: 'scheduled',
    returnTab: 'upcoming',
    returnSearch: '',
    returnFilter: 'All',
    ...overrides,
  };
}

function e2eAppointmentCreateEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-appointment-create-request',
    path: '/custom-button-click',
    body: {
      button: {
        id: 'appointmentCreatePage',
        type: 'submit',
        formData: e2eAppointmentFormData({
          thirdPartyAppointmentId: undefined,
          title: 'Created E2E appointment',
        }),
      },
    },
  };
}

function e2eAppointmentEditEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-appointment-edit-request',
    path: '/custom-button-click',
    body: {
      button: {
        id: 'appointmentEditPage',
        type: 'submit',
        formData: e2eAppointmentFormData({
          title: 'Updated E2E appointment',
          status: 'tentative',
        }),
      },
    },
  };
}

function e2eAppointmentStatusEvent(actionId, requestId) {
  return {
    type: 'rc-post-message-request',
    requestId,
    path: '/custom-button-click',
    body: {
      button: {
        id: `${actionId}-e2e-appt-1-action`,
        formData: {
          returnTab: 'upcoming',
          returnSearch: '',
          returnFilter: 'All',
        },
      },
    },
  };
}

function e2eManualCallLogFormEvent() {
  const event = e2eCallLogEvent();
  return {
    ...event,
    requestId: 'e2e-manual-call-log-request',
    body: {
      ...event.body,
      triggerType: 'logForm',
      call: {
        ...event.body.call,
        sessionId: 'e2e-manual-session-1',
        telephonySessionId: 'e2e-manual-telephony-1',
      },
      formData: {
        triggerType: 'createLog',
        contact: 'e2e-contact-1',
        contactType: 'Lead',
        contactName: 'E2E Caller',
        newContactName: '',
        newContactType: '',
        activityTitle: 'Manual follow-up call',
        note: 'Manual call note',
      },
    },
  };
}

function e2eCreateContactCallLogFormEvent() {
  const event = e2eManualCallLogFormEvent();
  return {
    ...event,
    requestId: 'e2e-create-contact-call-log-request',
    body: {
      ...event.body,
      call: {
        ...event.body.call,
        sessionId: 'e2e-create-contact-session-1',
        telephonySessionId: 'e2e-create-contact-telephony-1',
      },
      formData: {
        ...event.body.formData,
        contact: 'createNewContact',
        contactType: '',
        contactName: '',
        newContactName: 'Created E2E Contact',
        newContactType: 'Lead',
        activityTitle: 'Call with created contact',
        note: 'Create contact while logging',
      },
    },
  };
}

function e2ePendingRecordingCallLogEvent() {
  const event = e2eCallLogEvent();
  return {
    ...event,
    requestId: 'e2e-pending-recording-call-log-request',
    body: {
      ...event.body,
      call: {
        ...event.body.call,
        sessionId: 'e2e-pending-recording-session-1',
        telephonySessionId: 'e2e-pending-recording-telephony-1',
      },
    },
  };
}

function e2eMessageLogEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-message-log-request',
    path: '/messageLogger',
    body: {
      triggerType: 'auto',
      redirect: false,
      conversation: {
        conversationId: 'e2e-conversation-1',
        conversationLogId: 'e2e-conversation-log-1',
        type: 'SMS',
        messages: [
          {
            id: 'e2e-message-1',
            creationTime: '2026-07-06T07:05:00Z',
            direction: 'Inbound',
            attachments: [],
          },
        ],
        correspondents: [
          {
            phoneNumber: '+16505550100',
            name: 'Jane Caller',
          },
        ],
      },
    },
  };
}

function e2eManualMessageLogFormEvent() {
  const event = e2eMessageLogEvent();
  return {
    ...event,
    requestId: 'e2e-manual-message-log-request',
    body: {
      ...event.body,
      triggerType: 'logForm',
      formData: {
        contact: 'e2e-contact-1',
        contactType: 'Lead',
        contactName: 'E2E Caller',
        newContactName: '',
        newContactType: '',
      },
    },
  };
}

function e2eContactSearchButtonEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-contact-search-request',
    path: '/custom-button-click',
    body: {
      button: {
        id: 'contactSearchAdapterButtonCallLog',
        type: 'button',
        formData: {
          contactNameToSearch: 'Alex Search',
          contactPhoneNumber: '+16505550100',
        },
      },
    },
  };
}

function e2eContactSearchSelectionEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-contact-search-selection-request',
    path: '/customizedPage/inputChanged',
    body: {
      keys: ['contactList'],
      page: {
        id: 'contactSearchResultCallLog',
        formData: {
          contactInfo: [
            {
              id: 'e2e-search-contact-1',
              type: 'Contact',
              name: 'Alex Search',
              isNewContact: true,
            },
          ],
        },
      },
      formData: {
        contactList: 'e2e-search-contact-1',
        contactPhoneNumber: '+16505550100',
      },
    },
  };
}

function e2eScheduleSubmitEvent() {
  return {
    type: 'rc-post-message-request',
    requestId: 'e2e-schedule-submit-request',
    path: '/custom-button-click',
    body: {
      page: {
        id: 'c2dSchedulePage',
      },
      formData: {
        phone: '+16505550100',
        contact: 'e2e-contact-1',
        note: 'Call later from E2E',
        callbackDateTime: '2026-07-07T10:00:00Z',
      },
    },
  };
}

function e2eExistingCallLogEvent() {
  const event = e2eCallLogEvent();
  return {
    ...event,
    requestId: 'e2e-existing-call-log-request',
    body: {
      ...event.body,
      call: {
        ...event.body.call,
        sessionId: 'e2e-existing-session-1',
        telephonySessionId: 'e2e-existing-telephony-1',
        duration: 120,
        recording: {
          link: 'https://recordings.example/recording-1',
          contentUri: 'https://recordings.example/content/recording-1',
        },
      },
    },
  };
}

async function seedCallLoggerState(extension, serverOrigin, overrides = {}) {
  const state = {
    ...defaultExtensionState,
    customCrmManifest: e2eCallLogManifest(serverOrigin),
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
    ...overrides,
  };
  await seedExtensionStorage(extension, state);
  return state;
}

async function seedMessageLoggerState(extension, serverOrigin, overrides = {}) {
  const state = {
    ...defaultExtensionState,
    customCrmManifest: e2eCallLogManifest(serverOrigin),
    'platform-info': {
      platformName: 'salesforce',
      hostname: '127.0.0.1',
    },
    rcUnifiedCrmExtJwt: 'e2e-crm-jwt',
    crmAuthed: true,
    userSettings: {
      ...defaultExtensionState.userSettings,
      autoLogSMS: {
        value: true,
      },
      messageAutoPopup: {
        value: false,
      },
    },
    ...overrides,
  };
  await seedExtensionStorage(extension, state);
  return state;
}

async function seedOAuthState(extension, serverOrigin, overrides = {}) {
  const state = {
    ...defaultExtensionState,
    customCrmManifest: e2eCallLogManifest(serverOrigin),
    'platform-info': {
      platformName: 'salesforce',
      hostname: '127.0.0.1',
    },
    crmAuthed: false,
    rcUserInfo: {
      rcAccountId: 'e2e-account',
      rcExtensionId: 'e2e-hashed-extension',
    },
    userSettings: {
      ...defaultExtensionState.userSettings,
      showCalldownTab: {
        value: false,
      },
      showUserReportTab: {
        value: false,
      },
      showAppointmentsTab: {
        value: false,
      },
      serverSideLogging: {
        enable: false,
      },
    },
    ...overrides,
  };
  await seedExtensionStorage(extension, state);
  return state;
}

async function seedAppointmentState(extension, serverOrigin, overrides = {}) {
  const state = {
    ...defaultExtensionState,
    customCrmManifest: e2eAppointmentManifest(serverOrigin),
    'platform-info': {
      platformName: 'salesforce',
      hostname: '127.0.0.1',
    },
    rcUnifiedCrmExtJwt: 'e2e-crm-jwt',
    crmAuthed: true,
    userSettings: {
      ...defaultExtensionState.userSettings,
      showAppointmentsTab: {
        value: true,
      },
    },
    ...overrides,
  };
  await seedExtensionStorage(extension, state);
  return state;
}

async function refreshExtensionStateInPopup(popupPage, state) {
  await popupPage.evaluate(async (nextState) => {
    await chrome.storage.local.set(nextState);
  }, state);
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
    server.clearRequests();
    server.setUserSettings();
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

  test('reuses the existing popup and forwards the latest click-to-dial intent', async () => {
    const popupPage = await openPopupPage(extension);
    await registerPopupWindowForRuntimeMessages(popupPage);
    await installWidgetMessageCapture(popupPage);
    const popupPageCount = () => extension.context.pages()
      .filter((page) => page.url().includes(`chrome-extension://${extension.extensionId}/popup.html`))
      .length;
    const popupCountBefore = popupPageCount();

    await popupPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'c2d', phoneNumber: '+16505550100' });
      await chrome.runtime.sendMessage({ type: 'c2d', phoneNumber: '+16505550199' });
    });

    await expect.poll(() => getWidgetMessages(popupPage)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-new-call',
          phoneNumber: '+16505550100',
          toCall: true,
        },
        targetOrigin: '*',
      }),
      expect.objectContaining({
        message: {
          type: 'rc-adapter-new-call',
          phoneNumber: '+16505550199',
          toCall: true,
        },
        targetOrigin: '*',
      }),
    ]));
    const callMessages = (await getWidgetMessages(popupPage))
      .filter(({ message }) => message.type === 'rc-adapter-new-call');
    expect(callMessages.at(-1).message.phoneNumber).toBe('+16505550199');
    expect(popupPageCount()).toBe(popupCountBefore);
    await expect.poll(async () => popupPage.evaluate(async () => {
      const cached = await chrome.runtime.sendMessage({ type: 'checkForClickToXCache' });
      return cached ?? null;
    })).toBeNull();
  });

  test('logs an inbound call through the popup call logger flow', async () => {
    const state = await seedCallLoggerState(extension, server.origin);
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

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

  test('updates an existing inbound call log instead of creating a duplicate', async () => {
    const state = await seedCallLoggerState(extension, server.origin, {
      'e2e-existing-session-1': 'Cached update note',
    });
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eExistingCallLogEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'PATCH' && request.path === '/callLog'
    ))).toBeTruthy();
    expect(server.requests.find((request) => (
      request.method === 'POST' && request.path === '/callLog'
    ))).toBeUndefined();

    const updateRequest = server.requests.find((request) => (
      request.method === 'PATCH' && request.path === '/callLog'
    ));
    expect(updateRequest.body).toMatchObject({
      sessionId: 'e2e-existing-session-1',
      telephonySessionId: 'e2e-existing-telephony-1',
      note: 'Cached update note',
      recordingLink: 'https://recordings.example/recording-1',
      recordingDownloadLink: 'https://recordings.example/content/recording-1?accessToken=e2e-rc-access-token',
      duration: 120,
      direction: 'Inbound',
      extensionNumber: '101',
      hashedExtensionId: 'e2e-hashed-extension',
    });
  });

  test('uses a pending recording placeholder when creating a call log', async () => {
    const pendingRecording = {
      link: '(pending...)',
      contentUri: 'https://recordings.example/pending/recording-1',
      status: 'pending',
    };
    const state = await seedCallLoggerState(extension, server.origin, {
      'rec-link-e2e-pending-recording-session-1': pendingRecording,
    });
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2ePendingRecordingCallLogEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/callLog'
      && request.body?.logInfo?.sessionId === 'e2e-pending-recording-session-1'
    ))).toBeTruthy();

    const callLogRequest = server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/callLog'
      && request.body?.logInfo?.sessionId === 'e2e-pending-recording-session-1'
    ));
    expect(callLogRequest.body.logInfo.recording).toMatchObject(pendingRecording);
    expect(callLogRequest.body).toMatchObject({
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      contactName: 'E2E Caller',
    });
  });

  test('submits a manual call log form through the popup call logger flow', async () => {
    const state = await seedCallLoggerState(extension, server.origin);
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eManualCallLogFormEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/callLog'
      && request.body?.logInfo?.sessionId === 'e2e-manual-session-1'
    ))).toBeTruthy();

    const callLogRequest = server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/callLog'
      && request.body?.logInfo?.sessionId === 'e2e-manual-session-1'
    ));
    expect(callLogRequest.body).toMatchObject({
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      contactName: 'E2E Caller',
      note: 'Manual call note',
      logInfo: {
        sessionId: 'e2e-manual-session-1',
        telephonySessionId: 'e2e-manual-telephony-1',
        customSubject: 'Manual follow-up call',
      },
      extensionNumber: '101',
      hashedExtensionId: 'e2e-hashed-extension',
    });

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, ['rc-crm-call-log-e2e-manual-session-1']);
      return storage['rc-crm-call-log-e2e-manual-session-1'];
    }).toMatchObject({
      contact: {
        id: 'e2e-contact-1',
      },
      logId: 'e2e-call-log-1',
    });
  });

  test('creates a new contact before submitting a manual call log', async () => {
    const state = await seedCallLoggerState(extension, server.origin);
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eCreateContactCallLogFormEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST' && request.path === '/contact'
    ))).toBeTruthy();
    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/callLog'
      && request.body?.logInfo?.sessionId === 'e2e-create-contact-session-1'
    ))).toBeTruthy();

    const contactRequestIndex = server.requests.findIndex((request) => (
      request.method === 'POST' && request.path === '/contact'
    ));
    const callLogRequestIndex = server.requests.findIndex((request) => (
      request.method === 'POST'
      && request.path === '/callLog'
      && request.body?.logInfo?.sessionId === 'e2e-create-contact-session-1'
    ));
    expect(contactRequestIndex).toBeGreaterThanOrEqual(0);
    expect(callLogRequestIndex).toBeGreaterThan(contactRequestIndex);

    const contactRequest = server.requests[contactRequestIndex];
    expect(contactRequest.body).toMatchObject({
      phoneNumber: '+16505550100',
      newContactName: 'Created E2E Contact',
      newContactType: 'Lead',
    });

    const callLogRequest = server.requests[callLogRequestIndex];
    expect(callLogRequest.body).toMatchObject({
      contactId: 'e2e-created-contact-1',
      contactType: 'Lead',
      contactName: 'Created E2E Contact',
      note: 'Create contact while logging',
      logInfo: {
        sessionId: 'e2e-create-contact-session-1',
        customSubject: 'Call with created contact',
      },
    });

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, [
        'tempContactMatchTask-+16505550100',
        'rc-crm-call-log-e2e-create-contact-session-1',
      ]);
      return storage;
    }).toMatchObject({
      'tempContactMatchTask-+16505550100': [
        {
          id: 'e2e-created-contact-1',
          name: 'Created E2E Contact',
          type: 'Lead',
        },
      ],
      'rc-crm-call-log-e2e-create-contact-session-1': {
        contact: {
          id: 'e2e-created-contact-1',
        },
        logId: 'e2e-call-log-1',
      },
    });
  });

  test('searches for a contact and writes the selected contact back to the call log form', async () => {
    const state = await seedCallLoggerState(extension, server.origin, {
      cacheLogPageData: {
        id: 'e2e-search-session-1',
        manifest: e2eCallLogManifest(server.origin),
        logType: 'Call',
        triggerType: 'createLog',
        platformName: 'salesforce',
        direction: 'Inbound',
        contactPhoneNumber: '+16505550100',
        logInfo: {},
        contactInfo: [
          {
            id: 'e2e-contact-1',
            type: 'Lead',
            name: 'E2E Caller',
          },
        ],
      },
    });
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);
    await installWidgetMessageCapture(popupPage);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eContactSearchButtonEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'GET' && request.path === '/custom/contact/search'
    ))).toBeTruthy();
    await expect.poll(() => getWidgetMessages(popupPage)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: expect.objectContaining({
            id: 'contactSearchResultCallLog',
          }),
        }),
      }),
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/contactSearchResultCallLog',
        },
        targetOrigin: '*',
      }),
    ]));

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eContactSearchSelectionEvent());

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, [
        'rc-crm-search-contact-+16505550100',
      ]);
      return storage['rc-crm-search-contact-+16505550100'];
    }).toEqual([
      {
        id: 'e2e-search-contact-1',
        type: 'Contact',
        name: 'Alex Search',
      },
    ]);
    await expect.poll(() => getWidgetMessages(popupPage)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-trigger-contact-match',
          phoneNumbers: ['+16505550100'],
        },
        targetOrigin: '*',
      }),
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-update-call-log-page',
          page: expect.objectContaining({
            formData: expect.objectContaining({
              contact: 'e2e-search-contact-1',
              contactType: 'Contact',
              contactName: 'Alex Search',
              returnToHistoryPage: true,
            }),
          }),
        }),
      }),
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/log/call/e2e-search-session-1',
        },
        targetOrigin: '*',
      }),
    ]));
  });

  test('auto logs an SMS message through the popup message logger flow', async () => {
    const state = await seedMessageLoggerState(extension, server.origin);
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eMessageLogEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST' && request.path === '/messageLog'
    ))).toBeTruthy();

    const messageLogRequest = server.requests.find((request) => (
      request.method === 'POST' && request.path === '/messageLog'
    ));
    expect(messageLogRequest.body).toMatchObject({
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      contactName: 'E2E Caller',
      additionalSubmission: {},
      overridingFormat: [],
      logInfo: {
        conversationId: 'e2e-conversation-1',
        conversationLogId: 'e2e-conversation-log-1',
        type: 'SMS',
        correspondents: [
          {
            phoneNumber: '+16505550100',
          },
        ],
        messages: [
          {
            direction: 'Inbound',
            attachments: [],
          },
        ],
      },
    });

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, [
        'rc-crm-conversation-pref-e2e-conversation-log-1',
        'rc-crm-conversation-log-e2e-conversation-log-1',
      ]);
      return storage;
    }).toMatchObject({
      'rc-crm-conversation-pref-e2e-conversation-log-1': {
        contact: {
          id: 'e2e-contact-1',
          type: 'Lead',
          name: 'E2E Caller',
        },
        additionalSubmission: {},
      },
      'rc-crm-conversation-log-e2e-conversation-log-1': {
        logged: true,
      },
    });
  });

  test('submits a manual message log form through the popup message logger flow', async () => {
    const state = await seedMessageLoggerState(extension, server.origin);
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eManualMessageLogFormEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/messageLog'
      && request.body?.logInfo?.conversationLogId === 'e2e-conversation-log-1'
    ))).toBeTruthy();

    const messageLogRequest = server.requests.find((request) => (
      request.method === 'POST'
      && request.path === '/messageLog'
      && request.body?.logInfo?.conversationLogId === 'e2e-conversation-log-1'
    ));
    expect(messageLogRequest.body).toMatchObject({
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      contactName: 'E2E Caller',
      additionalSubmission: {},
      overridingFormat: [],
      logInfo: {
        conversationId: 'e2e-conversation-1',
        conversationLogId: 'e2e-conversation-log-1',
        type: 'SMS',
      },
    });

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, [
        'rc-crm-conversation-pref-e2e-conversation-log-1',
        'rc-crm-conversation-log-e2e-conversation-log-1',
      ]);
      return storage;
    }).toMatchObject({
      'rc-crm-conversation-pref-e2e-conversation-log-1': {
        contact: {
          id: 'e2e-contact-1',
          type: 'Lead',
          name: 'E2E Caller',
        },
      },
      'rc-crm-conversation-log-e2e-conversation-log-1': {
        logged: true,
      },
    });
  });

  test('opens C2SMS and schedules a callback from click-to-schedule intent', async () => {
    const state = await seedCallLoggerState(extension, server.origin, {
      userSettings: {
        ...defaultExtensionState.userSettings,
        showCalldownTab: {
          value: true,
        },
      },
    });
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);
    await registerPopupWindowForRuntimeMessages(popupPage);
    await installWidgetMessageCapture(popupPage);

    await sendExtensionMessage(extension, {
      type: 'c2sms',
      phoneNumber: '+16505550100',
    });

    await expect.poll(() => getWidgetMessages(popupPage)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: {
          type: 'rc-adapter-new-sms',
          phoneNumber: '+16505550100',
          conversation: true,
          recipient: {},
        },
        targetOrigin: '*',
      }),
    ]));

    await sendExtensionMessage(extension, {
      type: 'c2schedule',
      phoneNumber: '+16505550100',
    });

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'GET' && request.path === '/contact'
    ))).toBeTruthy();
    await expect.poll(() => getWidgetMessages(popupPage)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: expect.objectContaining({
            id: 'c2dSchedulePage',
            formData: expect.objectContaining({
              phone: '+16505550100',
              contact: 'e2e-contact-1',
            }),
          }),
        }),
        targetOrigin: '*',
      }),
      expect.objectContaining({
        message: {
          type: 'rc-adapter-navigate-to',
          path: '/customized/c2dSchedulePage',
        },
        targetOrigin: '*',
      }),
    ]));

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eScheduleSubmitEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST' && request.path === '/calldown'
    ))).toBeTruthy();
    const scheduleRequest = server.requests.find((request) => (
      request.method === 'POST' && request.path === '/calldown'
    ));
    expect(scheduleRequest.query).toMatchObject({
      rcAccountId: 'e2e-account',
    });
    expect(scheduleRequest.body).toMatchObject({
      phoneNumber: '+16505550100',
      scheduledAt: '2026-07-07T10:00:00Z',
      contactId: 'e2e-contact-1',
      note: 'Call later from E2E',
    });

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, ['calldownContactCache']);
      return storage.calldownContactCache?.['e2e-contact-1'];
    }).toMatchObject({
      contactName: 'E2E Caller',
      phoneNumber: '+16505550100',
      contactType: 'Lead',
    });
  });

  test('creates, updates, confirms, and cancels appointments through the popup appointment flow', async () => {
    server.setUserSettings({
      showAppointmentsTab: {
        value: true,
      },
    });
    const state = await seedAppointmentState(extension, server.origin);
    server.clearRequests();
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);
    await installWidgetMessageCapture(popupPage);

    await expect.poll(() => ({
      downloaded: server.requests.some((request) => (
        request.method === 'GET' && request.path === '/user/settings'
      )),
      uploaded: server.requests.some((request) => (
        request.method === 'POST' && request.path === '/user/settings'
      )),
    })).toEqual({ downloaded: true, uploaded: true });
    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, ['userSettings']);
      return storage.userSettings?.showAppointmentsTab?.value;
    }).toBe(true);
    server.clearRequests();

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eAppointmentCreateEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'POST' && request.path === '/appointments'
    ))).toBeTruthy();
    const createRequest = server.requests.find((request) => (
      request.method === 'POST' && request.path === '/appointments'
    ));
    expect(createRequest.body).toMatchObject({
      title: 'Created E2E appointment',
      participantName: 'E2E Caller',
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      status: 'scheduled',
      durationMinutes: 45,
    });
    await expect.poll(() => server.requests.some((request) => (
      request.method === 'GET' && request.path === '/appointments'
    ))).toBe(true);

    server.clearRequests();
    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eAppointmentEditEvent());

    await expect.poll(() => server.requests.find((request) => (
      request.method === 'PATCH' && request.path === '/appointments/e2e-appt-1'
    ))).toBeTruthy();
    const editRequest = server.requests.find((request) => (
      request.method === 'PATCH' && request.path === '/appointments/e2e-appt-1'
    ));
    expect(editRequest.body).toMatchObject({
      title: 'Updated E2E appointment',
      participantName: 'E2E Caller',
      contactId: 'e2e-contact-1',
      contactType: 'Lead',
      status: 'tentative',
      durationMinutes: 45,
    });
    await expect.poll(() => server.requests.some((request) => (
      request.method === 'GET' && request.path === '/appointments'
    ))).toBe(true);

    server.clearRequests();
    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eAppointmentStatusEvent(
      'appointmentConfirm',
      'e2e-appointment-confirm-request',
    ));

    await expect.poll(() => server.requests.some((request) => (
      request.method === 'POST' && request.path === '/appointments/e2e-appt-1/confirm'
    ))).toBe(true);
    await expect.poll(() => server.requests.some((request) => (
      request.method === 'GET' && request.path === '/appointments'
    ))).toBe(true);

    server.clearRequests();
    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eAppointmentStatusEvent(
      'appointmentCancel',
      'e2e-appointment-cancel-request',
    ));

    await expect.poll(() => server.requests.some((request) => (
      request.method === 'POST' && request.path === '/appointments/e2e-appt-1/cancel'
    ))).toBe(true);
    await expect.poll(() => getWidgetMessages(popupPage)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rc-adapter-register-customized-page',
          page: expect.objectContaining({ id: 'appointmentsPage' }),
        }),
      }),
    ]));
  });

  test('does not call CRM logging APIs when CRM auth is missing', async () => {
    const state = await seedCallLoggerState(extension, server.origin, {
      crmAuthed: false,
      rcUnifiedCrmExtJwt: null,
    });
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);
    const requestCountBeforeCallLogger = server.requests.length;

    await popupPage.evaluate((event) => window.postMessage(event, '*'), e2eCallLogEvent());
    await popupPage.waitForTimeout(1000);

    const callLoggerRequests = server.requests
      .slice(requestCountBeforeCallLogger)
      .filter((request) => request.path === '/contact' || request.path === '/callLog');
    expect(callLoggerRequests).toEqual([]);
  });

  test('completes a third-party OAuth callback and stores CRM auth state', async () => {
    const state = await seedOAuthState(extension, server.origin);
    const popupPage = await openPopupPage(extension);
    await refreshExtensionStateInPopup(popupPage, state);

    await sendExtensionMessage(extension, {
      type: 'oauthCallBack',
      platform: 'thirdParty',
      callbackUri: 'https://callback.example/crm?code=e2e-code&state=platform%3Dsalesforce',
    });

    await expect.poll(async () => {
      const storage = await readExtensionStorage(extension, [
        'rcUnifiedCrmExtJwt',
        'crmAuthed',
        'crmUserInfo',
        'userSettings',
      ]);
      return storage;
    }).toMatchObject({
      rcUnifiedCrmExtJwt: 'e2e-oauth-jwt',
      crmAuthed: true,
      crmUserInfo: {
        name: 'E2E CRM User',
      },
      userSettings: expect.objectContaining({
        showCalldownTab: {
          value: false,
        },
      }),
    });

    const oauthRequest = server.requests.find((request) => (
      request.method === 'GET' && request.path === '/oauth-callback'
    ));
    expect(oauthRequest.query).toMatchObject({
      callbackUri: 'https://callback.example/crm?code=e2e-code&state=platform%3Dsalesforce',
      hostname: '127.0.0.1',
      rcAccountId: 'e2e-account',
      rcExtensionId: 'e2e-extension',
      userEmail: 'agent@example.com',
    });
    await expect.poll(() => server.requests.some((request) => (
      request.method === 'GET' && request.path === '/admin/settings'
    ))).toBe(true);
    await expect.poll(() => server.requests.some((request) => (
      request.method === 'POST' && request.path === '/user/settings'
    ))).toBe(true);
  });
});
