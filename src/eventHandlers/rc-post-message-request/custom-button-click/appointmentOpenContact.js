import contactCore from '../../../core/contact';
import axios from 'axios';
import { normalizeAttendees } from '../../../lib/appointmentUtils';
import { listAppointments } from '../../../service/appointmentService';
import { extractAppointmentsListContext, normalizeAppointmentId } from '../../../lib/appointmentUtils';

async function onEvent({ data, manifest, platformName, listButtonItemId }) {
  window.postMessage({ type: 'rc-log-modal-loading-on' }, '*');
  try {
    const btn = data.body.button || {};

    const rowId =
      (btn?.additionalInfo?.thirdPartyAppointmentId) ||
      listButtonItemId ||
      btn?.listItem?.const ||
      btn?.value ||
      '';

    const attendeesRawFromEvent =
      btn?.additionalInfo?.attendees ??
      // backwards-compat: older payloads used attendeeIds as an array of ids (or now objects)
      btn?.additionalInfo?.attendeeIds ??
      [];
    let attendees = normalizeAttendees(attendeesRawFromEvent);

    // If the list row didn't include attendees, fetch from API (no local cache).
    if (attendees.length === 0 && rowId) {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      const { tab } = extractAppointmentsListContext(data);
      const items = await listAppointments({
        serverUrl: manifest.serverUrl,
        jwtToken: rcUnifiedCrmExtJwt,
        range: tab,
        mineOnly: false,
        forceSync: false,
      });
      const appointment = (items || []).find((item) => String(normalizeAppointmentId(item)) === String(rowId));
      attendees = normalizeAttendees(appointment?.attendees ?? appointment?.attendeeIds);
    }

    const contactUrl = btn?.additionalInfo?.contactUrl ?? '';
    const contactId = btn?.additionalInfo?.contactId ?? '';
    const contactType = btn?.additionalInfo?.contactType ?? 'contact';
    const phoneNumber = btn?.additionalInfo?.phoneNumber ?? '';

    if (contactUrl) {
      window.open(contactUrl);
      return;
    }

    // Prefer opening attendee contacts when provided by listAppointments.
    if (attendees.length > 0) {
      const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
      let platformInfo = await chrome.storage.local.get('platform-info');
      if (platformInfo?.['platform-info']?.hostname === 'temp') {
        const hostnameRes = await axios.get(`${manifest.serverUrl}/hostname?jwtToken=${rcUnifiedCrmExtJwt}`);
        platformInfo['platform-info'].hostname = hostnameRes.data;
        await chrome.storage.local.set(platformInfo);
      }
      const hostname = platformInfo?.['platform-info']?.hostname ?? '';
      const targetUrlTemplate = manifest?.platforms?.[platformName]?.contactPageUrl ?? '';

      if (targetUrlTemplate) {
        for (const a of attendees) {
          const resolvedType = a.type || contactType;
          const contactPageUrl = String(targetUrlTemplate)
            .replace('{hostname}', hostname)
            .replaceAll('{contactId}', String(a.id))
            .replaceAll('{contactType}', String(resolvedType));
          window.open(contactPageUrl);
        }
        return;
      }

      // Fallback: open the first attendee via adapter contact open (if supported)
      const first = attendees[0];
      if (first?.id) {
        await contactCore.openContactPage({
          manifest,
          platformName,
          contactId: String(first.id),
          contactType: String(first.type || contactType),
        });
        return;
      }
    }

    // Fallbacks: explicit contact fields (if button provides them), then phone match.
    if (contactId) {
      await contactCore.openContactPage({ manifest, platformName, contactId, contactType });
      return;
    }

    if (phoneNumber) {
      await contactCore.openContactPage({ manifest, platformName, phoneNumber, multiContactMatchBehavior: 'disabled' });
    }
  } finally {
    window.postMessage({ type: 'rc-log-modal-loading-off' }, '*');
  }
}

exports.onEvent = onEvent;

