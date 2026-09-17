import managedAuthUserPage from '../../../../../components/admin/managedAuthUserPage';
import { getRcContactInfo, showNotification } from '../../../../../lib/util';
import { refreshManagedAuthUserOptions } from '../../../../../service/managedAuthOptionsService';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ manifest, platformName }: UnknownRecord): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const storage = await chrome.storage.local.get({
      managedAuthSettings: null,
      'platform-info': null,
    }) as UnknownRecord;
    const managedAuthSettings = storage.managedAuthSettings as UnknownRecord | null;
    const platformInfo = storage['platform-info'] as UnknownRecord | null;
    const userFields = managedAuthSettings?.userFields ?? [];
    const { errors } = await refreshManagedAuthUserOptions({
      serverUrl: manifest.serverUrl,
      platformName: platformName ?? platformInfo?.platformName ?? '',
      connectorId: platformInfo?.connectorId ?? '',
      userFields,
    });
    errors.forEach((error: any) => {
      showNotification({
        level: 'error',
        message: error?.response?.data?.error?.message ?? error?.response?.data?.error ?? error?.message ?? 'Failed to update managed authentication options.',
        ttl: 5000,
      });
    });
    const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
    const page = managedAuthUserPage.getManagedAuthUserPageRender({
      userFields,
      userValues: managedAuthSettings?.userValues ?? [],
      rcExtensions,
      searchWord: '',
      filter: 'All',
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
  finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
