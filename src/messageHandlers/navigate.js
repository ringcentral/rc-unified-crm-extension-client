import feedbackPage from '../components/feedbackPage';
import supportPage from '../components/supportPage';
import axios from 'axios';
import { getManifest } from '../service/manifestService';
import { getPlatformInfo } from '../service/platformService';
import { trackOpenFeedback } from '../lib/analytics';

async function onMessage({ request, sendResponse }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  const manifest = await getManifest();
  const platformInfo = await getPlatformInfo();
  const platformName = platformInfo?.platformName ?? '';;
  if (request.path === '/feedback') {
    const feedbackPageRender = feedbackPage.getFeedbackPageRender({ pageConfig: manifest.platforms[platformName].page.feedback, version: manifest.version });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: feedbackPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
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
      isOnline = false;
    }
    const supportPageRender = supportPage.getSupportPageRender({ manifest, platformName, isOnline });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: supportPageRender
    });
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: '/customized/supportPage', // page id
    }, '*');
  }
  else {
    document.querySelector("#rc-widget-adapter-frame").contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: request.path, // '/meeting', '/dialer', '//history', '/settings'
    }, '*');
  }
  sendResponse({ result: 'ok' });
  window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
}

exports.onMessage = onMessage;