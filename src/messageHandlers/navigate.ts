import feedbackPage from '../components/feedbackPage';
import supportPage from '../components/supportPage';
import axios from 'axios';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import { trackOpenFeedback } from '../lib/analytics';
import { getRcInfo } from '../lib/util';

type UnknownRecord = Record<string, any>;

type MessageHandlerOptions = {
  request: UnknownRecord;
  sendResponse: (response: { result: string }) => void;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onMessage({ request, sendResponse }: MessageHandlerOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const manifest = await getManifest() as UnknownRecord;
  const platformInfo = await getPlatformInfo() as UnknownRecord | null | undefined;
  const platformName = platformInfo?.platformName ?? '';
  if (request.path === '/feedback') {
    const feedbackPageRender = feedbackPage.getFeedbackPageRender({ pageConfig: manifest.platforms[platformName].page.feedback, version: manifest.version });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: feedbackPageRender,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${feedbackPageRender.id}`, // '/meeting', '/dialer', '//history', '/settings'
    }, '*');
    trackOpenFeedback();
  }
  else if (request.path === '/support') {
    let isOnline = false;
    try {
      const isServiceOnlineResponse = await axios.get(`${manifest.serverUrl}/isAlive`);
      isOnline = isServiceOnlineResponse.status === 200;
    }
    catch (e) {
      void e;
      isOnline = false;
    }
    let rcAccountId;
    try {
      const rcInfo = await getRcInfo();
      rcAccountId = rcInfo?.value?.cachedData?.extensionInfo?.account?.id;
    }
    catch (e) {
      void e;
      rcAccountId = null;
    }
    const supportPageRender = supportPage.getSupportPageRender({ manifest, platformName, isOnline, rcAccountId });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: supportPageRender,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: '/customized/supportPage', // page id
    }, '*');
  }
  else {
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: request.path, // '/meeting', '/dialer', '//history', '/settings'
    }, '*');
  }
  sendResponse({ result: 'ok' });
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

export default {
  onMessage,
};
