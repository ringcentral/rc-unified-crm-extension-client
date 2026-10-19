import { getRcInfo } from '../../../../lib/util';
import logRecorder from '../../../../lib/logRecorder';
import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';

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
  void platformName;
  void platform;
  const page = getErrorLogRecordPageRender({
    step: 3,
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
  await logRecorder.startRecordingLogs();
  // Start with saving user basic info
  const version = manifest.version;
  const rcInfo = await getRcInfo();
  const basicInfo = {
    platformInfo,
    rcUserInfo: {
      accountInfo: rcInfo.value.cachedData.accountInfo,
      extensionInfo: rcInfo.value.cachedData.extensionInfo,
    },
    version,
  };
  logRecorder.logBasicInfo(basicInfo);
}

export default {
  onEvent,
};
