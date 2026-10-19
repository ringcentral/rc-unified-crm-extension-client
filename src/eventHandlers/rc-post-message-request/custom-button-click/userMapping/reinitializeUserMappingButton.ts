import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  await adminCore.reinitializeUserMapping({ serverUrl: manifest.serverUrl });
  showNotification({ level: 'success', message: 'User mapping reinitialized.', ttl: 5000 });
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
