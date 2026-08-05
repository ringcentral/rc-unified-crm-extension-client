import axios from 'axios';
import { downloadTextFile } from './util';

type UnknownRecord = Record<string, any>;

interface LogState extends UnknownRecord {
  summary?: string[];
  basicInfo?: UnknownRecord;
  details?: Array<{
    timestamp: string;
    name: string;
    data: unknown;
  }>;
  length?: number;
}

let log: LogState = {};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function startRecordingLogs(): Promise<void> {
  log = {
    summary: [],
    basicInfo: {},
    details: [],
  };
  await chrome.storage.local.set({ errorLogRecordingStatus: 'recording' });
  axios.defaults.headers.common['is-debug'] = true;
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-update-customized-banner',
    banner: {
      id: 'log-recording-banner', // banner id, required
      message: 'Recording actions...', // banner message, required
      severity: 'warning', // 'info' | 'warning' | 'error' | 'success', default: 'info'
      action: { // optional, show action button
        label: 'Stop', // action button label, required
        color: 'danger.b04',
      },
    },
  }, '*');
}

export async function stopRecordingLogs(): Promise<void> {
  await chrome.storage.local.remove('errorLogRecordingStatus');
  axios.defaults.headers.common['is-debug'] = false;
}

export async function uploadLogs({ serverUrl }: { serverUrl: string }): Promise<boolean> {
  const logs = getLog();
  try {
    const presignedUrlResponse = await axios.get(`${serverUrl}/debug/report/url`);
    const presignedUrl = presignedUrlResponse.data.presignedUrl;
    const uploadResponse = await axios.put(
      presignedUrl,
      JSON.stringify(logs, null, 2),
      {
        skipAuthorization: true,
        headers: {
          'Content-Type': 'application/json',
        },
      } as any,
    );
    // download the report as json file to local as well
    downloadTextFile({ filename: 'error-log-report.json', text: JSON.stringify(logs, null, 2) });
    clearLog();
    return uploadResponse.status === 200;
  }
  catch (error) {
    void error;
    // download the report as json file to local as well
    downloadTextFile({ filename: 'error-log-report.json', text: JSON.stringify(logs, null, 2) });
    clearLog();
    return false;
  }
}

export async function isRecordingLogs(): Promise<boolean> {
  const { errorLogRecordingStatus } = await chrome.storage.local.get('errorLogRecordingStatus') as {
    errorLogRecordingStatus?: string;
  };
  return errorLogRecordingStatus === 'recording';
}

export function logBasicInfo(data: UnknownRecord): void {
  log.basicInfo = data;
}

export function logAction({ name, data }: { name: string; data: UnknownRecord | string }): void {
  const timestamp = new Date().toISOString();
  let summaryEntry;
  if (name === 'user description') {
    summaryEntry = `User description: ${data}`;
    log.summary!.unshift(summaryEntry);
  } else {
    if (name === 'API_REQUEST') {
      const endpoint = (data as UnknownRecord).url?.split('?')[0];
      summaryEntry = `${name}: ${(data as UnknownRecord).method?.toUpperCase()} ${endpoint}`;
    } else if (name === 'API_RESPONSE') {
      const endpoint = (data as UnknownRecord).url?.split('?')[0];
      summaryEntry = `${name}: ${(data as UnknownRecord).status} ${endpoint}`;
    } else {
      summaryEntry = `${name}: ${(data as UnknownRecord).path}`;
    }
    log.summary!.push(summaryEntry);
  }
  log.details!.push({ timestamp, name, data });
}

export function getLog(): LogState {
  return log;
}

function clearLog(): void {
  log.length = 0;
}

const logRecorder = {
  startRecordingLogs,
  stopRecordingLogs,
  uploadLogs,
  isRecordingLogs,
  logAction,
  getLog,
  logBasicInfo,
};

export default logRecorder;
