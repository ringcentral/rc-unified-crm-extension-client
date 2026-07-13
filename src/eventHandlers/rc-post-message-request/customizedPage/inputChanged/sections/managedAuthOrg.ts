import managedAuthOrgPage from '../../../../../components/admin/managedAuthOrgPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data }: EventOptions): Promise<void> {
  const { managedAuthSettings } = await chrome.storage.local.get({ managedAuthSettings: null }) as { managedAuthSettings: UnknownRecord | null };
  const page = managedAuthOrgPage.getManagedAuthOrgPageRender({
    orgFields: managedAuthSettings?.orgFields ?? [],
    orgValues: managedAuthSettings?.orgValues ?? {},
    formData: data.body.formData,
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
