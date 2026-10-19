import adminCore from '../../../../../core/admin';
import managedAuthenticationPage from '../../../../../components/admin/managedAuthenticationPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
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
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const managedAuthSettings = await adminCore.getManagedAuthSettings({ serverUrl: manifest.serverUrl });
  const page = managedAuthenticationPage.getManagedAuthenticationPageRender({
    hasOrgFields: (managedAuthSettings?.orgFields ?? []).length > 0,
    hasUserFields: (managedAuthSettings?.userFields ?? []).length > 0,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${page.id}`,
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
