import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest?: UnknownRecord;
  platformInfo?: UnknownRecord;
  platformName?: string;
  platform?: UnknownRecord;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformInfo, platformName, platform }: EventOptions): Promise<void> {
  void manifest;
  void platformInfo;
  void platformName;
  void platform;
  await chrome.storage.local.set({ issueDescription: data.body.button.formData.issueDescription });
  const page = getErrorLogRecordPageRender({
    step: 2,
    email: data.body.button.formData.email,
    issueDescription: data.body.button.formData.issueDescription,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${page.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
