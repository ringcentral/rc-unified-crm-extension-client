import appointmentCreatePage from '../../../components/appointmentsPage/appointmentCreatePage';
import { extractAppointmentsListContext } from '../../../lib/appointmentUtils';

type UnknownRecord = Record<string, any>;

type EventOptions = {
  data: UnknownRecord;
  manifest: UnknownRecord;
  platformName?: string;
};

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

export async function onEvent({ data, manifest, platformName }: EventOptions): Promise<void> {
  const apptCfg = manifest?.platforms?.[platformName as string]?.page?.appointment ?? {};
  const appointmentTitle = apptCfg?.title ?? 'Appointments';
  const { tab, searchWithFilters } = extractAppointmentsListContext(data);
  const page = appointmentCreatePage.getAppointmentCreatePageRender({
    initialFormData: {
      returnTab: tab,
      returnSearch: String(searchWithFilters?.search ?? ''),
      returnFilter: String(searchWithFilters?.filter ?? 'All'),
      emailMandatoryInAttendee: apptCfg?.emailMandatoryInAttendee,
    },
    appointmentTitle,
    statusConfig: apptCfg?.status,
    titleFieldConfig: apptCfg?.titleField,
  });
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-register-customized-page',
    page,
  }, '*');
  getWidgetFrameWindow().postMessage({
    type: 'rc-adapter-navigate-to',
    path: `/customized/${page.id}`,
  }, '*');
}

export default {
  onEvent,
};
