import managedAuthUserPage from '../../../../../components/admin/managedAuthUserPage';
import { getRcContactInfo } from '../../../../../lib/util';

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent(): Promise<void> {
  const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings: UnknownRecord | null };
  const rcExtensions = (await getRcContactInfo()).filter(rc => rc.type === 'User' || rc.type === 'Department');
  const page = managedAuthUserPage.getManagedAuthUserPageRender({
    userFields: managedAuthSettings?.userFields ?? [],
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

export default {
  onEvent,
};
