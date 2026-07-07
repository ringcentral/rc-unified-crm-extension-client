import userCore from '../../../../core/user';
import googleSheetsPage from '../../../../components/platformSpecific/googleSheetsPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data?: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void data;
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const userSettings = await userCore.refreshUserSettings({
    changedSettings: {
      googleSheetsName: {
        value: '',
      },
      googleSheetsUrl: {
        value: '',
      },
    },
  });
  if (!userSettings) {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    return;
  }
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: googleSheetsPage.renderGoogleSheetsPage({ manifest, userSettings }),
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: '/customized/googleSheetsPage', // page id
  }, '*');
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onEvent,
};
