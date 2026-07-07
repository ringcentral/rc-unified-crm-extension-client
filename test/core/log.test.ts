import axios from 'axios';
import { showNotification, getRcAccessToken, getRcCallLogIdentity, isObjectEmpty } from '../../src/lib/util.ts';
import { trackSyncCallLog, trackSyncMessageLog } from '../../src/lib/analytics.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage, seedStorage } from '../setup/storageHelpers';

vi.mock('axios', () => ({
  default: {
    defaults: {
      headers: {
        common: {},
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(),
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
  getRcCallLogIdentity: vi.fn(async () => ({
    extensionNumber: '101',
    hashedExtensionId: 'hash-1',
  })),
  isObjectEmpty: vi.fn((obj) => !obj || Object.keys(obj).length === 0),
}));

vi.mock('../../src/lib/analytics.ts', () => ({
  trackSyncCallLog: vi.fn(),
  trackSyncMessageLog: vi.fn(),
}));

vi.mock('../../src/i18n/index.ts', () => ({
  t: vi.fn((key) => key),
}));

async function loadLogCore() {
  vi.resetModules();
  return loadModule('../../src/core/log.ts');
}

describe('log core', () => {
  it('creates call logs with recording download URL, merged additional submission, and matcher refresh', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      userSettings: {
        overridingPhoneNumberFormat: { value: 'format-1' },
      },
      rcAdditionalSubmission: {
        fromStorage: true,
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        successful: true,
        logId: 'log-1',
        returnMessage: { message: 'Call logged', messageType: 'success', ttl: 3000 },
      },
    });
    const logCore = await loadLogCore();
    const logInfo = {
      sessionId: 'session-1',
      recording: {
        contentUri: 'https://recording.example/content',
      },
    };

    await logCore.addLog({
      serverUrl: 'https://server.example',
      logType: 'Call',
      logInfo,
      isMain: true,
      subject: 'Call subject',
      note: 'Call note',
      aiNote: 'AI note',
      transcript: 'Transcript',
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Jane Doe',
      additionalSubmission: { fromForm: true },
    });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/callLog', {
      logInfo: {
        sessionId: 'session-1',
        recording: {
          contentUri: 'https://recording.example/content',
          downloadUrl: 'https://recording.example/content?accessToken=rc-access-token',
        },
        customSubject: 'Call subject',
      },
      note: 'Call note',
      aiNote: 'AI note',
      transcript: 'Transcript',
      additionalSubmission: {
        fromForm: true,
        fromStorage: true,
      },
      overridingFormat: ['format-1'],
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Jane Doe',
      extensionNumber: '101',
      hashedExtensionId: 'hash-1',
    });
    expect(trackSyncCallLog).toHaveBeenCalledWith({ hasNote: true });
    expect(readStorage()['rc-crm-call-log-session-1']).toEqual({
      contact: { id: 'contact-1' },
      logId: 'log-1',
    });
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-1'],
      },
      targetOrigin: '*',
    });
  });

  it('creates message logs and stores conversation logging state', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      userSettings: {},
      rcAdditionalSubmission: { disposition: 'Demo' },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        successful: true,
        logIds: ['message-log-1'],
        returnMessage: { message: 'Message logged', messageType: 'success', ttl: 3000 },
      },
    });
    const logCore = await loadLogCore();
    const logInfo = {
      type: 'SMS',
      conversationLogId: 'conversation-1',
      messages: [
        { attachments: [{ type: 'MmsAttachment' }] },
      ],
    };

    await logCore.addLog({
      serverUrl: 'https://server.example',
      logType: 'Message',
      logInfo,
      isMain: true,
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Jane Doe',
      additionalSubmission: {},
    });

    expect(logInfo.rcAccessToken).toBe('rc-access-token');
    expect(axios.post).toHaveBeenCalledWith('https://server.example/messageLog', {
      logInfo,
      additionalSubmission: { disposition: 'Demo' },
      overridingFormat: [],
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Jane Doe',
    });
    expect(trackSyncMessageLog).toHaveBeenCalled();
    expect(readStorage()).toMatchObject({
      'rc-crm-conversation-pref-conversation-1': {
        contact: {
          id: 'contact-1',
          type: 'Lead',
          name: 'Jane Doe',
        },
        additionalSubmission: { disposition: 'Demo' },
      },
      'rc-crm-conversation-log-conversation-1': { logged: true },
    });
  });

  it('warns instead of logging when CRM JWT is missing', async () => {
    const logCore = await loadLogCore();

    await logCore.addLog({
      serverUrl: 'https://server.example',
      logType: 'Call',
      logInfo: { sessionId: 'session-1' },
    });

    expect(axios.post).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'notifications.warning.connectToCrm',
      ttl: 3000,
    });
  });

  it('uses pending recording placeholders and reports unsuccessful call log responses', async () => {
    seedStorage({
      rcUnifiedCrmExtJwt: 'jwt-1',
      [`rec-link-session-2`]: {
        contentUri: 'https://recording.example/pending',
        status: 'pending',
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        successful: false,
        returnMessage: {
          message: 'Call log failed',
          messageType: 'warning',
          ttl: 4000,
          details: 'CRM rejected the request',
        },
      },
    });
    const logCore = await loadLogCore();
    const logInfo = {
      sessionId: 'session-2',
    };

    await logCore.addLog({
      serverUrl: 'https://server.example',
      logType: 'Call',
      logInfo,
      note: '',
      contactId: 'contact-2',
      additionalSubmission: {},
    });

    expect(logInfo.recording).toEqual({
      contentUri: 'https://recording.example/pending',
      status: 'pending',
    });
    expect(trackSyncCallLog).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith({
      level: 'warning',
      message: 'Call log failed',
      ttl: 4000,
      details: 'CRM rejected the request',
    });
    expect(readStorage()['rc-crm-call-log-session-2']).toBeUndefined();
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-2'],
      },
      targetOrigin: '*',
    });
  });

  it('gets and updates call logs with RingCentral identity fields', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        successful: true,
        logs: [{ sessionId: 'session-1' }],
        returnMessage: { messageType: 'success', message: 'Found', ttl: 3000 },
      },
    });
    vi.mocked(axios.patch).mockResolvedValueOnce({
      data: {
        returnMessage: { messageType: 'success', message: 'Updated', ttl: 3000 },
      },
    });
    const logCore = await loadLogCore();

    await expect(logCore.getLog({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionIds: 'session-1',
      requireDetails: true,
    })).resolves.toEqual({
      successful: true,
      callLogs: [{ sessionId: 'session-1' }],
    });
    await logCore.updateLog({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionId: 'session-1',
      note: 'Updated note',
      isShowNotification: true,
    });

    expect(axios.get).toHaveBeenCalledWith('https://server.example/callLog?sessionIds=session-1&requireDetails=true&extensionNumber=101&hashedExtensionId=hash-1');
    expect(axios.patch).toHaveBeenCalledWith('https://server.example/callLog', expect.objectContaining({
      sessionId: 'session-1',
      note: 'Updated note',
      extensionNumber: '101',
      hashedExtensionId: 'hash-1',
    }));
    expect(axios.defaults.headers.common.Authorization).toBe('Bearer jwt-1');
  });

  it('caches and uploads call notes only when JWT and note exist', async () => {
    seedStorage({ rcUnifiedCrmExtJwt: 'jwt-1' });
    vi.mocked(isObjectEmpty).mockImplementation((obj) => !obj || Object.keys(obj).length === 0);
    const logCore = await loadLogCore();

    await logCore.cacheCallNote({ sessionId: 'session-1', note: 'Draft note' });
    await expect(logCore.getCachedNote({ sessionId: 'session-1' })).resolves.toBe('Draft note');
    await logCore.uploadCacheNote({ serverUrl: 'https://server.example', sessionId: 'session-1' });

    expect(axios.post).toHaveBeenCalledWith('https://server.example/callLog/cacheNote', {
      sessionId: 'session-1',
      note: 'Draft note',
    });
  });

  it('opens log URLs and handles missing auth or cache data without server writes', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const logCore = await loadLogCore();

    logCore.openLog({
      manifest: {
        platforms: {
          salesforce: {
            logPageUrl: 'https://{hostname}/log/{logId}?contact={contactId}&type={contactType}',
          },
        },
      },
      platformName: 'salesforce',
      hostname: 'crm.example',
      logId: 'log-1',
      contactId: 'contact-1',
      contactType: 'Lead',
      userSettings: {},
    });
    await expect(logCore.getLog({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionIds: 'session-1',
      requireDetails: false,
    })).resolves.toEqual({
      successful: false,
      message: 'notifications.warning.connectToCrm',
    });
    await expect(logCore.getCachedNote({ sessionId: 'missing-session' })).resolves.toBe('');
    await logCore.uploadCacheNote({
      serverUrl: 'https://server.example',
      sessionId: 'missing-session',
    });

    expect(window.open).toHaveBeenCalledWith('https://crm.example/log/log-1?contact=contact-1&type=Lead');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('describes unresolved log conflict content', async () => {
    const logCore = await loadLogCore();

    expect(logCore.getConflictContentFromUnresolvedLog({
      phoneNumber: '16505550100',
      contactInfo: [
        { isNewContact: true },
      ],
    })).toEqual({
      title: '16505550100',
      description: 'conflicts.noMatchedContact',
    });

    expect(logCore.getConflictContentFromUnresolvedLog({
      phoneNumber: '16505550101',
      contactInfo: [
        { id: 'contact-1', name: 'Jane', isNewContact: false },
        { id: 'contact-2', name: 'Alex', isNewContact: false },
      ],
    })).toEqual({
      title: 'conflicts.multipleContacts (16505550101)',
      description: 'conflicts.multipleMatchedContacts',
    });

    expect(logCore.getConflictContentFromUnresolvedLog({
      phoneNumber: '16505550102',
      type: 'Call',
      contactInfo: [
        {
          id: 'contact-1',
          name: 'Jane',
          isNewContact: false,
          additionalInfo: {
            caseId: [
              { const: 'case-1', title: 'Case 1' },
              { const: 'case-2', title: 'Case 2' },
            ],
            ownerSelected: false,
          },
        },
      ],
    })).toEqual({
      title: 'Jane (16505550102)',
      description: 'conflicts.multipleAssociations',
      type: 'Call',
    });
  });
});
