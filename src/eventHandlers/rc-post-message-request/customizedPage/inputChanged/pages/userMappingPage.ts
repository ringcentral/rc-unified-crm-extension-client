import userMappingPage from '../../../../../components/admin/userMappingPage/userMappingPage';

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
  void manifest;
  void platformInfo;
  void platformName;
  // Case: user search in userMappingList
  if (data.body.formData.userSearch) {
    const userMappingPageRender = userMappingPage.getUserMappingPageRender({
      userMapping: data.body.formData.allUserMapping,
      platformDisplayName: platform.displayName,
      searchWord: data.body.formData.userSearch.search,
      filter: data.body.formData.userSearch.filter,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: userMappingPageRender,
    });
  }
}

export default {
  onEvent,
};
