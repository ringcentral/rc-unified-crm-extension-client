import { getLogRecordSubmissionPageRender } from '../../../../components/logRecordSubmissionPage';
import logRecorder from '../../../../lib/logRecorder';

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
  void logRecorder;
  // TEMP: add banner for webinar info
  if (data.body.button.id === 'temp-webinar-banner' && data.body.button.dismissed) {
    await chrome.storage.local.set({ myBannerDismissedDate: new Date().getDate() });
    return;
  }
  if (!data.body.button.dismissed) {
    // close recording banner
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-update-customized-banner',
      banner: {
        id: 'log-recording-banner',
        hidden: true,
      },
    }, '*');
    const logRecordSubmissionPageRender = getLogRecordSubmissionPageRender({});
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: logRecordSubmissionPageRender,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${logRecordSubmissionPageRender.id}`, // page id
    }, '*');
  }
}

export default {
  onEvent,
};
