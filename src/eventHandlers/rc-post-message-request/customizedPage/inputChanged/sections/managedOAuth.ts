import managedOAuthAdminPage from '../../../../../components/admin/managedOAuthAdminPage';

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent(): Promise<void> {
  const page = managedOAuthAdminPage.getManagedOAuthAdminPageRender();
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
