import axios from 'axios';
import userCore from '../../../../core/user';
import { showNotification } from '../../../../lib/util';
import googleSheetsPage from '../../../../components/platformSpecific/googleSheetsPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void platformInfo;
  void platformName;
  void platform;
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const newSheetResponse = await axios.post(`${manifest.serverUrl}/googleSheets/sheet`,
    {
      name: data.body.button.formData.newSheetName,
    },
  );
  let userSettings;
  if (newSheetResponse.status === 200) {
    userSettings = await userCore.refreshUserSettings({
      changedSettings: {
        googleSheetsName: {
          value: newSheetResponse.data.name,
        },
        googleSheetsUrl: {
          value: newSheetResponse.data.url,
        },
      },
    });
    showNotification({ level: 'success', message: 'New sheet created successfully', ttl: 5000 });
  }
  else {
    showNotification({ level: 'warning', message: 'Failed to create new sheet', ttl: 5000 });
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
