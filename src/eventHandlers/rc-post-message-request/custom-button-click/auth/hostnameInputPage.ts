import embeddableServices from '../../../../service/embeddableServices';
import authCore from '../../../../core/auth';
import { getManifest, saveManifest } from '../../../../service/manifestService';

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
  void platformInfo;
  void platformName;
  void platform;
  let inputUrl = '';
  switch (manifest.platforms[data.body.button.formData.platformId].environment.type) {
    case 'selectable':
      inputUrl = data.body.button.formData.selection;
      break;
    case 'dynamic':
      inputUrl = data.body.button.formData.url;
      break;
    case 'fixed':
      inputUrl = manifest.platforms[data.body.button.formData.platformId].environment.url;
      break;
  }
  const inputUrlObj = new URL(inputUrl);
  const inputHostname = inputUrlObj.hostname;
  await chrome.storage.local.set({
    ['platform-info']: {
      platformName: data.body.button.formData.platformId,
      platformDisplayName: data.body.button.formData.platformDisplayName,
      hostname: inputHostname,
      connectorId: data.body.button.formData.connectorId ?? '',
      isPrivate: !!data.body.button.formData.isPrivate,
    },
  });
  const refreshedManifest = await getManifest(true) as UnknownRecord;
  await saveManifest({ manifest: refreshedManifest as any });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-third-party-service',
    service: (await embeddableServices.getServiceManifest()),
  }, '*');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/settings',
  }, '*');
  const selectedPlatform = refreshedManifest.platforms[data.body.button.formData.platformId];
  const managedOAuthResult = await authCore.checkManagedOAuthBeforeCrmVisible({
    manifest: refreshedManifest,
    platformName: data.body.button.formData.platformId,
    platform: selectedPlatform,
  });
  if (managedOAuthResult.blocked) {
    return;
  }
  await authCore.onUserClickConnectButton({
    platform: selectedPlatform,
    platformName: data.body.button.formData.platformId,
    manifest: refreshedManifest,
  });
}

export default {
  onEvent,
};
