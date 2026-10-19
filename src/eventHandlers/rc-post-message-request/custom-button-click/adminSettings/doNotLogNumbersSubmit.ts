import adminCore from '../../../../core/admin';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import embeddableServices from '../../../../service/embeddableServices';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  adminSettings.userSettings.serverSideLogging.doNotLogNumbers = data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? '';
  const { userSettings } = await userCore.refreshUserSettings({
    changedSettings: {
      serverSideLogging:
      {
        doNotLogNumbers: data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? '',
      },
    },
  }) as UnknownRecord;
  void userSettings;
  await chrome.storage.local.set({ adminSettings });
  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-third-party-service',
    service: (await embeddableServices.getServiceManifest()),
  }, '*');
  await adminCore.updateServerSideDoNotLogNumbers({ platform, doNotLogNumbers: data.body.button.formData.doNotLogNumbersHolder.doNotLogNumbers ?? '' });
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
}

export default {
  onEvent,
};
