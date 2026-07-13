import managedAuthUserEditPage from '../../../../../components/admin/managedAuthUserEditPage';
import { getRcContactInfo } from '../../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings?: UnknownRecord | null };
  const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
  const selectedExtension = rcExtensions.find((rc) => rc.id === data.body.formData.rcExtensionId);
  const page = managedAuthUserEditPage.getManagedAuthUserEditPageRender({
    userFields: managedAuthSettings?.userFields ?? [],
    userValues: managedAuthSettings?.userValues ?? [],
    rcExtension: selectedExtension,
    formData: data.body.formData,
    searchWord: data.body.formData?.searchWord ?? '',
    filter: data.body.formData?.filter ?? 'All',
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  });
}

export default {
  onEvent,
};
