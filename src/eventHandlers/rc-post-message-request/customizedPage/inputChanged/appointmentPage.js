import axios from 'axios';
import { createDebounceHandler } from '../../../../lib/util';
import appointmentCreatePage from '../../../../components/appointmentsPage/appointmentCreatePage';
import appointmentEditPage from '../../../../components/appointmentsPage/appointmentEditPage';

const debounceContactSearch = createDebounceHandler('appointmentContactSearch', 800);

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

async function onEvent({ data, manifest, platformName }) {
  const keys = Array.isArray(data?.body?.keys) ? data.body.keys : [];
  if (!keys.some((k) => k === 'participantContactIds')) return;

  const formData = data?.body?.formData ?? {};
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

  const pageId = data?.body?.page?.id;
  const isEdit = pageId === 'appointmentEditPage';

  debounceContactSearch(data.requestId, async () => {
    window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
    try {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      const contactRes = await axios.get(`${manifest.serverUrl}/custom/contact/search`, {
        params: {
          jwtToken: rcUnifiedCrmExtJwt,
          name: searchText,
        },
      });

      const contactInfo = contactRes.data?.contact ?? [];
      const normalizedContacts = contactInfo
        .map((c) => ({
          id: String(c?.id ?? '').trim(),
          type: String(c?.type ?? '').trim(),
          name: String(c?.name ?? '').trim(),
          ...(c?.email ? { email: String(c.email).trim() } : {}),
          // Mark as confirmed from a live API search so the renderer knows
          // whether to show the "No email address" warning.
          emailChecked: true,
        }))
        .filter((c) => c.id);

      const mergedCandidates = dedupeContactsByIdType([...candidates, ...normalizedContacts]);

      const apptCfg = manifest?.platforms?.[platformName]?.page?.appointment ?? {};
      // Read emailMandatoryInAttendee from the manifest (authoritative) — hidden form fields
      // may not round-trip in inputChanged formData, so we never rely on formData alone.
      const emailMandatoryInAttendee =
        apptCfg?.emailMandatoryInAttendee ?? formData?.emailMandatoryInAttendee;

      const updatedFormData = {
        ...formData,
        participantCandidates: mergedCandidates,
        // Restore only the real (confirmed) selections; drop the free-text search query.
        participantContactIds: realSelectedIds,
        // Stamp authoritative value so the re-rendered page always has it.
        emailMandatoryInAttendee,
      };
      const appointmentTitle = apptCfg?.title ?? 'Appointments';

      const page = isEdit
        ? appointmentEditPage.getAppointmentEditPageRender({
          initialFormData: updatedFormData,
          appointmentTitle,
          statusConfig: apptCfg?.status,
          titleFieldConfig: apptCfg?.titleField,
        })
        : appointmentCreatePage.getAppointmentCreatePageRender({
          initialFormData: updatedFormData,
          appointmentTitle,
          statusConfig: apptCfg?.status,
          titleFieldConfig: apptCfg?.titleField,
        });

      document.querySelector('#rc-widget-adapter-frame').contentWindow.postMessage({
        type: 'rc-adapter-register-customized-page',
        page,
      }, '*');
    } catch (e) {
      console.error('Appointment participant search failed:', e);
    } finally {
      window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
    }
  });
}

exports.onEvent = onEvent;
