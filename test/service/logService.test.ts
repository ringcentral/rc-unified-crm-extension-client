import userCore from '../../src/core/user.ts';
import logCore from '../../src/core/log.ts';
import dispositionCore from '../../src/core/disposition.ts';
import contactCore from '../../src/core/contact.ts';
import logUtil from '../../src/lib/logUtil.ts';
import { showNotification, dismissNotification, getRcAccessToken } from '../../src/lib/util.ts';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { seedStorage } from '../setup/storageHelpers';

vi.mock('../../src/core/user.ts', () => ({
  default: {
    getEnableRetroCallLogSync: vi.fn(() => ({ value: true })),
    getAutoLogCallSetting: vi.fn(() => ({ value: true })),
    getOneTimeLogSetting: vi.fn(() => ({ value: false })),
  },
}));

vi.mock('../../src/core/log.ts', () => ({
  default: {
    getCachedNote: vi.fn(async () => 'cached note'),
    getLog: vi.fn(),
    addLog: vi.fn(),
    updateLog: vi.fn(),
  },
}));

vi.mock('../../src/core/disposition.ts', () => ({
  default: {
    upsertDisposition: vi.fn(),
  },
}));

vi.mock('../../src/core/contact.ts', () => ({
  default: {
    getContact: vi.fn(),
  },
}));

vi.mock('../../src/lib/logUtil.ts', () => ({
  default: {
    getLogConflictInfo: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  showNotification: vi.fn(async () => 'notification-id'),
  dismissNotification: vi.fn(),
  isObjectEmpty: vi.fn((obj) => !obj || Object.keys(obj).length === 0),
  getRcAccessToken: vi.fn(() => 'rc-access-token'),
}));

async function loadLogService() {
  vi.resetModules();
  return loadModule('../../src/service/logService.ts');
}

describe('logService', () => {
  it('does not run retro auto-log when the user disabled retro sync', async () => {
    seedStorage({ userSettings: {} });
    vi.mocked(userCore.getEnableRetroCallLogSync).mockReturnValueOnce({ value: false });
    const service = await loadLogService();

    await service.retroAutoCallLog({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform: { name: 'salesforce' },
    });

    expect(RCAdapter.getUnloggedCalls).not.toHaveBeenCalled();
  });

  it('retro auto-logs matched unresolved calls and upserts disposition when supported', async () => {
    seedStorage({
      userSettings: {},
      implementedInterfaces: { upsertCallDisposition: true },
    });
    RCAdapter.getUnloggedCalls.mockResolvedValueOnce({
      calls: [
        {
          sessionId: 'session-1',
          direction: 'Inbound',
          from: { phoneNumber: '16505550100' },
          to: { phoneNumber: '18005550100' },
        },
      ],
      hasMore: false,
    });
    vi.mocked(contactCore.getContact).mockResolvedValueOnce({
      matched: true,
      contactInfo: [{ id: 'contact-1', name: 'Jane', type: 'Lead' }],
    });
    vi.mocked(logUtil.getLogConflictInfo).mockResolvedValueOnce({
      hasConflict: false,
      autoSelectAdditionalSubmission: { disposition: 'Demo' },
    });
    vi.mocked(logCore.getLog).mockResolvedValueOnce({
      callLogs: [{ sessionId: 'session-1', matched: false }],
    });
    const service = await loadLogService();

    await service.retroAutoCallLog({
      manifest: { serverUrl: 'https://server.example' },
      platformName: 'salesforce',
      platform: { name: 'salesforce' },
    });

    expect(logCore.addLog).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      logType: 'Call',
      contactId: 'contact-1',
      contactType: 'Lead',
      contactName: 'Jane',
      additionalSubmission: { disposition: 'Demo' },
      isShowNotification: false,
    }));
    expect(dispositionCore.upsertDisposition).toHaveBeenCalledWith({
      serverUrl: 'https://server.example',
      logType: 'Call',
      sessionId: 'session-1',
      dispositions: {
        disposition: 'Demo',
        note: 'cached note',
      },
      rcAdditionalSubmission: {},
    });
    expect(dismissNotification).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith({
      level: 'success',
      message: 'Historical call syncing finished. 1 call(s) synced.',
      ttl: 5000,
    });
  });

  it('forces call-log matcher check when server-side logging is enabled and CRM is authed', async () => {
    seedStorage({
      crmAuthed: true,
      userSettings: {
        serverSideLogging: {
          enable: true,
        },
      },
    });
    RCAdapter.getUnloggedCalls.mockResolvedValueOnce({
      calls: [{ sessionId: 'session-1' }, { sessionId: 'session-2' }],
      hasMore: false,
    });
    const service = await loadLogService();

    await service.forceCallLogMatcherCheck();

    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds: ['session-1', 'session-2'],
      },
      targetOrigin: '*',
    });
  });

  it('syncs call data with recording download link when recording is ready', async () => {
    const service = await loadLogService();

    await service.syncCallData({
      serverUrl: 'https://server.example',
      dataBody: {
        call: {
          sessionId: 'session-1',
          telephonySessionId: 'telephony-1',
          recording: {
            link: 'https://recording.example/play',
            contentUri: 'https://recording.example/content',
          },
          startTime: '2026-07-02T09:00:00Z',
          duration: 60,
          result: 'Call connected',
          direction: 'Inbound',
          from: { phoneNumber: '16505550100' },
          to: { phoneNumber: '18005550100' },
        },
        aiNote: 'AI note',
        transcript: 'Transcript',
      },
    });

    expect(getRcAccessToken).toHaveBeenCalled();
    expect(logCore.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      serverUrl: 'https://server.example',
      logType: 'Call',
      telephonySessionId: 'telephony-1',
      sessionId: 'session-1',
      recordingLink: 'https://recording.example/play',
      recordingDownloadLink: 'https://recording.example/content?accessToken=rc-access-token',
      note: 'cached note',
      aiNote: 'AI note',
      transcript: 'Transcript',
    }));
  });
});
