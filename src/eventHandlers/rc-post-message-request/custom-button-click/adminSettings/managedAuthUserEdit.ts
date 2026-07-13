import managedAuthUserEditPage from '../../../../components/admin/managedAuthUserEditPage';
import { getRcContactInfo } from '../../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  listButtonItemId: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, listButtonItemId }: EventOptions): Promise<void> {
  const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings?: UnknownRecord | null };
  const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
  const selectedExtension = rcExtensions.find((rc) => rc.id === listButtonItemId);
  const page = managedAuthUserEditPage.getManagedAuthUserEditPageRender({
    userFields: managedAuthSettings?.userFields ?? [],
    userValues: managedAuthSettings?.userValues ?? [],
    rcExtension: selectedExtension,
    formData: {
      rcExtensionId: selectedExtension?.id ?? '',
    },
    searchWord: data.body.button.formData?.userSearch?.search ?? '',
    filter: data.body.button.formData?.userSearch?.filter ?? 'All',
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${page.id}`,
  }, '*');
}

export default {
  onEvent,
};
