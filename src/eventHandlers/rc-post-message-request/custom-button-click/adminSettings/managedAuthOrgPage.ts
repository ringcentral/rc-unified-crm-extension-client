import adminCore from '../../../../core/admin';
import { showNotification } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest }: EventOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings?: UnknownRecord | null };
    const values: UnknownRecord = {};
    const fieldsToRemove: string[] = [];
    (managedAuthSettings?.orgFields ?? []).forEach((field: UnknownRecord) => {
      const submittedValue = data.body.button.formData[field.const];
      if (submittedValue !== undefined && submittedValue !== '') {
        values[field.const] = submittedValue;
        return;
      }
      if (managedAuthSettings?.orgValues?.[field.const]?.hasValue) {
        fieldsToRemove.push(field.const);
      }
    });
    await adminCore.saveManagedAuthSettings({
      serverUrl: manifest.serverUrl,
      scope: 'account',
      values,
      fieldsToRemove,
    });
  }
  catch (error) {
    void error;
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    showNotification({ level: 'error', message: 'Failed to update account managed authentication. Please try again.', ttl: 3000 });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: 'goBack',
    }, '*');
    return;
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  showNotification({ level: 'success', message: 'Account managed authentication updated.', ttl: 3000 });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
}

export default {
  onEvent,
};
