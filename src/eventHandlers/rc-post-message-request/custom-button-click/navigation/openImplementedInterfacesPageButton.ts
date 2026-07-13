import implementedInterfacesPage from '../../../../components/developerSettingsPage/implementedInterfacesPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  const { implementedInterfaces } = await chrome.storage.local.get({ implementedInterfaces: null }) as { implementedInterfaces?: unknown };
  const implementedInterfacesPageRender = implementedInterfacesPage.getImplementedInterfacesPageRender({ implementedInterfaces });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: implementedInterfacesPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/implementedInterfacesPage', // page id
  }, '*');
}

export default {
  onEvent,
};
