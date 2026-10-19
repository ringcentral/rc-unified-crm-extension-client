import { getErrorLogRecordPageRender } from '../../../../../components/errorLogRecordPage';

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
  if (data.body.keys.some((k: unknown) => k === 'issueDescription' || k === 'errorLogRecordPageNextStepButton')) {
    const page = getErrorLogRecordPageRender({ step: 1, email: data.body.formData.email, issueDescription: data.body.formData.issueDescription });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${page.id}`, // page id
    }, '*');
  }
}

export default {
  onEvent,
};
