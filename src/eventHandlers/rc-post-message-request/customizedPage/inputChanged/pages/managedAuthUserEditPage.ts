import managedAuthUserEditPage from '../../../../../components/admin/managedAuthUserEditPage';
import { getRcContactInfo } from '../../../../../lib/util';
import {
  getCachedManagedAuthOptions,
  getManagedAuthOptionsContextKey,
} from '../../../../../service/managedAuthOptionsService';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  platformName?: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, platformName }: EventOptions): Promise<void> {
  const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings?: UnknownRecord | null };
  const platformStorage = await chrome.storage.local.get({ 'platform-info': null }) as UnknownRecord;
  const platformInfo = platformStorage['platform-info'] as UnknownRecord | null;
  const contextKey = getManagedAuthOptionsContextKey({
    platformName: platformName ?? platformInfo?.platformName ?? '',
    connectorId: platformInfo?.connectorId ?? '',
    mode: 'user',
  });
  const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
  const selectedExtension = rcExtensions.find((rc) => rc.id === data.body.formData.rcExtensionId);
  const page = managedAuthUserEditPage.getManagedAuthUserEditPageRender({
    userFields: managedAuthSettings?.userFields ?? [],
    userValues: managedAuthSettings?.userValues ?? [],
    rcExtension: selectedExtension,
    formData: data.body.formData,
    searchWord: data.body.formData?.searchWord ?? '',
    filter: data.body.formData?.filter ?? 'All',
    dynamicOptions: getCachedManagedAuthOptions(contextKey),
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  });
}

export default {
  onEvent,
};
