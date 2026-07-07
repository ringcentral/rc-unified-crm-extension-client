import appointmentEditPage from '../../../components/appointmentsPage/appointmentEditPage';
import { listAppointments } from '../../../service/appointmentService';
import { extractAppointmentsListContext, normalizeAppointmentId, toCanonicalAppointment } from '../../../lib/appointmentUtils';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformName?: string;
  listButtonItemId?: unknown;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformName, listButtonItemId }: EventOptions): Promise<void> {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt') as { rcUnifiedCrmExtJwt?: string };
    const { tab, searchWithFilters } = extractAppointmentsListContext(data);

    const items = await listAppointments({
      serverUrl: manifest.serverUrl,
      jwtToken: rcUnifiedCrmExtJwt,
      range: tab,
      mineOnly: false,
      forceSync: false,
    });

    const appointment = (items || []).find((item) => String(normalizeAppointmentId(item)) === String(listButtonItemId));
    if (!appointment) {
      return;
    }
    const apptCfg = manifest?.platforms?.[platformName as string]?.page?.appointment ?? {};
    const appointmentTitle = apptCfg?.title ?? 'Appointments';
    const editPage = appointmentEditPage.getAppointmentEditPageRender({
      appointment: {
        ...toCanonicalAppointment(appointment),
        returnTab: tab,
        returnSearch: String(searchWithFilters?.search ?? ''),
        returnFilter: String(searchWithFilters?.filter ?? 'All'),
        emailMandatoryInAttendee: apptCfg?.emailMandatoryInAttendee,
      },
      appointmentTitle,
      titleFieldConfig: apptCfg?.titleField,
      statusConfig: apptCfg?.status,
    });
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-register-customized-page',
      page: editPage,
    }, '*');
    getWidgetFrameWindow().postMessage({
      type: 'rc-adapter-navigate-to',
      path: `/customized/${editPage.id}`,
    }, '*');
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

export default {
  onEvent,
};
