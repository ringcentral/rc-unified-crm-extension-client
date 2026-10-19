import contactCore from '../../../../core/contact';
import editUserMappingPage from '../../../../components/admin/userMappingPage/editUserMappingPage';
import { getRcContactInfo } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform: UnknownRecord;
  listButtonItemId: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform, listButtonItemId }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void contactCore;
  const userMappingToEdit = data.body.button.formData.allUserMapping.find((um: UnknownRecord) => um.crmUser.id == listButtonItemId);
  const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type == 'User' || rc.type == 'Department');
  const editUserMappingPageRender = editUserMappingPage.renderEditUserMappingPage({
    userMapping: userMappingToEdit,
    platformDisplayName: platform.displayName,
    rcExtensions,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: editUserMappingPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${editUserMappingPageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
