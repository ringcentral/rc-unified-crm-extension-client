import userCore from '../../core/user';
import userReportIcon from '../../images/reportIcon.png';
import userReportIconActive from '../../images/reportIcon_active.png';
import userReportIconDark from '../../images/reportIcon_dark.png';
import { listAppointments } from '../../service/appointmentService';
import { getPlatformInfo } from '../../service/platformService';
import { normalizeAppointmentId, toCanonicalAppointment } from '../../lib/appointmentUtils';

type UnknownRecord = Record<string, any>;

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
  // Fallback: treat the filter label as a status and compare normalized keys.
  return statusKey === normalizeStatusKey(f);
}

function singularizeAppointmentTitle(title) {
  const t = String(title || '').trim();
  if (!t) return 'Appointment';
  if (/appointments$/i.test(t)) return t.replace(/appointments$/i, 'Appointment');
  if (t.length > 1 && /s$/i.test(t)) return t.slice(0, -1);
  return t;
}

function extractAppointmentTitle(a) {
  return String(a?.title ?? a?.subject ?? a?.summary ?? a?.description ?? '').trim();
}

function parseAppointmentStartTs(a) {
  const startUtc = a?.startTimeUtc;
  if (startUtc) {
    const s = String(startUtc).trim();
    if (!s) return null;
    const looksIso = /^\d{4}-\d{2}-\d{2}T/.test(s);
    const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    const d = new Date(looksIso && !hasTz ? `${s}Z` : s);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  const start = a?.startTime ?? a?.start ?? a?.when ?? null;
  if (!start) return null;
  const d = new Date(start);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function getAppointmentsPageRender({
  manifest,
  platformName,
  selectedTab = 'upcoming',
  searchWithFilters = {},
  appointmentTitle = 'Appointments',
  showConfirm = true,
  filterOptions,
  userSettings,
}: UnknownRecord = {}): UnknownRecord {
  const resolvedSearch = String(searchWithFilters?.search ?? '');
  const fallbackFilters = ['All', 'Scheduled', 'Canceled'];
  const resolvedFilters = Array.isArray(filterOptions) && filterOptions.length > 0
    ? filterOptions.map(String)
    : fallbackFilters;
  const initialFilter = resolvedFilters.includes('All') ? 'All' : (resolvedFilters[0] ?? 'All');
  const requestedFilter = String(searchWithFilters?.filter ?? initialFilter);
  const resolvedFilter = resolvedFilters.includes(requestedFilter) ? requestedFilter : initialFilter;
  const page: UnknownRecord = {
    id: 'appointmentsPage',
    title: appointmentTitle,
    type: 'tab',
    priority: 65,
    // TODO: Replace with a real calendar/appointment icon asset
    iconUri: userReportIcon,
    activeIconUri: userReportIconActive,
    darkIconUri: userReportIconDark,
    // Tab header actions (Embeddable v3.x). These show as icon buttons on top-right.
    actions: [
      { id: 'appointmentsHeaderNew', icon: 'new', title: `New ${manifest?.platforms?.[platformName]?.page?.appointment?.title ?? 'appointment'}` },
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
          title: appointmentTitle,
          oneOf: [],
        },
      },
    },
    uiSchema: {
      tab: {
        'ui:widget': 'radio',
        'ui:inline': true,
        'ui:tab': true,
        'ui:style': { marginTop: '-10px' }
      },
      searchWithFilters: {
        'ui:field': 'search',
        'ui:placeholder': 'Search...',
        'ui:filters': resolvedFilters,
        'ui:previewLength': 2,
        'ui:style': { marginTop: '-10px' }
      },
      appointments: {
        'ui:field': 'list',
        'ui:showIconAsAvatar': false,
        'ui:style': { marginTop: '-10px' },
      },
    },
    formData: {
      tab: selectedTab,
      searchWithFilters: {
        search: resolvedSearch,
        filter: resolvedFilter,
      },
    },
    // Pass-through so downstream renderers/handlers can use it if needed.
    _appointmentConfig: { appointmentTitle, showConfirm },
  };
  page.hidden = !userCore.getShowAppointmentsTabSetting(userSettings).value;
  return page;
}

async function getAppointmentsPageWithRecords({
  manifest,
  jwtToken,
  tab = 'upcoming',
  searchWithFilters = {},
  forceSync = false,
  platformName = '',
  userSettings,
}: UnknownRecord = {}): Promise<UnknownRecord> {
  let resolvedUserSettings = userSettings;
  if (!resolvedUserSettings || resolvedUserSettings?.showAppointmentsTab === undefined) {
    try {
      const fromStorage = await chrome.storage.local.get('userSettings');
      resolvedUserSettings = fromStorage?.userSettings ?? resolvedUserSettings;
    } catch (e) { /* ignore */ }
  }
  let resolvedPlatformName = platformName;
  if (!resolvedPlatformName) {
    try {
      const platformInfo = await getPlatformInfo();
      resolvedPlatformName = platformInfo?.platformName ?? '';
    } catch (e) { /* ignore */ }
  }
  const appointmentCfg = manifest?.platforms?.[resolvedPlatformName]?.page?.appointment ?? {};
  const appointmentTitle = appointmentCfg?.title ?? 'Appointments';
  const showConfirm = appointmentCfg?.showConfirm !== false;
  const filterOptions = Array.isArray(appointmentCfg?.filterStatus?.value) ? appointmentCfg.filterStatus.value : undefined;
  const entityTitle = singularizeAppointmentTitle(appointmentTitle);

  const page = getAppointmentsPageRender({
    selectedTab: tab,
    searchWithFilters,
    appointmentTitle,
    showConfirm,
    filterOptions,
    manifest,
    platformName: resolvedPlatformName,
    userSettings: resolvedUserSettings,
  });
  if (page.hidden) {
    page.unreadCount = 0;
    return page;
  }
  const resolvedSearch = String(searchWithFilters?.search ?? '').trim().toLowerCase();
  const resolvedFilter = String(page?.formData?.searchWithFilters?.filter ?? searchWithFilters?.filter ?? 'All');

  const items = await listAppointments({
    serverUrl: manifest.serverUrl,
    jwtToken,
    range: tab,
    mineOnly: false,
    forceSync,
  });

  const canonicalAppointments = (items || []).map(toCanonicalAppointment);

  // Apply client-side filters (fallback in case backend doesn't filter reliably yet)
  const nowTs = Date.now();
  const filteredAppointments = (canonicalAppointments || []).filter((appointment) => {
    const ts = parseAppointmentStartTs(appointment);
    if (tab === 'upcoming' && ts !== null && ts < nowTs) return false;
    if (tab === 'past' && ts !== null && ts >= nowTs) return false;

    const statusKey = normalizeStatusKey(appointment.status);
    if (!matchesStatusFilter(statusKey, resolvedFilter)) return false;

    if (resolvedSearch) {
      const hay = [
        appointment.title,
        appointment.participantName,
        appointment.description,
        ...(Array.isArray(appointment.attendees) ? appointment.attendees.map((t) => t?.name).filter(Boolean) : []),
        appointment.thirdPartyAppointmentId,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(resolvedSearch)) return false;
    }
    return true;
  });

  // Cache for action handlers (confirm/cancel/edit/open/refresh)
  page.schema.properties.appointments.oneOf = (filteredAppointments || []).map((appointment) => {
    const appointmentId = normalizeAppointmentId(appointment as any);
    const participantName = appointment.participantName || '';
    const start = appointment.startTimeUtc ?? null;
    const { date, time } = formatDateTime(start);
    const apptTitleRaw = extractAppointmentTitle(appointment);
    const apptTitle =
      apptTitleRaw && apptTitleRaw.toLowerCase() !== String(participantName).toLowerCase()
        ? apptTitleRaw
        : '';

    const actions = [
      { id: 'appointmentEdit', title: 'Edit', icon: 'edit' },
      ...(showConfirm ? [{ id: 'appointmentConfirm', title: 'Confirm', icon: 'check' }] : []),
      { id: 'appointmentOpenAppointment', title: `Open ${entityTitle} Info`, icon: 'externalLink' },
      { id: 'appointmentOpenContact', title: 'Open Contact Info', icon: 'view' },
      { id: 'appointmentRefresh', title: 'Refresh', icon: 'refresh' },
      { id: 'appointmentCancel', title: 'Cancel', icon: 'delete', color: 'danger.b03' },
    ];

    return {
      const: String(appointmentId),
      // Avoid empty list-row titles (can break list rendering in some embeddable builds).
      title: apptTitle || participantName || entityTitle,
      description: participantName,
      authorName: date,
      meta: time,
      actions,
      additionalInfo: {
        thirdPartyAppointmentId: String(appointmentId),
        attendees: appointment.attendees ?? [],
      },
    };
  });

  if (!page.schema.properties.appointments.oneOf || page.schema.properties.appointments.oneOf.length === 0) {
    page.schema.properties.appointments.oneOf = [
      {
        const: 'noAppointments',
        title: `No ${appointmentTitle}`,
        description: 'Try changing filters or use Refresh.',
        // Keep list-level refresh as a fallback action in empty state.
        actions: [{ id: 'appointmentsRefreshButton', title: 'Refresh', icon: 'refresh' }],
        additionalInfo: {},
      },
    ];
  }

  return page;
}

export { getAppointmentsPageRender, getAppointmentsPageWithRecords };

const appointmentsPage = {
  getAppointmentsPageRender,
  getAppointmentsPageWithRecords,
};

export default appointmentsPage;

