import userCore from '../../../../core/user';
import authCore from '../../../../core/auth';
import { trackFactoryReset } from '../../../../lib/analytics';
import { clearPlatformInfo } from '../../../../service/platformService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
  if (rcUnifiedCrmExtJwt) {
    await userCore.updateSSCLToken({ serverUrl: manifest.serverUrl, platform, token: '' });
    await authCore.unAuthorize({ serverUrl: manifest.serverUrl, rcUnifiedCrmExtJwt });
    if (platform.useLicense) {
      await authCore.refreshLicenseStatus({ serverUrl: manifest.serverUrl });
    }
  }
  await clearPlatformInfo();
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-logout',
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  trackFactoryReset();
}

export default {
  onEvent,
};
