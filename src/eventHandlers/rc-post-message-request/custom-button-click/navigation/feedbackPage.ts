type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platform;
  const { rcUserInfo } = await chrome.storage.local.get('rcUserInfo') as { rcUserInfo: UnknownRecord };
  let formUrl = manifest.platforms[platformName].page.feedback.url;
  for (const formKey of Object.keys(data.body.button.formData)) {
    formUrl = formUrl.replace(`{${formKey}}`, encodeURIComponent(data.body.button.formData[formKey]));
  }
  formUrl = formUrl
    .replace('{crmName}', manifest.platforms[platformName].displayName)
    .replace('{userName}', rcUserInfo.rcUserName)
    .replace('{userEmail}', rcUserInfo.rcUserEmail)
    .replace('{version}', manifest.version);
  window.open(formUrl, '_blank');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: 'goBack',
  }, '*');
}

export default {
  onEvent,
};
