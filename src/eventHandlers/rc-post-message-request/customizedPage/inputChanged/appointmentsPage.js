import { responseMessage } from '../../../../lib/util';
import appointmentsPage from '../../../../components/appointmentsPage/appointmentsPage';

async function onEvent({ data, manifest }) {
  try {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const tab = data?.body?.formData?.tab ?? 'upcoming';
    const scope = data?.body?.formData?.scope ?? 'mine';
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab,
      scope,
      forceSync: false,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customizedTabs/${updated.id}`,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    responseMessage(data.requestId, { data: 'ok' });
  }
}

exports.onEvent = onEvent;

