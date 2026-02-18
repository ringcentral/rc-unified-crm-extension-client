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

function normalizeStatusKey(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'cancelled') return 'canceled';
  return v || 'scheduled';
}

function matchesStatusFilter(statusKey, filterLabel) {
  const f = String(filterLabel || 'All');
  if (f === 'All') return true;
  if (f === 'Scheduled') return statusKey === 'scheduled' || statusKey === 'confirmed';
  if (f === 'Canceled') return statusKey === 'canceled';
  return true;
}

function getAppointmentsPageRender({ selectedTab = 'upcoming', searchWithFilters = {} } = {}) {
  const resolvedSearch = String(searchWithFilters?.search ?? '');
  const resolvedFilter = String(searchWithFilters?.filter ?? 'All');
  return {
    id: 'appointmentsPage',
    title: 'Appointments',
    type: 'tab',
    priority: 65,
    // TODO: Replace with a real calendar/appointment icon asset
    iconUri: userReportIcon,
    activeIconUri: userReportIconActive,
    darkIconUri: userReportIconDark,
    // Tab header actions (Embeddable v3.x). These show as icon buttons on top-right.
    actions: [
      { id: 'appointmentsHeaderNew', icon: 'new', title: 'New appointment' },
      { id: 'appointmentsHeaderRefresh', icon: 'refresh', title: 'Refresh' },
    ],
    schema: {
      type: 'object',
      properties: {
        tab: {
          type: 'string',
          title: 'Tab',
          enum: ['upcoming', 'past'],
          enumNames: ['Upcoming', 'Past'],
        },
        searchWithFilters: {
          type: 'object',
          properties: {
            search: { type: 'string', title: 'Search' },
            filter: { type: 'string', title: 'Filter' },
          },
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
      searchWithFilters: {
        'ui:field': 'search',
        'ui:placeholder': 'Search...',
        'ui:filters': ['All', 'Scheduled', 'Canceled'],
        'ui:previewLength': 2,
      },
      appointments: { 'ui:field': 'list', 'ui:showIconAsAvatar': false },
    },
    formData: {
      tab: selectedTab,
      searchWithFilters: {
        search: resolvedSearch,
        filter: resolvedFilter,
      },
    },
  };
}

async function getAppointmentsPageWithRecords({ manifest, jwtToken, tab = 'upcoming', searchWithFilters = {}, forceSync = false }) {
  const page = getAppointmentsPageRender({ selectedTab: tab, searchWithFilters });
  const resolvedSearch = String(searchWithFilters?.search ?? '').trim().toLowerCase();
  const resolvedFilter = String(searchWithFilters?.filter ?? 'All');

  const items = await listAppointments({
    serverUrl: manifest.serverUrl,
    jwtToken,
    range: tab,
    mineOnly: false,
    forceSync,
  });

  // Apply client-side filters (fallback in case backend doesn't filter reliably yet)
  const nowTs = Date.now();
  const filtered = (items || []).filter((a) => {
    const start = a.startTimeUtc ?? a.startTime ?? a.start ?? a.when ?? null;
    const dt = start ? new Date(start) : null;
    const ts = dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : null;
    if (tab === 'upcoming' && ts !== null && ts < nowTs) return false;
    if (tab === 'past' && ts !== null && ts >= nowTs) return false;

    const statusKey = normalizeStatusKey(a.status);
    if (!matchesStatusFilter(statusKey, resolvedFilter)) return false;

    if (resolvedSearch) {
      const hay = [
        a.participantName,
        a.customerName,
        a.attendeeName,
        a.contactName,
        a.summary,
        a.description,
        a.phoneNumber,
        a.customerPhone,
        a.thirdPartyAppointmentId,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(resolvedSearch)) return false;
    }
    return true;
  });

  // Cache for action handlers (confirm/cancel/edit/open/refresh)
  await chrome.storage.local.set({
    appointmentsListCache: filtered,
    appointmentsListState: { tab, searchWithFilters: { search: searchWithFilters?.search ?? '', filter: resolvedFilter } },
  });

  page.schema.properties.appointments.oneOf = (filtered || []).map((a) => {
    // Canonical appointment key: thirdPartyAppointmentId (matches create response appointmentId/thirdPartyAppointmentId)
    // Backend may return `id: null` but `thirdPartyAppointmentId: "16053"` for newly created appointments.
    const thirdPartyAppointmentIdRaw = a.thirdPartyAppointmentId ?? '';
    const thirdPartyAppointmentId =
      thirdPartyAppointmentIdRaw && String(thirdPartyAppointmentIdRaw).toUpperCase() !== 'N/A'
        ? String(thirdPartyAppointmentIdRaw)
        : '';
    const id = thirdPartyAppointmentId || String(a.id ?? a.externalId ?? '');
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
      { id: 'appointmentEdit', title: 'Edit', icon: 'edit' },
      { id: 'appointmentConfirm', title: 'Confirm', icon: 'check' },
      { id: 'appointmentOpenAppointment', title: 'Open Appointment Info', icon: 'externalLink' },
      { id: 'appointmentOpenContact', title: 'Open Contact Info', icon: 'view' },
      { id: 'appointmentRefresh', title: 'Refresh', icon: 'refresh' },
      { id: 'appointmentCancel', title: 'Cancel', icon: 'close', color: 'danger.b03' },
    ];

    return {
      const: String(id),
      title: participantName,
      description: `${date}${date && time ? ' ' : ''}${time}`,
      authorName: statusText,
      actions,
      additionalInfo: {
        thirdPartyAppointmentId: String(id),
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
        description: 'Try changing filters or use Refresh.',
        // Keep list-level refresh as a fallback action in empty state.
        actions: [{ id: 'appointmentsRefreshButton', title: 'Refresh', icon: 'refresh' }],
        additionalInfo: {},
      },
    ];
  }

  return page;
}

exports.getAppointmentsPageRender = getAppointmentsPageRender;
exports.getAppointmentsPageWithRecords = getAppointmentsPageWithRecords;

