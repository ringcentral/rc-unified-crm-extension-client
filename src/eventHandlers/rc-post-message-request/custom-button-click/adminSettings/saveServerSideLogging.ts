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
  responseMessage: (requestId: unknown, response: unknown) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, responseMessage }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  responseMessage(data.requestId, { data: 'ok' }); // Response to widget to avoid timeout error
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  adminSettings.userSettings.serverSideLogging =
  {
    enable: data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable',
    loggingLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging,
  };
  const { userSettings } = await userCore.refreshUserSettings({
    changedSettings: {
      serverSideLogging:
      {
        enable: data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable',
        loggingLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging,
      },
    },
  }) as UnknownRecord;
  void userSettings;
  await chrome.storage.local.set({ adminSettings });
  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
  if (data.body.button.formData.serverSideLoggingHolder.serverSideLogging != 'Disable') {
    await adminCore.enableServerSideLogging({
      serverUrl: manifest.serverUrl,
      platform,
      subscriptionLevel: data.body.button.formData.serverSideLoggingHolder.serverSideLogging,
      loggingByAdmin: data.body.button.formData.serverSideLoggingHolder.activityRecordOwner === 'admin',
      sources: data.body.button.formData.serverSideLoggingHolder.sources,
    });
  }
  else {
    await adminCore.disableServerSideLogging({ platform });
    showNotification({ level: 'success', message: 'Server side logging turned OFF.', ttl: 5000 });
  }
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-third-party-service',
    service: (await embeddableServices.getServiceManifest()),
  }, '*');
  const updateSSCLFieldsResponse = await adminCore.uploadServerSideLoggingAdditionalFieldValues({ platform, formData: data.body.button.formData });
  if (updateSSCLFieldsResponse) {
    if (updateSSCLFieldsResponse.successful) {
      showNotification({ level: 'success', message: 'Server side logging do not log numbers updated.', ttl: 5000 });
      getWidgetFrameWindow().postMessage({
        type: 'rc-adapter-navigate-to',
        path: 'goBack',
      }, '*');
    }
    else {
      showNotification({ level: updateSSCLFieldsResponse.returnMessage.messageType, message: updateSSCLFieldsResponse.returnMessage.message, ttl: updateSSCLFieldsResponse.returnMessage.ttl });
    }
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
