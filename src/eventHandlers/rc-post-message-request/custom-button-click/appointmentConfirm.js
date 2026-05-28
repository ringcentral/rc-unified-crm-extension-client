import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';
import { updateAppointmentStatus } from '../../../service/appointmentService';
import { extractAppointmentsListContext } from '../../../lib/appointmentUtils';
import { responseMessage, showNotification } from '../../../lib/util';

async function onEvent({ data, manifest, listButtonItemId }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const appointmentId = listButtonItemId ?? data?.body?.button?.additionalInfo?.thirdPartyAppointmentId ?? '';
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
    let updateRes = null;
    if (appointmentId) {
      updateRes = await updateAppointmentStatus({
        serverUrl: manifest.serverUrl,
        jwtToken: rcUnifiedCrmExtJwt,
        appointmentId,
        status: 'confirmed',
      });
      if (updateRes?.returnMessage) {
        showNotification({
          level: updateRes.returnMessage?.messageType,
          message: updateRes.returnMessage?.message,
          ttl: updateRes.returnMessage?.ttl,
          details: updateRes.returnMessage?.details,
        });
      } else if (updateRes?.successful) {
        showNotification({ level: 'success', message: 'Appointment confirmed successfully.', ttl: 3000 });
      } else if (updateRes === null) {
        showNotification({ level: 'error', message: 'Failed to confirm appointment.', ttl: 3000 });
      }
    }
    const { tab, searchWithFilters } = extractAppointmentsListContext(data);
    const updated = await appointmentsPage.getAppointmentsPageWithRecords({
      manifest,
      jwtToken: rcUnifiedCrmExtJwt,
      tab,
      searchWithFilters,
      forceSync: false,
    });
    document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
    responseMessage(data.requestId, { data: 'ok' });
  } catch (e) {
    showNotification({ level: 'error', message: e?.message ?? 'Failed to confirm appointment.', ttl: 3000 });
    responseMessage(data.requestId, { error: e?.message ?? String(e) });
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

