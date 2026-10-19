import managedAuthUserEditPage from '../../../../components/admin/managedAuthUserEditPage';
import { getRcContactInfo } from '../../../../lib/util';
import {
  getCachedManagedAuthOptions,
  getManagedAuthOptionsContextKey,
} from '../../../../service/managedAuthOptionsService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  listButtonItemId: string;
  platformName?: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, listButtonItemId, platformName }: EventOptions): Promise<void> {
  const storage = await chrome.storage.local.get({
    managedAuthSettings: null,
    'platform-info': null,
  }) as UnknownRecord;
  const managedAuthSettings = storage.managedAuthSettings as UnknownRecord | null;
  const platformInfo = storage['platform-info'] as UnknownRecord | null;
  const contextKey = getManagedAuthOptionsContextKey({
    platformName: platformName ?? platformInfo?.platformName ?? '',
    connectorId: platformInfo?.connectorId ?? '',
    mode: 'user',
  });
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
    dynamicOptions: getCachedManagedAuthOptions(contextKey),
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
