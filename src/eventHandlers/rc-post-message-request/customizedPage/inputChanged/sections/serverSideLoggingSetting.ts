import adminCore from '../../../../../core/admin';
import serverSideLoggingPage from '../../../../../components/admin/serverSideLoggingPage';

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
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const serverSideLoggingSubscription = await adminCore.getServerSideLogging({ platform });
  const subscriptionLevel = serverSideLoggingSubscription.subscribed ? serverSideLoggingSubscription.subscriptionLevel : 'Disable';
  const sources = serverSideLoggingSubscription.sources ?? ['ex'];
  const additionalFieldValues = await adminCore.getServerSideLoggingAdditionalFieldValues({ platform });
  const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as { implementedInterfaces: UnknownRecord | null };
  const enableUserMapping = implementedInterfaces?.getUserList;
  const { userPermissions } = await chrome.storage.local.get({ userPermissions: {} }) as { userPermissions: UnknownRecord };
  const serverSideLoggingSettingPageRender = serverSideLoggingPage.getServerSideLoggingSettingPageRender({
    subscriptionLevel: serverSideLoggingSubscription.subscribedByOtherAdmin ? serverSideLoggingSubscription.subscribedByOtherAdmin.setting.subscriptionLevel : subscriptionLevel,
    doNotLogNumbers: serverSideLoggingSubscription.subscribedByOtherAdmin ? serverSideLoggingSubscription.subscribedByOtherAdmin.setting.doNotLogNumbers : serverSideLoggingSubscription.doNotLogNumbers,
    loggingByAdmin: serverSideLoggingSubscription.subscribedByOtherAdmin ? serverSideLoggingSubscription.subscribedByOtherAdmin.setting.loggingByAdmin : serverSideLoggingSubscription.loggingByAdmin,
    subscribedByOtherAdmin: serverSideLoggingSubscription.subscribedByOtherAdmin,
    enableUserMapping,
    additionalFields: platform.serverSideLogging?.additionalFields ?? [],
    additionalFieldValues,
    sources,
    userPermissions,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: serverSideLoggingSettingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${serverSideLoggingSettingPageRender.id}`, // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
