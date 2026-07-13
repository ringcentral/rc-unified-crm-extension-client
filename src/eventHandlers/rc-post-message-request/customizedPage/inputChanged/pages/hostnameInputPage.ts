import hostnameInputPage from '../../../../../components/hostnameInputPage';
import authCore from '../../../../../core/auth';
import { createDebounceHandler, getRcInfo } from '../../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

const debounceHostnameInputPageUrl = createDebounceHandler('hostnameInputPageUrl', 300);

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

async function renderHostnameInputPage({ data, manifest }: Pick<EventOptions, 'data' | 'manifest'>): Promise<void> {
  let isUrlValid = true;
  const selectedPlatform = manifest.platforms[data.body.formData.platformId];
  if (selectedPlatform?.environment?.url) {
    const urlIdentifierRegex = new RegExp(selectedPlatform.environment.url.replace(/\*/g, '.*'));
    isUrlValid = urlIdentifierRegex.test(data.body.formData.url);
  }
  const rcInfo = await getRcInfo();
  const managedAuthState = selectedPlatform?.auth?.type === 'apiKey'
    ? await authCore.getManagedAuthState({
      serverUrl: manifest.serverUrl,
      platformName: data.body.formData.platformId,
      connectorId: data.body.formData.connectorId ?? '',
      isPrivate: !!data.body.formData.isPrivate,
      rcInfo,
    })
    : null;
  const hostnameInputPageRender = hostnameInputPage.getHostnameInputPageRender(
    {
      platform: selectedPlatform,
      inputUrl: data.body.formData.url,
      selection: data.body.formData.selection,
      isUrlValid,
      submitText: managedAuthState?.allRequiredFieldsSatisfied ? 'Connect' : undefined,
      readyMessage: managedAuthState?.allRequiredFieldsSatisfied
        ? `All required authentication fields are ready. Click Connect to connect to ${selectedPlatform.displayName ?? selectedPlatform.name}.`
        : '',
      connectorId: data.body.formData.connectorId ?? '',
      isPrivate: !!data.body.formData.isPrivate,
    });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: hostnameInputPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${hostnameInputPageRender.id}`, // page id
  }, '*');
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  const selectedPlatform = manifest.platforms[data.body.formData.platformId];
  const changedKeys = Array.isArray(data.body.keys) ? data.body.keys : [];
  const shouldDebounceUrlInput = selectedPlatform?.environment?.type === 'dynamic' && changedKeys.includes('url');

  if (shouldDebounceUrlInput) {
    debounceHostnameInputPageUrl({ data, manifest }, renderHostnameInputPage);
    return;
  }

  await renderHostnameInputPage({ data, manifest });
}

export default {
  onEvent,
};
