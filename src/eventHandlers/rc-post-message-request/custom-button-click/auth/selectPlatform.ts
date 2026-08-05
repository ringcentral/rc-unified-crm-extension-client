import axios from 'axios';
import { saveManifest, saveManifestUrl } from '../../../../service/manifestService';
import hostnameInputPage from '../../../../components/hostnameInputPage';
import authCore from '../../../../core/auth';
import baseManifest from '../../../../manifest.json';
import { getRcInfo } from '../../../../lib/util';
import embeddableServices from '../../../../service/embeddableServices';
import { getImplementedInterfaces } from '../../../../service/implementedInterfacesService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
  listButtonItemId: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const selectedPlatformId = listButtonItemId.split('=')[0];
  const selectedPlatformType = listButtonItemId.split('=')[1];
  const selectedPlatform = data.body.button.formData.platformList.find((platformItem: UnknownRecord) => platformItem.id === selectedPlatformId);
  // eslint-disable-next-line no-param-reassign
  platformName = selectedPlatform.name;
  let platformManifestResponse: UnknownRecord | undefined;
  const rcInfo = await getRcInfo();
  const isPrivate = selectedPlatformType === 'private' || selectedPlatformType === 'shared';
  const devRcAccountId = isPrivate
    ? selectedPlatform.accountId ?? rcInfo.value?.cachedData?.accountInfo?.id
    : '';
  switch (selectedPlatformType) {
    case 'public':
      platformManifestResponse = await axios.get(`${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?type=connector`);
      await saveManifestUrl({ manifestUrl: `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?type=connector` });
      break;
    case 'shared':
      let sharedManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${selectedPlatform.accountId}`;
      try {
        platformManifestResponse = await axios.get(sharedManifestUrl);
      }
      catch (e: any) {
        if (e.response.status === 404) {
          sharedManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${selectedPlatform.accountId}`;
          platformManifestResponse = await axios.get(sharedManifestUrl);
        }
        else {
          throw e;
        }
      }
      await saveManifestUrl({ manifestUrl: sharedManifestUrl });
      break;
    case 'private':
      let privateManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${rcInfo.value?.cachedData?.accountInfo?.id}`;
      try {
        platformManifestResponse = await axios.get(privateManifestUrl);
      }
      catch (e: any) {
        if (e.response.status === 404) {
          privateManifestUrl = `${baseManifest.platformPublicListUrl}/${selectedPlatform.id}/manifest?access=internal&type=connector&accountId=${rcInfo.value?.cachedData?.accountInfo?.id}`;
          platformManifestResponse = await axios.get(privateManifestUrl);
        }
        else {
          throw e;
        }
      }
      await saveManifestUrl({ manifestUrl: privateManifestUrl });
      break;
  }
  // eslint-disable-next-line no-param-reassign
  manifest = await saveManifest({ manifest: platformManifestResponse!.data as any }) as UnknownRecord;
  await getImplementedInterfaces({ manifest, platformName: selectedPlatform.name });
  if (manifest.platforms[selectedPlatform.name]?.environment?.type === 'fixed' && !manifest.platforms[selectedPlatform.name]?.environment?.instructions?.length) {
    const inputUrlObj = new URL(manifest.platforms[selectedPlatform.name]?.environment?.url);
    const inputHostname = inputUrlObj.hostname;
    await chrome.storage.local.set({
      ['platform-info']: {
        platformName: selectedPlatform.name,
        platformDisplayName: selectedPlatform.displayName ?? selectedPlatform.name,
        hostname: inputHostname,
        connectorId: selectedPlatform.id,
        devRcAccountId,
        isPrivate,
      },
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-third-party-service',
      service: (await embeddableServices.getServiceManifest()),
    }, '*');
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: '/settings',
    }, '*');
    const managedOAuthResult = await authCore.checkManagedOAuthBeforeCrmVisible({
      manifest,
      platformName: selectedPlatform.name,
      platform: manifest.platforms[selectedPlatform.name],
    });
    if (managedOAuthResult.blocked) {
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
      return;
    }
    await authCore.onUserClickConnectButton({
      platform: manifest.platforms[selectedPlatform.name],
      platformName: selectedPlatform.name,
      manifest,
    });
  }
  else {
    const selectedPlatformConfig = manifest.platforms[selectedPlatform.name];
    const managedAuthState = selectedPlatformConfig?.auth?.type === 'apiKey'
      ? await authCore.getManagedAuthState({
        serverUrl: manifest.serverUrl,
        platformName: selectedPlatform.name,
        connectorId: selectedPlatform.id,
        devRcAccountId,
        isPrivate,
        rcInfo,
      })
      : null;
    const hostnameInputPageRender = hostnameInputPage.getHostnameInputPageRender({
      platform: selectedPlatformConfig,
      isUrlValid: true,
      submitText: managedAuthState?.allRequiredFieldsSatisfied ? 'Connect' : undefined,
      readyMessage: managedAuthState?.allRequiredFieldsSatisfied
        ? `All required authentication fields are ready. Click Connect to connect to ${selectedPlatformConfig.displayName ?? selectedPlatformConfig.name}.`
        : '',
      connectorId: selectedPlatform.id,
      devRcAccountId,
      isPrivate,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: hostnameInputPageRender,
    }, '*');
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${hostnameInputPageRender.id}`,
    }, '*');
  }
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
