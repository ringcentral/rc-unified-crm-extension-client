import appointmentsPage from '../../../components/appointmentsPage/appointmentsPage';
import { updateAppointmentStatus } from '../../../service/appointmentService';
import { extractAppointmentsListContext } from '../../../lib/appointmentUtils';
import { responseMessage, showNotification } from '../../../lib/util';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  listButtonItemId?: unknown;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function onEvent({ data, manifest, listButtonItemId }: EventOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const appointmentId = listButtonItemId ?? data?.body?.button?.additionalInfo?.thirdPartyAppointmentId ?? '';
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
    let updateRes: UnknownRecord | null = null;
    if (appointmentId) {
      updateRes = await updateAppointmentStatus({
        serverUrl: manifest.serverUrl,
        jwtToken: rcUnifiedCrmExtJwt,
        appointmentId: String(appointmentId),
        status: 'canceled',
      }) as UnknownRecord | null;
      if (updateRes?.returnMessage) {
        showNotification({
          level: updateRes.returnMessage?.messageType,
          message: updateRes.returnMessage?.message,
          ttl: updateRes.returnMessage?.ttl,
          details: updateRes.returnMessage?.details,
        });
      } else if (updateRes?.successful) {
        showNotification({ level: 'success', message: 'Appointment cancelled successfully.', ttl: 3000 });
      } else if (updateRes === null) {
        showNotification({ level: 'error', message: 'Failed to cancel appointment.', ttl: 3000 });
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
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: updated,
    }, '*');
    responseMessage(data.requestId, { data: 'ok' });
  } catch (e) {
    const message = getErrorMessage(e);
    showNotification({ level: 'error', message, ttl: 3000 });
    responseMessage(data.requestId, { error: message });
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
