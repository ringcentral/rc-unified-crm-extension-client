import logRecorder from '../../../../lib/logRecorder';
import { showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  void platform;
  const { issueDescription } = await chrome.storage.local.get('issueDescription') as { issueDescription?: string };
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    logRecorder.logAction({ name: 'user description', data: issueDescription });
    await logRecorder.stopRecordingLogs();
    await logRecorder.uploadLogs({ serverUrl: manifest.serverUrl });
    showNotification({ level: 'success', message: 'Successfully uploaded.', ttl: 3000 });
  } catch (error) {
    console.error('Error uploading logs:', error);
    showNotification({ level: 'error', message: 'Failed to upload logs. Please try again.', ttl: 3000 });
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');

  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack', // page id
  }, '*');
}

export default {
  onEvent,
};
