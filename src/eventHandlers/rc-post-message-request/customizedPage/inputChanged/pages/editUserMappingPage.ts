import editUserMappingPage from '../../../../../components/admin/userMappingPage/editUserMappingPage';

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
  if (data.body.formData.searchWord) {
    const editUserMappingPageRender = editUserMappingPage.renderEditUserMappingPage({
      userMapping: data.body.formData.userMapping,
      platformDisplayName: platform.displayName,
      rcExtensions: data.body.formData.rcExtensions,
      selectedRcExtensionId: data.body.formData.rcExtensionList,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: editUserMappingPageRender,
    });
  }
}

export default {
  onEvent,
};
