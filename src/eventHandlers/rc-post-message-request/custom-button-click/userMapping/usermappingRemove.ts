import adminCore from '../../../../core/admin';
import userMappingPage from '../../../../components/admin/userMappingPage/userMappingPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
  listButtonItemId: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { adminSettings } = await chrome.storage.local.get('adminSettings') as { adminSettings: UnknownRecord };
  adminSettings.userMappings.find((um: UnknownRecord) => um.crmUserId == listButtonItemId).rcExtensionId = [];
  await adminCore.uploadAdminSettings({ serverUrl: manifest.serverUrl, adminSettings });
  const updatedUserMapping = await adminCore.getUserMapping({ serverUrl: manifest.serverUrl });
  const userMappingPageRender = userMappingPage.getUserMappingPageRender({ userMapping: updatedUserMapping, platformDisplayName: platform.displayName });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: userMappingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${userMappingPageRender.id}`, // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
