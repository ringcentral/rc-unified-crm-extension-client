import { getErrorLogRecordPageRender } from '../../../../components/errorLogRecordPage';
import { getRcInfo } from '../../../../lib/util';

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
  const rcUserInfo = await getRcInfo();
  const errorLogRecordPageRender = getErrorLogRecordPageRender({ email: rcUserInfo?.value?.cachedData?.extensionInfo?.contact?.email ?? '' });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page: errorLogRecordPageRender,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${errorLogRecordPageRender.id}`, // page id
  }, '*');
}

export default {
  onEvent,
};
