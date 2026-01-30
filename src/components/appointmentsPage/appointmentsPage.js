import userReportIcon from '../../images/reportIcon.png';
import userReportIconActive from '../../images/reportIcon_active.png';
import userReportIconDark from '../../images/reportIcon_dark.png';
import { listAppointments } from '../../service/appointmentService';

function formatDateTime(dt) {
  if (!dt) return { date: '', time: '' };
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function normalizeStatus(s) {
  const v = String(s || '').toLowerCase();
  if (!v) return 'Scheduled';
  if (v === 'cancelled') return 'Canceled';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getAppointmentsPageRender({ selectedTab = 'upcoming', scope = 'mine' } = {}) {
  return {
    id: 'appointmentsPage',
    title: 'Appointments',
    type: 'tab',
    priority: 65,
    // TODO: Replace with a real calendar/appointment icon asset
    iconUri: userReportIcon,
    activeIconUri: userReportIconActive,
    darkIconUri: userReportIconDark,
    schema: {
      type: 'object',
      properties: {
        tab: {
          type: 'string',
          title: 'Tab',
          enum: ['upcoming', 'past'],
          enumNames: ['Upcoming', 'Past'],
        },
        scope: {
          type: 'string',
          title: 'Show',
          enum: ['mine', 'all'],
          enumNames: ['My appointments', 'All appointments'],
        },
        appointmentCreateButton: {
          type: 'string',
          title: '+ New',
        },
        appointmentsRefreshButton: {
          type: 'string',
          title: 'Refresh',
        },
        appointments: {
          type: 'string',
          title: 'Appointments',
          oneOf: [],
        },
      },
    },
    uiSchema: {
      tab: {
        'ui:widget': 'radio',
        'ui:inline': true,
        'ui:tab': true,
      },
      scope: {
        // Use a dropdown to keep the UI compact and consistent with other filters (e.g. Calldown)
        'ui:widget': 'select',
      },
      appointmentCreateButton: {
        'ui:field': 'button',
        'ui:variant': 'contained',
        'ui:fullWidth': false,
        'ui:options': { grid: { xs: 6, sm: 6 } },
      },
      appointmentsRefreshButton: {
        'ui:field': 'button',
        'ui:variant': 'outlined',
        'ui:fullWidth': false,
        'ui:options': { grid: { xs: 6, sm: 6 } },
      },
      appointments: { 'ui:field': 'list', 'ui:showIconAsAvatar': false },
    },
    formData: {
      tab: selectedTab,
      scope,
    },
  };
}

async function getAppointmentsPageWithRecords({ manifest, jwtToken, tab = 'upcoming', scope = 'mine', forceSync = false }) {
  const page = getAppointmentsPageRender({ selectedTab: tab, scope });
  const mineOnly = scope === 'mine';

  const items = await listAppointments({
    serverUrl: manifest.serverUrl,
    jwtToken,
    range: tab,
    mineOnly,
    forceSync,
  });

  // Cache for action handlers (confirm/cancel/edit/open/refresh)
  await chrome.storage.local.set({ appointmentsListCache: items, appointmentsListState: { tab, scope } });

  page.schema.properties.appointments.oneOf = (items || []).map((a) => {
    const id = a.id ?? a.appointmentId ?? a.externalId ?? '';
    const participantName =
      a.participantName ??
      a.customerName ??
      a.attendeeName ??
      a.contactName ??
      'Unknown';

    const start = a.startTimeUtc ?? a.startTime ?? a.start ?? a.when ?? null;
    const { date, time } = formatDateTime(start);
    const statusText = normalizeStatus(a.status);

    const actions = [
      { id: 'appointmentConfirm', title: 'Confirm', icon: 'check' },
      { id: 'appointmentCancel', title: 'Cancel', icon: 'close', color: 'danger.b03' },
      { id: 'appointmentEdit', title: 'Edit', icon: 'edit' },
      { id: 'appointmentOpenContact', title: 'Open Contact Info', icon: 'view' },
      { id: 'appointmentOpenAppointment', title: 'Open Appointment Info', icon: 'externalLink' },
      { id: 'appointmentRefresh', title: 'Refresh', icon: 'refresh' },
    ];

    return {
      const: String(id),
      title: participantName,
      description: `${date}${date && time ? ' ' : ''}${time}`,
      authorName: statusText,
      meta: tab === 'upcoming' ? 'Upcoming' : 'Past',
      actions,
      additionalInfo: {
        appointmentId: String(id),
        contactId: a.contactId ?? a.customerId ?? '',
        contactType: a.contactType ?? 'contact',
        phoneNumber: a.phoneNumber ?? a.customerPhone ?? '',
        contactName: participantName,
        contactUrl: a.contactUrl ?? a.customerUrl ?? a.contactLink ?? '',
        appointmentUrl: a.appointmentUrl ?? a.externalUrl ?? a.url ?? '',
      },
    };
  });

  if (!page.schema.properties.appointments.oneOf || page.schema.properties.appointments.oneOf.length === 0) {
    page.schema.properties.appointments.oneOf = [
      {
        const: 'noAppointments',
        title: 'No appointments',
        description: 'Try changing filters or press Refresh.',
        actions: [{ id: 'appointmentsRefreshButton', title: 'Refresh', icon: 'refresh' }],
        additionalInfo: {},
      },
    ];
  }

  return page;
}

exports.getAppointmentsPageRender = getAppointmentsPageRender;
exports.getAppointmentsPageWithRecords = getAppointmentsPageWithRecords;

