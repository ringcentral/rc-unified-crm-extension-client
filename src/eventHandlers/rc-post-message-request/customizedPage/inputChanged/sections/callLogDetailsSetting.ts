import callLogDetailsSettingPage from '../../../../../components/admin/managedSettings/callAndSMSLoggingSetting/callLogDetailsSettingPage';
import adminCore from '../../../../../core/admin';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings?: UnknownRecord };
  const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} }) as { userPermissions: UnknownRecord };
  let serverSideLoggingSubscribed = adminSettings?.userSettings?.serverSideLogging?.enable ?? false;
  if (serverSideLoggingSubscribed) {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
      const serverSideLogging = await adminCore.getServerSideLogging({ platform });
      serverSideLoggingSubscribed = serverSideLogging?.subscribed ?? false;
    } catch (error) {
      console.error('Error getting server side logging:', error);
      serverSideLoggingSubscribed = false;
    }
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
  const callLogDetailsSettingPageRender = callLogDetailsSettingPage.getCallLogDetailsSettingPageRender({
    adminUserSettings: adminSettings?.userSettings,
    userPermissions,
    serverSideLoggingSubscribed,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: callLogDetailsSettingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${callLogDetailsSettingPageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
