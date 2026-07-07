// @ts-nocheck
import axios from 'axios';
import { loadModule } from '../helpers/loadModule';
import { getWidgetPostMessages } from '../setup/widgetFrameMock';
import { readStorage } from '../setup/storageHelpers';
import { downloadTextFile } from '../../src/lib/util.ts';

vi.mock('axios', () => ({
  default: {
    defaults: {
      headers: {
        common: {},
      },
    },
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../../src/lib/util.ts', () => ({
  downloadTextFile: vi.fn(),
}));

async function loadLogRecorder() {
  vi.resetModules();
  return loadModule('../../src/lib/logRecorder.ts');
}

describe('logRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.put).mockReset();
    vi.mocked(downloadTextFile).mockReset();
    axios.defaults.headers.common = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts and stops recording with storage, debug header, and widget banner state', async () => {
    const logRecorder = await loadLogRecorder();

    await logRecorder.startRecordingLogs();
    await expect(logRecorder.isRecordingLogs()).resolves.toBe(true);

    expect(readStorage().errorLogRecordingStatus).toBe('recording');
    expect(axios.defaults.headers.common['is-debug']).toBe(true);
    expect(getWidgetPostMessages()).toContainEqual({
      message: {
        type: 'rc-adapter-update-customized-banner',
        banner: expect.objectContaining({
          id: 'log-recording-banner',
          severity: 'warning',
        }),
      },
      targetOrigin: '*',
    });

    await logRecorder.stopRecordingLogs();
    await expect(logRecorder.isRecordingLogs()).resolves.toBe(false);
    expect(readStorage().errorLogRecordingStatus).toBeUndefined();
    expect(axios.defaults.headers.common['is-debug']).toBe(false);
  });

  it('records basic info, user descriptions, API requests, API responses, and navigation actions', async () => {
    const logRecorder = await loadLogRecorder();
    await logRecorder.startRecordingLogs();

    logRecorder.logBasicInfo({ platform: 'salesforce' });
    logRecorder.logAction({ name: 'API_REQUEST', data: { method: 'post', url: 'https://api.example/path?token=hidden' } });
    logRecorder.logAction({ name: 'API_RESPONSE', data: { status: 201, url: 'https://api.example/path?token=hidden' } });
    logRecorder.logAction({ name: 'NAVIGATE', data: { path: '/settings' } });
    logRecorder.logAction({ name: 'user description', data: 'Something broke' });

    expect(logRecorder.getLog()).toMatchObject({
      basicInfo: { platform: 'salesforce' },
      summary: [
        'User description: Something broke',
        'API_REQUEST: POST https://api.example/path',
        'API_RESPONSE: 201 https://api.example/path',
        'NAVIGATE: /settings',
      ],
      details: [
        expect.objectContaining({ timestamp: '2026-07-03T12:00:00.000Z', name: 'API_REQUEST' }),
        expect.objectContaining({ name: 'API_RESPONSE' }),
        expect.objectContaining({ name: 'NAVIGATE' }),
        expect.objectContaining({ name: 'user description' }),
      ],
    });
  });

  it('uploads recorded logs and downloads a local copy on success or failure', async () => {
    const logRecorder = await loadLogRecorder();
    await logRecorder.startRecordingLogs();
    logRecorder.logAction({ name: 'NAVIGATE', data: { path: '/settings' } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { presignedUrl: 'https://upload.example/report' } });
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });

    await expect(logRecorder.uploadLogs({ serverUrl: 'https://server.example' })).resolves.toBe(true);
    expect(axios.get).toHaveBeenCalledWith('https://server.example/debug/report/url');
    expect(axios.put).toHaveBeenCalledWith(
      'https://upload.example/report',
      expect.stringContaining('"summary"'),
      {
        skipAuthorization: true,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    expect(downloadTextFile).toHaveBeenCalledWith({
      filename: 'error-log-report.json',
      text: expect.stringContaining('"summary"'),
    });

    await logRecorder.startRecordingLogs();
    logRecorder.logAction({ name: 'NAVIGATE', data: { path: '/support' } });
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network'));
    await expect(logRecorder.uploadLogs({ serverUrl: 'https://server.example' })).resolves.toBe(false);
    expect(downloadTextFile).toHaveBeenCalledTimes(2);
  });
});
