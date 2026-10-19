import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  manifest: UnknownRecord;
  platformName: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ manifest, platformName }: EventOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    await adminCore.deleteManagedOAuthAccount({
      serverUrl: manifest.serverUrl,
      platformName,
    });
  }
  catch (error) {
    void error;
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'error', message: 'Failed to delete managed OAuth account. Please try again.', ttl: 3000 });
    return;
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  showNotification({ level: 'success', message: 'Managed OAuth account deleted.', ttl: 3000 });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
}

export default {
  onEvent,
};
