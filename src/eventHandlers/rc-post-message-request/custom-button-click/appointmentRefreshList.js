import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';
import { extractAppointmentsListContext } from '../../../lib/appointmentUtils';

async function onEvent({ data, manifest }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    const { tab, searchWithFilters } = extractAppointmentsListContext(data);
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab,
      searchWithFilters,
      forceSync: true,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

