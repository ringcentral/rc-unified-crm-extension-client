import contactSearch from '../../../../core/customContactSearch';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const contactToBeSearch = data.body.button.formData.contactNameToSearch;
  const customContactSearchResponse = await contactSearch.getCustomContactSearchData({ serverUrl: manifest.serverUrl, platform, contactSearch: contactToBeSearch, pageId: 'contactSearchResultCallLog', contactPhoneNumber: data.body.button.formData?.contactPhoneNumber });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: customContactSearchResponse,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${customContactSearchResponse.id}`,
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
