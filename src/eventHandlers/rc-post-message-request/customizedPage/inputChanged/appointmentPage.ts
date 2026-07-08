import axios from 'axios';
import { createDebounceHandler } from '../../../../lib/util';
import appointmentCreatePage from '../../../../components/appointmentsPage/appointmentCreatePage';
import appointmentEditPage from '../../../../components/appointmentsPage/appointmentEditPage';

const debounceContactSearch = createDebounceHandler('appointmentContactSearch', 800);

type UnknownRecord = Record<string, any>;

function getWidgetFrameWindow(): Window {
  return document.querySelector<HTMLIFrameElement>('#rc-widget-adapter-frame')!.contentWindow!;
}

function durationIsoFromMinutes(totalMinutesRaw) {
  const totalMinutes = Number(totalMinutesRaw);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return 'PT0M';
  const minutesInt = Math.floor(totalMinutes);
  const hours = Math.floor(minutesInt / 60);
  const minutes = minutesInt % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}H`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}M`);
  return `PT${parts.join('')}`;
}

function renderPage({ isEdit, formData, manifest, platformName }) {
  const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
  const appointmentTitle = apptCfg?.title ?? 'Appointments';
  return isEdit
    ? appointmentEditPage.getAppointmentEditPageRender({
      initialFormData: formData,
      appointmentTitle,
      statusConfig: apptCfg?.status,
      titleFieldConfig: apptCfg?.titleField,
    })
    : appointmentCreatePage.getAppointmentCreatePageRender({
      initialFormData: formData,
      appointmentTitle,
      statusConfig: apptCfg?.status,
      titleFieldConfig: apptCfg?.titleField,
    });
}

function postPage(page) {
  const frame = getWidgetFrameWindow();
  frame.postMessage({ type: 'rc-adapter-register-customized-page', page }, '*');
}

async function handleDateTimeChange({ formData, manifest, platformName, isEdit }: UnknownRecord) {
  const startVal = String(formData?.dateTime ?? '').trim();
  const endVal = String(formData?.endDateTime ?? '').trim();
  if (!startVal) return;

  const startMs = new Date(startVal).getTime();
  if (Number.isNaN(startMs)) return;

  // If end date is missing or before start, snap it forward to match start.
  const endMs = endVal ? new Date(endVal).getTime() : NaN;
  const effectiveEndMs = (!Number.isNaN(endMs) && endMs > startMs) ? endMs : startMs;
  const effectiveEndVal = Number.isNaN(endMs) || endMs <= startMs
    ? startVal
    : endVal;

  const diffMinutes = Math.round((effectiveEndMs - startMs) / (60 * 1000));
  const duration = durationIsoFromMinutes(diffMinutes);

  const updatedFormData = { ...formData, endDateTime: effectiveEndVal, duration };
  // Always re-render so the endDateTime minimum constraint updates to reflect the new start.
  postPage(renderPage({ isEdit, formData: updatedFormData, manifest, platformName }));
}

function dedupeContactsByIdType(contacts) {
  const map = new Map();
  for (const c of contacts || []) {
    const id = String(c?.id ?? '').trim();
    const type = String(c?.type ?? '').trim();
    const name = String(c?.name ?? '').trim();
    const email = String(c?.email ?? '').trim();
    // emailChecked: true means this contact's email status was confirmed by a live API search.
    const emailChecked = c?.emailChecked === true;
    if (!id) continue;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, {
        id, type, name,
        ...(email ? { email } : {}),
        ...(emailChecked ? { emailChecked: true } : {}),
      });
      continue;
    }
    if (!existing.type && type) existing.type = type;
    if (!existing.name && name) existing.name = name;
    if (!existing.email && email) existing.email = email;
    // Once confirmed by a live search, keep that fact.
    if (emailChecked) existing.emailChecked = true;
  }
  return Array.from(map.values());
}

async function onEvent({ data, manifest, platformName }: UnknownRecord) {
  const keys = Array.isArray(data?.body?.keys) ? data.body.keys : [];
  const formData = data?.body?.formData ?? {};
  const pageId = data?.body?.page?.id;
  const isEdit = pageId === 'appointmentEditPage';

  // Recalculate duration whenever start or end date/time changes.
  if (keys.some((k) => k === 'dateTime' || k === 'endDateTime')) {
    await handleDateTimeChange({ formData, manifest, platformName, isEdit });
    return;
  }

  // Handle participant contact search via freeSolo autocomplete.
  if (!keys.some((k) => k === 'participantContactIds')) return;

  const selectedValues = Array.isArray(formData?.participantContactIds)
    ? formData.participantContactIds
    : [];

  const candidates = Array.isArray(formData?.participantCandidates)
    ? formData.participantCandidates
    : [];
  const candidateIdSet = new Set(candidates.map((c) => String(c.id)));

  // Identify free-text values typed by the user (not real contact IDs).
  const searchQueries = selectedValues.filter((v) => !candidateIdSet.has(String(v)));
  if (searchQueries.length === 0) return;

  // Use the most recently typed query.
  const searchText = String(searchQueries[searchQueries.length - 1]).trim();
  if (!searchText) return;

  // Strip the query from selected IDs — it is a search term, not a real contact.
  const realSelectedIds = selectedValues.filter((v) => candidateIdSet.has(String(v)));

  debounceContactSearch(data.requestId, async () => {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      const requestConfig: UnknownRecord = {
        params: {
          name: searchText,
        },
      };
      if (rcUnifiedCrmExtJwt) {
        requestConfig.headers = {
          Authorization: `Bearer ${rcUnifiedCrmExtJwt}`,
        };
      }
      const contactRes = await axios.get(`${manifest.serverUrl}/custom/contact/search`, requestConfig);

      const contactInfo = contactRes.data?.contact ?? [];
      const normalizedContacts = contactInfo
        .map((c) => ({
          id: String(c?.id ?? '').trim(),
          type: String(c?.type ?? '').trim(),
          name: String(c?.name ?? '').trim(),
          ...(c?.email ? { email: String(c.email).trim() } : {}),
          emailChecked: true,
        }))
        .filter((c) => c.id);

      const mergedCandidates = dedupeContactsByIdType([...candidates, ...normalizedContacts]);

      const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
      const emailMandatoryInAttendee =
        apptCfg?.emailMandatoryInAttendee ?? formData?.emailMandatoryInAttendee;

      const updatedFormData = {
        ...formData,
        participantCandidates: mergedCandidates,
        participantContactIds: realSelectedIds,
        emailMandatoryInAttendee,
      };

      postPage(renderPage({ isEdit, formData: updatedFormData, manifest, platformName }));
    } catch (e) {
      console.error('Appointment participant search failed:', e);
    } finally {
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
  });
}

export { onEvent };
export default {
  onEvent,
};
