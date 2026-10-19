import adminCore from '../../../../core/admin';
import userMappingPage from '../../../../components/admin/userMappingPage/userMappingPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
  recordIdFromId?: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, recordIdFromId }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void recordIdFromId;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  const { crmUserId, rcExtensionList } = data.body.button.formData;
  const userMapping = {
    crmUserId: crmUserId.toString(),
    rcExtensionId: rcExtensionList,
  };
  if (adminSettings?.userMappings) {
    const existingUserMapping = adminSettings.userMappings.find((um: UnknownRecord) => um.crmUserId == userMapping.crmUserId);
    if (existingUserMapping) {
      // Case: delete
      if (userMapping.rcExtensionId?.length === 0) {
        adminSettings.userMappings = adminSettings.userMappings.filter((um: UnknownRecord) => um.crmUserId !== existingUserMapping.crmUserId);
      }
      // Case: update
      else {
        existingUserMapping.rcExtensionId = userMapping.rcExtensionId;
      }
    }
    // case: create
    else {
      adminSettings.userMappings.push(
        userMapping,
      );
    }
  }
  else if (userMapping.rcExtensionId?.length > 0) {
    adminSettings.userMappings = [
      userMapping,
    ];
  }
  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
  const updatedUserMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
  const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping: updatedUserMapping, platformDisplayName: platform.displayName });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: userMappingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack', // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
